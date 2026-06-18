import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Alamat email pengguna' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Kata sandi pengguna (min 8 karakter, huruf besar, huruf kecil, angka, spesial)' })
  @IsString({ message: 'Kata sandi harus berupa string' })
  @IsNotEmpty({ message: 'Kata sandi tidak boleh kosong' })
  password!: string;

  @ApiProperty({ example: 'John Doe', description: 'Nama lengkap pengguna' })
  @IsString({ message: 'Nama harus berupa string' })
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @MinLength(2, { message: 'Nama minimal terdiri dari 2 karakter' })
  name!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SOCIAL_WORKER, description: 'Peran pengguna dalam sistem' })
  @IsEnum(UserRole, { message: 'Peran tidak valid' })
  @IsNotEmpty({ message: 'Peran tidak boleh kosong' })
  role!: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Alamat email pengguna' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Kata sandi pengguna' })
  @IsString({ message: 'Kata sandi harus berupa string' })
  @IsNotEmpty({ message: 'Kata sandi tidak boleh kosong' })
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Alamat email pengguna untuk pengiriman token reset' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token reset kata sandi yang dikirimkan via email' })
  @IsString({ message: 'Token harus berupa string' })
  @IsNotEmpty({ message: 'Token tidak boleh kosong' })
  token!: string;

  @ApiProperty({ example: 'NewSecurePass123!', description: 'Kata sandi baru pengguna' })
  @IsString({ message: 'Kata sandi harus berupa string' })
  @IsNotEmpty({ message: 'Kata sandi tidak boleh kosong' })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'SecurePass123!', description: 'Kata sandi saat ini' })
  @IsString({ message: 'Kata sandi saat ini harus berupa string' })
  @IsNotEmpty({ message: 'Kata sandi saat ini tidak boleh kosong' })
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecurePass123!', description: 'Kata sandi baru yang memenuhi kebijakan keamanan' })
  @IsString({ message: 'Kata sandi baru harus berupa string' })
  @IsNotEmpty({ message: 'Kata sandi baru tidak boleh kosong' })
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe Edit', description: 'Nama lengkap baru pengguna' })
  @IsOptional()
  @IsString({ message: 'Nama harus berupa string' })
  @MinLength(2, { message: 'Nama minimal terdiri dari 2 karakter' })
  name?: string;

  @ApiPropertyOptional({ example: 'newemail@example.com', description: 'Alamat email baru pengguna' })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  email?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'JWT Refresh Token yang valid' })
  @IsString({ message: 'Refresh token harus berupa string' })
  @IsNotEmpty({ message: 'Refresh token tidak boleh kosong' })
  refreshToken!: string;
}
