import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus, AuditAction, AuditOutcome } from '@prisma/client';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let sessionsService: jest.Mocked<SessionsService>;
  let emailService: jest.Mocked<EmailService>;
  let auditService: jest.Mocked<AuditService>;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockUsersService = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      incrementFailedLoginAttempts: jest.fn(),
      resetFailedLoginAttempts: jest.fn(),
    };

    const mockSessionsService = {
      createSession: jest.fn(),
      findUserSessions: jest.fn(),
      findSessionByRefreshToken: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      updateSessionActivity: jest.fn(),
    };

    const mockEmailService = {
      sendWelcomeEmail: jest.fn(),
      sendAccountApprovedEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendPasswordChangedEmail: jest.fn(),
      sendAccountLockedEmail: jest.fn(),
      sendNewDeviceLoginEmail: jest.fn(),
    };

    const mockAuditService = {
      logEvent: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockPrismaService: any = {
      passwordResetToken: {
        count: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      session: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    sessionsService = module.get(SessionsService);
    emailService = module.get(EmailService);
    auditService = module.get(AuditService);
    jwtService = module.get(JwtService);
    prismaService = module.get(PrismaService);
  });

  describe('register', () => {
    const email = 'test@example.com';
    const password = 'Password123!';
    const name = 'Test User';

    it('should register an active user for SUPER_ADMIN role', async () => {
      const mockUser = {
        id: 'user-uuid',
        email,
        passwordHash: 'hashed-password',
        name,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      usersService.createUser.mockResolvedValue(mockUser);

      const result = await service.register(
        email,
        password,
        name,
        UserRole.SUPER_ADMIN,
        '127.0.0.1',
        'test-ua',
      );

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(usersService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
        }),
      );
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(email, name);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        'user-uuid',
        AuditAction.REGISTER,
        AuditOutcome.SUCCESS,
        '127.0.0.1',
        'test-ua',
        'users/user-uuid',
        expect.any(Object),
      );
    });

    it('should register a pending user for SOCIAL_WORKER role', async () => {
      const mockUser = {
        id: 'user-uuid',
        email,
        passwordHash: 'hashed-password',
        name,
        role: UserRole.SOCIAL_WORKER,
        status: UserStatus.PENDING,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      usersService.createUser.mockResolvedValue(mockUser);

      const result = await service.register(
        email,
        password,
        name,
        UserRole.SOCIAL_WORKER,
        '127.0.0.1',
        'test-ua',
      );

      expect(result.status).toBe(UserStatus.PENDING);
      expect(usersService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.SOCIAL_WORKER,
          status: UserStatus.PENDING,
        }),
      );
    });

    it('should throw BadRequestException if password does not meet policy requirements', async () => {
      await expect(
        service.register(email, 'simple', name, UserRole.SUPER_ADMIN, '127.0.0.1', 'test-ua'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log failure if registration throws conflict error', async () => {
      usersService.createUser.mockRejectedValue(new ConflictException('Email ini sudah terdaftar'));

      await expect(
        service.register(email, password, name, UserRole.SUPER_ADMIN, '127.0.0.1', 'test-ua'),
      ).rejects.toThrow(ConflictException);

      expect(auditService.logEvent).toHaveBeenCalledWith(
        null,
        AuditAction.REGISTER,
        AuditOutcome.FAILURE,
        '127.0.0.1',
        'test-ua',
        'users',
        expect.any(Object),
      );
    });
  });

  describe('validateUser', () => {
    const email = 'test@example.com';
    const password = 'Password123!';

    it('should validate active user with correct password', async () => {
      const passwordHash = await bcrypt.hash(password, 12);
      const mockUser = {
        id: 'user-uuid',
        email,
        passwordHash,
        name: 'Test User',
        role: UserRole.SOCIAL_WORKER,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(email, password, '127.0.0.1', 'test-ua');
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw ForbiddenException if account is locked', async () => {
      const mockUser = {
        id: 'user-uuid',
        email,
        passwordHash: 'hashed',
        name: 'Test User',
        role: UserRole.SOCIAL_WORKER,
        status: UserStatus.LOCKED,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins locked
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.validateUser(email, password, '127.0.0.1', 'test-ua'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if account is pending', async () => {
      const mockUser = {
        id: 'user-uuid',
        email,
        passwordHash: 'hashed',
        name: 'Test User',
        role: UserRole.SOCIAL_WORKER,
        status: UserStatus.PENDING,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.validateUser(email, password, '127.0.0.1', 'test-ua'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should increment login attempts and lock account after 5 failures', async () => {
      const mockUser = {
        id: 'user-uuid',
        email,
        passwordHash: await bcrypt.hash('OtherPassword123!', 12),
        name: 'Test User',
        role: UserRole.SOCIAL_WORKER,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 4,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.incrementFailedLoginAttempts.mockResolvedValue({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      await expect(
        service.validateUser(email, password, '127.0.0.1', 'test-ua'),
      ).rejects.toThrow(ForbiddenException);

      expect(usersService.incrementFailedLoginAttempts).toHaveBeenCalledWith('user-uuid');
      expect(emailService.sendAccountLockedEmail).toHaveBeenCalledWith(email, mockUser.name, 30);
    });
  });
});
