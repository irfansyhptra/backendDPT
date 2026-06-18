import {
  IsString,
  IsNotEmpty,
  Length,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RiskLevel } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateEducationDto {
  @ApiProperty({ example: 'SMA', description: 'Tingkat pendidikan terakhir / sedang ditempuh' })
  @IsString()
  @IsNotEmpty({ message: 'Tingkat pendidikan tidak boleh kosong' })
  level!: string;

  @ApiProperty({ example: 'Lulus', description: 'Status pendidikan (Sekolah, Putus Sekolah, Lulus)' })
  @IsString()
  @IsNotEmpty({ message: 'Status pendidikan tidak boleh kosong' })
  status!: string;

  @ApiPropertyOptional({ example: 'SMAN 1 Caringin', description: 'Nama sekolah / universitas' })
  @IsOptional()
  @IsString()
  schoolName?: string;
}

export class CreateEmploymentDto {
  @ApiProperty({ example: 'Buruh Tani', description: 'Pekerjaan saat ini' })
  @IsString()
  @IsNotEmpty({ message: 'Pekerjaan tidak boleh kosong' })
  occupation!: string;

  @ApiProperty({ example: 'Bekerja', description: 'Status pekerjaan (Bekerja, Tidak Bekerja, PHK)' })
  @IsString()
  @IsNotEmpty({ message: 'Status pekerjaan tidak boleh kosong' })
  status!: string;

  @ApiProperty({ example: 1500000, description: 'Pendapatan bulanan dari pekerjaan ini' })
  @IsNumber()
  @Min(0, { message: 'Pendapatan tidak boleh negatif' })
  monthlyIncome!: number;

  @ApiPropertyOptional({ example: 'Perkebunan Sawit', description: 'Nama pemberi kerja / perusahaan' })
  @IsOptional()
  @IsString()
  employerName?: string;
}

export class CreateFamilyMemberDto {
  @ApiProperty({ example: 'Suryadi', description: 'Nama lengkap anggota keluarga' })
  @IsString()
  @IsNotEmpty({ message: 'Nama anggota keluarga tidak boleh kosong' })
  name!: string;

  @ApiProperty({ example: 'Kepala Keluarga', description: 'Hubungan dalam keluarga (Kepala Keluarga, Istri, Anak, Orang Tua, dll.)' })
  @IsString()
  @IsNotEmpty({ message: 'Hubungan keluarga tidak boleh kosong' })
  relationship!: string;

  @ApiProperty({ example: 42, description: 'Usia anggota keluarga' })
  @IsInt()
  @Min(0, { message: 'Usia tidak boleh negatif' })
  age!: number;

