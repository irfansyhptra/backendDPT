import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Query,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole, AuditAction, AuditOutcome } from '@prisma/client';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';

function getDeviceInfo(req: Request) {
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';

  let browser = 'Unknown Browser';
  if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/msie|trident/i.test(userAgent)) browser = 'IE';
  else if (/edg/i.test(userAgent)) browser = 'Edge';

  let deviceType = 'Desktop';
  if (/mobile|android|iphone|ipad|tablet/i.test(userAgent)) {
    deviceType = /tablet|ipad/i.test(userAgent) ? 'Tablet' : 'Mobile';
  }

  let deviceName = 'Generic Device';
  const match = userAgent.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const parts = match[1].split(';');
    deviceName = parts[parts.length - 1].trim();
  }

  return {
    deviceType,
    deviceName,
    os,
    browser,
    ipAddress: ipAddress.split(',')[0].trim(),
    userAgentString: userAgent,
  };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 3600000 } }) // Limit registration to 5 requests per hour
  @ApiOperation({ summary: 'Daftar akun baru' })
  @ApiResponse({ status: 201, description: 'Akun berhasil didaftarkan.' })
  @ApiResponse({ status: 400, description: 'Validasi gagal / password lemah.' })
  @ApiResponse({ status: 409, description: 'Email sudah terdaftar.' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const devInfo = getDeviceInfo(req);
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.name,
      registerDto.role,
      devInfo.ipAddress,
      devInfo.userAgentString,
    );
  }

  @Post('login')
  @Throttle({ auth: { limit: 10, ttl: 60000 } }) // Limit login to 10 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Masuk ke sistem' })
  @ApiResponse({ status: 200, description: 'Login berhasil, mengembalikan token.' })
  @ApiResponse({ status: 401, description: 'Kredensial tidak valid.' })
  @ApiResponse({ status: 403, description: 'Akun pending, dinonaktifkan, atau terkunci.' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const devInfo = getDeviceInfo(req);
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
      devInfo.ipAddress,
      devInfo.userAgentString,
    );
    return this.authService.login(user, devInfo);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perbarui Token Akses' })
  @ApiResponse({ status: 200, description: 'Token berhasil diperbarui.' })
  @ApiResponse({ status: 401, description: 'Refresh token tidak valid atau kedaluwarsa.' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Req() req: Request) {
    const devInfo = getDeviceInfo(req);
    return this.authService.refresh(
      refreshTokenDto.refreshToken,
      devInfo.ipAddress,
      devInfo.userAgentString,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Keluar dari sistem' })
  @ApiResponse({ status: 200, description: 'Logout berhasil.' })
  @ApiResponse({ status: 401, description: 'Tidak terautorisasi.' })
  async logout(@Req() req: any) {
    const devInfo = getDeviceInfo(req);
    await this.authService.logout(req.user.id, req.user.sessionId, devInfo.ipAddress, devInfo.userAgentString);
    return { message: 'Logout berhasil' };
  }

  @Post('forgot-password')
  @Throttle({ auth: { limit: 3, ttl: 3600000 } }) // Limit forgot password to 3 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Minta tautan reset kata sandi' })
  @ApiResponse({ status: 200, description: 'Permintaan diproses (mengembalikan sukses meskipun email tidak ditemukan).' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() req: Request) {
    const devInfo = getDeviceInfo(req);
    await this.authService.forgotPassword(forgotPasswordDto.email, devInfo.ipAddress, devInfo.userAgentString);
    return { message: 'Instruksi reset kata sandi telah dikirim ke email Anda jika terdaftar.' };
  }

  @Post('reset-password')
  @Throttle({ auth: { limit: 10, ttl: 60000 } }) // Limit reset password to 10 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset kata sandi menggunakan token' })
  @ApiResponse({ status: 200, description: 'Kata sandi berhasil direset.' })
  @ApiResponse({ status: 400, description: 'Token tidak valid, kedaluwarsa, atau password lemah.' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: Request) {
    const devInfo = getDeviceInfo(req);
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
      devInfo.ipAddress,
      devInfo.userAgentString,
    );
    return { message: 'Kata sandi Anda telah berhasil direset' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dapatkan profil pengguna yang sedang masuk' })
  @ApiResponse({ status: 200, description: 'Profil berhasil didapatkan.' })
  async getProfile(@Req() req: any) {
    return {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      status: req.user.status,
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perbarui profil pengguna' })
  @ApiResponse({ status: 200, description: 'Profil berhasil diperbarui.' })
  @ApiResponse({ status: 409, description: 'Email sudah digunakan pengguna lain.' })
  async updateProfile(@Body() updateProfileDto: UpdateProfileDto, @Req() req: any) {
    const devInfo = getDeviceInfo(req);
    const updatedUser = await this.usersService.updateProfile(req.user.id, updateProfileDto);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.PROFILE_UPDATE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `users/${req.user.id}`,
      { changes: updateProfileDto },
    );

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      status: updatedUser.status,
      updatedAt: updatedUser.updatedAt,
    };
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ubah kata sandi pengguna' })
  @ApiResponse({ status: 200, description: 'Kata sandi berhasil diubah.' })
  @ApiResponse({ status: 400, description: 'Kata sandi saat ini salah atau kata sandi baru lemah.' })
  async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Req() req: any) {
    const devInfo = getDeviceInfo(req);
    await this.authService.changePassword(
      req.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
      devInfo.ipAddress,
      devInfo.userAgentString,
      req.user.sessionId,
    );
    return { message: 'Kata sandi Anda telah berhasil diubah' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dapatkan daftar sesi aktif' })
  @ApiResponse({ status: 200, description: 'Daftar sesi berhasil didapatkan.' })
  async getSessions(@Req() req: any) {
    const sessions = await this.sessionsService.findUserSessions(req.user.id);
    return sessions.map((session) => ({
      id: session.id,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      os: session.os,
      browser: session.browser,
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      isCurrent: session.id === req.user.sessionId,
    }));
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cabut sesi perangkat tertentu' })
  @ApiResponse({ status: 200, description: 'Sesi berhasil dicabut.' })
  @ApiResponse({ status: 404, description: 'Sesi tidak ditemukan.' })
  async revokeSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    const devInfo = getDeviceInfo(req);
    await this.sessionsService.revokeSession(sessionId, req.user.id);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.SESSION_REVOKE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `sessions/${sessionId}`,
    );

    return { message: 'Sesi berhasil dicabut' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Keluar dari semua perangkat' })
  @ApiResponse({ status: 200, description: 'Seluruh sesi berhasil dicabut.' })
  async logoutAll(@Req() req: any) {
    const devInfo = getDeviceInfo(req);
    await this.sessionsService.revokeAllUserSessions(req.user.id);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.SESSION_REVOKE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      'sessions/all',
    );

    return { message: 'Berhasil keluar dari seluruh perangkat' };
  }

  @Get('activity-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dapatkan log aktivitas audit (Admin saja)' })
  @ApiResponse({ status: 200, description: 'Log audit berhasil didapatkan.' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'outcome', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getActivityLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: any,
    @Query('outcome') outcome?: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.queryLogs({
      userId,
      action,
      outcome,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
