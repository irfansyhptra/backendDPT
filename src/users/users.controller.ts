import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { SessionsService } from '../sessions/sessions.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, UserStatus, AuditAction, AuditOutcome } from '@prisma/client';
import { AdminUpdateUserDto } from './dto/users.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

function getDeviceInfo(req: Request) {
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  return {
    ipAddress: ipAddress.split(',')[0].trim(),
    userAgentString: userAgent,
  };
}

@ApiTags('User Administration')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN)
  @ApiOperation({ summary: 'Dapatkan daftar pengguna ter-paginasi (Admin saja)' })
  @ApiResponse({ status: 200, description: 'Daftar pengguna berhasil didapatkan.' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'search', required: false, description: 'Cari berdasarkan nama atau email' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUsers(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAllPaginated({
      role,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Put(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setujui akun pendaftaran pengguna (Admin saja)' })
  @ApiResponse({ status: 200, description: 'Akun berhasil disetujui.' })
  @ApiResponse({ status: 404, description: 'Pengguna tidak ditemukan.' })
  async approveUser(@Param('id') id: string, @Req() req: any) {
    const devInfo = getDeviceInfo(req);

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new BadRequestException('Pengguna tidak ditemukan');
    }

    if (user.status === UserStatus.ACTIVE) {
      return { message: 'Akun pengguna sudah aktif' };
    }

    const updatedUser = await this.usersService.adminUpdateUser(id, {
      status: UserStatus.ACTIVE,
    });

    // Log event
    await this.auditService.logEvent(
      req.user.id,
      AuditAction.USER_APPROVE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `users/${id}`,
      { approvedUserEmail: user.email },
    );

    // Send notification email
    await this.emailService.sendAccountApprovedEmail(updatedUser.email, updatedUser.name);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      status: updatedUser.status,
      message: 'Akun pengguna berhasil disetujui',
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN)
  @ApiOperation({ summary: 'Perbarui detail pengguna oleh Administrator (Admin saja)' })
  @ApiResponse({ status: 200, description: 'Detail pengguna berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Pengguna tidak ditemukan.' })
  async updateUser(
    @Param('id') id: string,
    @Body() adminUpdateUserDto: AdminUpdateUserDto,
    @Req() req: any,
  ) {
    const devInfo = getDeviceInfo(req);

    const targetUser = await this.usersService.findById(id);
    if (!targetUser) {
      throw new BadRequestException('Pengguna tidak ditemukan');
    }

    // Role-based restrictions: GOVERNMENT_ADMIN cannot change SUPER_ADMIN roles or edit them
    if (req.user.role === UserRole.GOVERNMENT_ADMIN && targetUser.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Pemerintah Daerah tidak memiliki izin untuk mengedit Super Admin');
    }

    const updatedUser = await this.usersService.adminUpdateUser(id, adminUpdateUserDto);

    const isRoleChanged = adminUpdateUserDto.role && adminUpdateUserDto.role !== targetUser.role;
    const isStatusInactive = adminUpdateUserDto.status && adminUpdateUserDto.status !== targetUser.status;

    // Log admin action
    let action: AuditAction = AuditAction.PROFILE_UPDATE;
    if (isRoleChanged) action = AuditAction.ROLE_CHANGE;
    else if (isStatusInactive) action = AuditAction.USER_DEACTIVATE;

    await this.auditService.logEvent(
      req.user.id,
      action,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `users/${id}`,
      { changes: adminUpdateUserDto },
    );

    // If role changed or deactivated, revoke all sessions
    if (isRoleChanged || adminUpdateUserDto.status === UserStatus.INACTIVE || adminUpdateUserDto.status === UserStatus.LOCKED) {
      await this.sessionsService.revokeAllUserSessions(id);
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      status: updatedUser.status,
      updatedAt: updatedUser.updatedAt,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus pengguna (Soft Delete - Super Admin saja)' })
  @ApiResponse({ status: 200, description: 'Pengguna berhasil dihapus secara logis.' })
  @ApiResponse({ status: 400, description: 'Mencoba menghapus akun sendiri.' })
  @ApiResponse({ status: 404, description: 'Pengguna tidak ditemukan.' })
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    if (id === req.user.id) {
      throw new BadRequestException('Anda tidak dapat menghapus akun Anda sendiri');
    }

    const devInfo = getDeviceInfo(req);

    const deletedUser = await this.usersService.softDeleteUser(id);

    // Invalidate sessions
    await this.sessionsService.revokeAllUserSessions(id);

    // Log deletion
    await this.auditService.logEvent(
      req.user.id,
      AuditAction.USER_DELETE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `users/${id}`,
      { deletedUserEmail: deletedUser.email },
    );

    return { message: 'Pengguna berhasil dihapus secara logis (soft delete)' };
  }
}