  @ApiPropertyOptional({ type: CreateEducationDto, description: 'Profil pendidikan anggota keluarga' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEducationDto)
  education?: CreateEducationDto;

  @ApiPropertyOptional({ type: CreateEmploymentDto, description: 'Profil pekerjaan anggota keluarga' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEmploymentDto)
  employment?: CreateEmploymentDto;
}

export class CreateIncomeDto {
  @ApiProperty({ example: 'Buruh Tani', description: 'Sumber pendapatan keluarga' })
  @IsString()
  @IsNotEmpty({ message: 'Sumber pendapatan tidak boleh kosong' })
  source!: string;

  @ApiProperty({ example: 1500000, description: 'Jumlah pendapatan bulanan' })
  @IsNumber()
  @Min(0, { message: 'Jumlah pendapatan tidak boleh negatif' })
  amount!: number;

  @ApiPropertyOptional({ example: 'Suryadi', description: 'Nama anggota keluarga penerima pendapatan' })
  @IsOptional()
  @IsString()
  recipientName?: string;
}

export class CreateAssetDto {
  @ApiProperty({ example: 'Sepeda Motor', description: 'Nama aset yang dimiliki' })
  @IsString()
  @IsNotEmpty({ message: 'Nama aset tidak boleh kosong' })
  name!: string;

  @ApiProperty({ example: 1200000, description: 'Estimasi nilai pasar aset' })
  @IsNumber()
  @Min(0, { message: 'Nilai aset tidak boleh negatif' })
  value!: number;

  @ApiPropertyOptional({ example: 'Honda Beat 2018', description: 'Keterangan aset' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateDebtDto {
  @ApiProperty({ example: 'Koperasi Desa', description: 'Sumber / kreditur utang' })
  @IsString()
  @IsNotEmpty({ message: 'Sumber utang tidak boleh kosong' })
  source!: string;

  @ApiProperty({ example: 4000000, description: 'Jumlah sisa utang saat ini' })
  @IsNumber()
  @Min(0, { message: 'Jumlah utang tidak boleh negatif' })
  amount!: number;

  @ApiProperty({ example: 300000, description: 'Jumlah angsuran bulanan' })
  @IsNumber()
  @Min(0, { message: 'Angsuran bulanan tidak boleh negatif' })
  monthlyPayment!: number;

  @ApiPropertyOptional({ example: 5, description: 'Persentase bunga utang' })
  @IsOptional()
  @IsNumber()
  interestRate?: number;
}

export class CreateFamilyDto {
  @ApiProperty({ example: '3201021204850001', description: 'Nomor Kartu Keluarga (16 digit)' })
  @IsString()
  @IsNotEmpty({ message: 'Nomor KK tidak boleh kosong' })
  @Length(16, 16, { message: 'Nomor KK harus tepat 16 digit' })
  kkNumber!: string;

  @ApiProperty({ example: 'Suryadi', description: 'Nama Kepala Keluarga' })
  @IsString()
  @IsNotEmpty({ message: 'Nama kepala keluarga tidak boleh kosong' })
  headName!: string;

  @ApiProperty({ example: 'RT 02 / RW 05, Desa Sukamaju', description: 'Alamat lengkap tempat tinggal' })
  @IsString()
  @IsNotEmpty({ message: 'Alamat tidak boleh kosong' })
  address!: string;

  @ApiProperty({ example: 'Desa Sukamaju', description: 'Nama Desa / Kelurahan' })
  @IsString()
  @IsNotEmpty({ message: 'Desa tidak boleh kosong' })
  village!: string;

  @ApiProperty({ example: 'Kecamatan Caringin', description: 'Nama Kecamatan' })
  @IsString()
  @IsNotEmpty({ message: 'Kecamatan tidak boleh kosong' })
  subDistrict!: string;

  @ApiProperty({ example: 1500000, description: 'Total pendapatan bulanan keluarga' })
  @IsNumber()
  @Min(0, { message: 'Pendapatan tidak boleh negatif' })
  monthlyIncome!: number;

  @ApiProperty({ example: 1650000, description: 'Total pengeluaran bulanan keluarga' })
  @IsNumber()
  @Min(0, { message: 'Pengeluaran tidak boleh negatif' })
  monthlyExpenses!: number;

  @ApiProperty({ example: false, description: 'Status kepemilikan rumah (true jika milik sendiri)' })
  @IsBoolean()
  ownsHouse!: boolean;

  @ApiProperty({ example: 'Tidak Layak', description: 'Kondisi fisik rumah (Layak Huni, Cukup Layak, Tidak Layak)' })
  @IsString()
  @IsNotEmpty({ message: 'Kondisi rumah tidak boleh kosong' })
  houseCondition!: string;

  @ApiProperty({ example: 4000000, description: 'Total utang keluarga saat ini' })
  @IsNumber()
  @Min(0, { message: 'Total utang tidak boleh negatif' })
  debtAmount!: number;

  @ApiProperty({ example: 1200000, description: 'Total nilai aset keluarga saat ini' })
  @IsNumber()
  @Min(0, { message: 'Total aset tidak boleh negatif' })
  assetValue!: number;

  @ApiPropertyOptional({ example: 82.5, description: 'Skor risiko kemiskinan (0 - 100)' })
  @IsOptional()
  @IsNumber()
  povertyRiskScore?: number;

  @ApiPropertyOptional({ enum: RiskLevel, example: RiskLevel.HIGH_RISK, description: 'Tingkat risiko kemiskinan' })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({ example: [65.0, 72.0, 78.0, 82.5], description: 'Riwayat skor risiko' })
  @IsOptional()
  @IsArray()
  scoreHistory?: number[];

  @ApiProperty({ type: [CreateFamilyMemberDto], description: 'Daftar anggota keluarga' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFamilyMemberDto)
  members!: CreateFamilyMemberDto[];

  @ApiPropertyOptional({ type: [CreateIncomeDto], description: 'Daftar rincian pendapatan' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIncomeDto)
  incomes?: CreateIncomeDto[];

  @ApiPropertyOptional({ type: [CreateAssetDto], description: 'Daftar rincian aset' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssetDto)
  assets?: CreateAssetDto[];

  @ApiPropertyOptional({ type: [CreateDebtDto], description: 'Daftar rincian utang' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebtDto)
  debts?: CreateDebtDto[];
}

export class UpdateFamilyDto extends PartialType(CreateFamilyDto) {}
export class UpdateFamilyMemberDto extends PartialType(CreateFamilyMemberDto) {}
export class UpdateIncomeDto extends PartialType(CreateIncomeDto) {}
export class UpdateAssetDto extends PartialType(CreateAssetDto) {}
export class UpdateDebtDto extends PartialType(CreateDebtDto) {}
