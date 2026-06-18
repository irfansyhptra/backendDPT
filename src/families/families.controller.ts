import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { FamiliesService } from './families.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, AuditAction, AuditOutcome, RiskLevel } from '@prisma/client';
import {
  CreateFamilyDto,
  UpdateFamilyDto,
  CreateFamilyMemberDto,
  UpdateFamilyMemberDto,
} from './dto/families.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

function getDeviceInfo(req: Request) {
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  return {
    ipAddress: ipAddress.split(',')[0].trim(),
    userAgentString: userAgent,
  };
}

@ApiTags('Family Management')
@Controller('families')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FamiliesController {
  constructor(
    private readonly familiesService: FamiliesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.GOVERNMENT_ADMIN,
    UserRole.VILLAGE_ADMIN,
    UserRole.SOCIAL_WORKER,
    UserRole.RESEARCHER,
  )
  @ApiOperation({ summary: 'Dapatkan daftar keluarga ter-paginasi dengan filter' })
  @ApiResponse({ status: 200, description: 'Daftar keluarga berhasil didapatkan.' })
  @ApiQuery({ name: 'village', required: false })
  @ApiQuery({ name: 'riskLevel', required: false, enum: RiskLevel })
  @ApiQuery({ name: 'minPrs', required: false, type: Number })
  @ApiQuery({ name: 'maxPrs', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Cari berdasarkan nama kepala keluarga atau nomor KK' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFamilies(
    @Query('village') village?: string,
    @Query('riskLevel') riskLevel?: RiskLevel,
    @Query('minPrs') minPrs?: string,
    @Query('maxPrs') maxPrs?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.familiesService.findAll({
      village,
      riskLevel,
      minPrs: minPrs ? parseFloat(minPrs) : undefined,
      maxPrs: maxPrs ? parseFloat(maxPrs) : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.GOVERNMENT_ADMIN,
    UserRole.VILLAGE_ADMIN,
    UserRole.SOCIAL_WORKER,
    UserRole.RESEARCHER,
  )
  @ApiOperation({ summary: 'Dapatkan detail lengkap keluarga berdasarkan ID' })
  @ApiResponse({ status: 200, description: 'Detail keluarga berhasil didapatkan.' })
  @ApiResponse({ status: 404, description: 'Keluarga tidak ditemukan.' })
  async getFamilyById(@Param('id') id: string) {
    return this.familiesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN, UserRole.VILLAGE_ADMIN, UserRole.SOCIAL_WORKER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat data keluarga baru beserta rincian sub-entitas (Admin/Sosial)' })
  @ApiResponse({ status: 201, description: 'Data keluarga berhasil dibuat.' })
  @ApiResponse({ status: 400, description: 'Validasi input gagal.' })
  @ApiResponse({ status: 409, description: 'Nomor KK sudah terdaftar.' })
  async createFamily(@Body() createFamilyDto: CreateFamilyDto, @Req() req: any) {
    const devInfo = getDeviceInfo(req);
    const family = await this.familiesService.create(createFamilyDto);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.FAMILY_CREATE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `families/${family.id}`,
      { kkNumber: family.kkNumber, headName: family.headName },
    );

    return family;
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN, UserRole.VILLAGE_ADMIN, UserRole.SOCIAL_WORKER)
  @ApiOperation({ summary: 'Perbarui detail data keluarga (Admin/Sosial)' })
  @ApiResponse({ status: 200, description: 'Data keluarga berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Keluarga tidak ditemukan.' })
  async updateFamily(
    @Param('id') id: string,
    @Body() updateFamilyDto: UpdateFamilyDto,
    @Req() req: any,
  ) {
    const devInfo = getDeviceInfo(req);
    const family = await this.familiesService.update(id, updateFamilyDto);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.FAMILY_UPDATE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `families/${id}`,
      { changes: updateFamilyDto },
    );

    return family;
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN, UserRole.VILLAGE_ADMIN, UserRole.SOCIAL_WORKER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus data keluarga secara logis (Soft Delete)' })
  @ApiResponse({ status: 200, description: 'Data keluarga berhasil dihapus.' })
  @ApiResponse({ status: 404, description: 'Keluarga tidak ditemukan.' })
  async deleteFamily(@Param('id') id: string, @Req() req: any) {
    const devInfo = getDeviceInfo(req);
    const family = await this.familiesService.remove(id);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.FAMILY_DELETE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `families/${id}`,
      { kkNumber: family.kkNumber, headName: family.headName },
    );

    return { message: 'Data keluarga berhasil dihapus (soft delete)' };
  }

  @Post(':id/members')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN, UserRole.VILLAGE_ADMIN, UserRole.SOCIAL_WORKER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tambah anggota keluarga baru (Admin/Sosial)' })
  @ApiResponse({ status: 201, description: 'Anggota keluarga berhasil ditambahkan.' })
  async addMember(
    @Param('id') id: string,
    @Body() createFamilyMemberDto: CreateFamilyMemberDto,
    @Req() req: any,
  ) {
    const devInfo = getDeviceInfo(req);
    const member = await this.familiesService.addMember(id, createFamilyMemberDto);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.MEMBER_ADD,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `families/${id}/members/${member.id}`,
      { name: member.name, relationship: member.relationship },
    );

    return member;
  }

  @Put(':id/members/:memberId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN, UserRole.VILLAGE_ADMIN, UserRole.SOCIAL_WORKER)
  @ApiOperation({ summary: 'Perbarui data anggota keluarga beserta pendidikan/pekerjaan (Admin/Sosial)' })
  @ApiResponse({ status: 200, description: 'Data anggota keluarga berhasil diperbarui.' })
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateFamilyMemberDto: UpdateFamilyMemberDto,
    @Req() req: any,
  ) {
    const devInfo = getDeviceInfo(req);
    const member = await this.familiesService.updateMember(memberId, updateFamilyMemberDto);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.MEMBER_UPDATE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `families/${id}/members/${memberId}`,
      { changes: updateFamilyMemberDto },
    );

    return member;
  }

  @Delete(':id/members/:memberId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN, UserRole.VILLAGE_ADMIN, UserRole.SOCIAL_WORKER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus anggota keluarga (Admin/Sosial)' })
  @ApiResponse({ status: 200, description: 'Anggota keluarga berhasil dihapus.' })
  async deleteMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    const devInfo = getDeviceInfo(req);
    await this.familiesService.deleteMember(memberId);

    await this.auditService.logEvent(
      req.user.id,
      AuditAction.MEMBER_DELETE,
      AuditOutcome.SUCCESS,
      devInfo.ipAddress,
      devInfo.userAgentString,
      `families/${id}/members/${memberId}`,
    );

    return { message: 'Anggota keluarga berhasil dihapus' };
  }
}
