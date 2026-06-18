import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe Admin Update', description: 'Nama lengkap pengguna' })
  @IsOptional()
  @IsString({ message: 'Nama harus berupa string' })
  @MinLength(2, { message: 'Nama minimal terdiri dari 2 karakter' })
  name?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.VILLAGE_ADMIN, description: 'Peran baru pengguna' })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Peran tidak valid' })
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE, description: 'Status baru pengguna' })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'Status tidak valid' })
  status?: UserStatus;
}
