import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { User, UserRole, UserStatus, AuditAction, AuditOutcome } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private validatePasswordPolicy(password: string): void {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      throw new BadRequestException(
        'Kata sandi harus minimal 8 karakter dan mengandung setidaknya satu huruf besar, satu huruf kecil, satu angka, dan satu karakter khusus.',
      );
    }
  }

  async register(
    email: string,
    pass: string,
    name: string,
    role: UserRole,
    ipAddress: string,
    deviceInfo: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    this.validatePasswordPolicy(pass);

    const passwordHash = await bcrypt.hash(pass, 12);

    // SuperAdmin, GovernmentAdmin, and VillageAdmin are ACTIVE immediately.
    // SocialWorker and Researcher are PENDING.
    const status =
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.GOVERNMENT_ADMIN ||
      role === UserRole.VILLAGE_ADMIN
        ? UserStatus.ACTIVE
        : UserStatus.PENDING;

    try {
      const user = await this.usersService.createUser({
        email,
        passwordHash,
        name,
        role,
        status,
      });

      await this.auditService.logEvent(
        user.id,
        AuditAction.REGISTER,
        AuditOutcome.SUCCESS,
        ipAddress,
        deviceInfo,
        `users/${user.id}`,
        { email: user.email, role: user.role, status: user.status },
      );

      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.name);

      const { passwordHash: _, ...result } = user;
      return result;
    } catch (error) {
      await this.auditService.logEvent(
        null,
        AuditAction.REGISTER,
        AuditOutcome.FAILURE,
        ipAddress,
        deviceInfo,
        'users',
        { email, error: (error as any).message },
      );
      throw error;
    }
  }

  async validateUser(email: string, pass: string, ipAddress: string, deviceInfo: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Return 401 generic error to avoid email enumeration on login
      throw new UnauthorizedException('Email atau kata sandi yang Anda masukkan salah');
    }

    // Check account status
    if (user.status === UserStatus.LOCKED) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
        await this.auditService.logEvent(
          user.id,
          AuditAction.LOGIN,
          AuditOutcome.FAILURE,
          ipAddress,
          deviceInfo,
          'auth/login',
          { error: 'Account locked', remainingMinutes },
        );
        throw new ForbiddenException(
          `Akun Anda terkunci sementara karena 5 kali kegagalan login. Silakan coba lagi dalam ${remainingMinutes} menit.`,
        );
      } else {
        // Lockout expired, auto unlock
        await this.usersService.resetFailedLoginAttempts(user.id);
        user.status = UserStatus.ACTIVE;
      }
    }

    if (user.status === UserStatus.PENDING) {
      await this.auditService.logEvent(
        user.id,
        AuditAction.LOGIN,
        AuditOutcome.FAILURE,
        ipAddress,
        deviceInfo,
        'auth/login',
        { error: 'Account pending approval' },
      );
      throw new ForbiddenException('Akun Anda sedang menunggu persetujuan dari administrator');
    }

    if (user.status === UserStatus.INACTIVE) {
      await this.auditService.logEvent(
        user.id,
        AuditAction.LOGIN,
        AuditOutcome.FAILURE,
        ipAddress,
        deviceInfo,
        'auth/login',
        { error: 'Account inactive' },
      );
      throw new ForbiddenException('Akun Anda dinonaktifkan. Silakan hubungi administrator');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      const lockStatus = await this.usersService.incrementFailedLoginAttempts(user.id);
      
      await this.auditService.logEvent(
        user.id,
        AuditAction.LOGIN,
        AuditOutcome.FAILURE,
        ipAddress,
        deviceInfo,
        'auth/login',
        { error: 'Invalid password', attempts: lockStatus.failedLoginAttempts },
      );

      if (lockStatus.failedLoginAttempts >= 5) {
        // Send email alert for lockout
        await this.emailService.sendAccountLockedEmail(user.email, user.name, 30);
        throw new ForbiddenException(
          'Akun Anda terkunci sementara karena 5 kali kegagalan login. Silakan coba lagi dalam 30 menit.',
        );
      }

      throw new UnauthorizedException('Email atau kata sandi yang Anda masukkan salah');
    }

    // Success: reset attempts
    if (user.failedLoginAttempts > 0) {
      await this.usersService.resetFailedLoginAttempts(user.id);
    }

    return user;
  }

  async login(
    user: User,
    deviceInfo: {
      deviceType: string;
      deviceName: string;
      os: string;
      browser?: string;
      ipAddress: string;
    },
  ) {
    const sessionId = crypto.randomUUID();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    // Access token: 15 minutes. Refresh token: 7 days.
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Save session
    await this.sessionsService.createSession(
      user.id,
      accessToken,
      refreshToken,
      deviceInfo,
      expiresAt,
    );

    // Audit log
    await this.auditService.logEvent(
      user.id,
      AuditAction.LOGIN,
      AuditOutcome.SUCCESS,
      deviceInfo.ipAddress,
      `${deviceInfo.deviceName} (${deviceInfo.os})`,
      'auth/login',
      { sessionId },
    );

    // Optional: send new device email if user has other sessions (meaning this is a multi-device setup)
    const existingSessions = await this.sessionsService.findUserSessions(user.id);
    if (existingSessions.length > 1) {
      await this.emailService.sendNewDeviceLoginEmail(user.email, user.name, {
        deviceName: deviceInfo.deviceName,
        os: deviceInfo.os,
        ipAddress: deviceInfo.ipAddress,
        time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      });
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }

  async refresh(refreshToken: string, ipAddress: string, deviceInfo: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (error) {
      throw new UnauthorizedException('Token refresh tidak valid atau kedaluwarsa');
    }

    const session = await this.sessionsService.findSessionByRefreshToken(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Sesi tidak ditemukan atau token telah dicabut');
    }

    const user = await this.usersService.findById(session.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Pengguna tidak aktif');
    }

    const newAccessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        sessionId: session.id,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    // Token Rotation: Generate new refresh token and update database
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, sessionId: session.id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    await this.sessionsService.updateSessionActivity(session.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    };
  }

  async logout(userId: string, sessionId: string, ipAddress: string, deviceInfo: string) {
    await this.sessionsService.revokeSession(sessionId, userId);

    await this.auditService.logEvent(
      userId,
      AuditAction.LOGOUT,
      AuditOutcome.SUCCESS,
      ipAddress,
      deviceInfo,
      'auth/logout',
      { sessionId },
    );
  }

  async forgotPassword(email: string, ipAddress: string, deviceInfo: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Prevent brute force / rate limit requests
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (user) {
      const recentTokensCount = await this.prisma.passwordResetToken.count({
        where: {
          userId: user.id,
          createdAt: { gte: oneHourAgo },
        },
      });
      if (recentTokensCount >= 3) {
        throw new BadRequestException(
          'Batas permintaan reset kata sandi terlampaui. Silakan coba lagi dalam 1 jam.',
        );
      }
    }

    // Generates a generic response regardless of whether user exists to prevent email enumeration.
    // But if user exists, generate reset token.
    if (user) {
      // Invalidate existing tokens
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // Log event
      await this.auditService.logEvent(
        user.id,
        AuditAction.PASSWORD_RESET_REQUEST,
        AuditOutcome.SUCCESS,
        ipAddress,
        deviceInfo,
        'auth/forgot-password',
      );

      // Send email containing rawToken
      await this.emailService.sendPasswordResetEmail(user.email, user.name, rawToken);
    } else {
      // Log failed request (anonymous email)
      await this.auditService.logEvent(
        null,
        AuditAction.PASSWORD_RESET_REQUEST,
        AuditOutcome.FAILURE,
        ipAddress,
        deviceInfo,
        'auth/forgot-password',
        { email },
      );
    }
  }

  async resetPassword(
    rawToken: string,
    pass: string,
    ipAddress: string,
    deviceInfo: string,
  ): Promise<void> {
    this.validatePasswordPolicy(pass);

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gte: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.user.deletedAt !== null) {
      throw new BadRequestException('Token reset kata sandi tidak valid atau telah kedaluwarsa');
    }

    const passwordHash = await bcrypt.hash(pass, 12);

    await this.prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: UserStatus.ACTIVE,
        },
      });

      // Revoke all existing sessions
      await tx.session.deleteMany({
        where: { userId: resetRecord.userId },
      });

      // Invalidate the reset token used
      await tx.passwordResetToken.delete({
        where: { id: resetRecord.id },
      });
    });

    // Log event
    await this.auditService.logEvent(
      resetRecord.userId,
      AuditAction.PASSWORD_RESET_COMPLETE,
      AuditOutcome.SUCCESS,
      ipAddress,
      deviceInfo,
      'auth/reset-password',
    );

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail(resetRecord.user.email, resetRecord.user.name);
  }

  async changePassword(
    userId: string,
    currentPass: string,
    newPass: string,
    ipAddress: string,
    deviceInfo: string,
    currentSessionId: string,
  ): Promise<void> {
    this.validatePasswordPolicy(newPass);

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    const isMatch = await bcrypt.compare(currentPass, user.passwordHash);
    if (!isMatch) {
      await this.auditService.logEvent(
        userId,
        AuditAction.PASSWORD_CHANGE,
        AuditOutcome.FAILURE,
        ipAddress,
        deviceInfo,
        'auth/change-password',
        { error: 'Incorrect current password' },
      );
      throw new BadRequestException('Kata sandi lama yang Anda masukkan salah');
    }

    const passwordHash = await bcrypt.hash(newPass, 12);

    await this.prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Revoke all sessions EXCEPT the current one
      await tx.session.deleteMany({
        where: {
          userId,
          id: { not: currentSessionId },
        },
      });
    });

    await this.auditService.logEvent(
      userId,
      AuditAction.PASSWORD_CHANGE,
      AuditOutcome.SUCCESS,
      ipAddress,
      deviceInfo,
      'auth/change-password',
    );

    // Send email
    await this.emailService.sendPasswordChangedEmail(user.email, user.name);
  }
}
