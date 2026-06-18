import { Test, TestingModule } from '@nestjs/testing';
import { FamiliesService } from './families.service';
import { PrismaService } from '../prisma/prisma.service';
import { RiskLevel, UserRole } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('FamiliesService', () => {
  let service: FamiliesService;
  let prismaService: any;

  beforeEach(async () => {
    const mockPrismaService: any = {
      family: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      familyMember: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      education: {
        upsert: jest.fn(),
      },
      employment: {
        upsert: jest.fn(),
      },
      income: {
        deleteMany: jest.fn(),
      },
      asset: {
        deleteMany: jest.fn(),
      },
      debt: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamiliesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FamiliesService>(FamiliesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto = {
      kkNumber: '3201021204850001',
      headName: 'Suryadi',
      address: 'RT 02 / RW 05, Desa Sukamaju',
      village: 'Desa Sukamaju',
      subDistrict: 'Kecamatan Caringin',
      monthlyIncome: 1200000,
      monthlyExpenses: 1400000,
      ownsHouse: false,
      houseCondition: 'Tidak Layak',
      debtAmount: 4000000,
      assetValue: 1200000,
      members: [
        {
          name: 'Suryadi',
          relationship: 'Kepala Keluarga',
          age: 42,
          education: { level: 'SD', status: 'Lulus' },
          employment: { occupation: 'Buruh Tani', status: 'Bekerja', monthlyIncome: 1200000 },
        },
      ],
    };

    it('should create a new family record and calculate high risk PRS correctly', async () => {
      prismaService.family.findFirst.mockResolvedValue(null);
      prismaService.family.create.mockImplementation((args: any) => ({
        id: 'family-uuid',
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const result = await service.create(createDto as any);

      expect(result.id).toBe('family-uuid');
      expect(prismaService.family.findFirst).toHaveBeenCalled();
      
      // Low income (1.2m -> +15), expenses > income (+15), no house (+10), tidak layak (+20), debt > 2m (+8), asset < 1.5m (+8) = base 30 + 76 = 106 capped at 100 -> CRITICAL/HIGH_RISK
      expect(result.povertyRiskScore).toBeGreaterThanOrEqual(70);
      expect(result.riskLevel).toBe(RiskLevel.HIGH_RISK);
    });

    it('should calculate low risk for well-off families', async () => {
      prismaService.family.findFirst.mockResolvedValue(null);
      prismaService.family.create.mockImplementation((args: any) => ({
        id: 'family-uuid',
        ...args.data,
      }));

      const wellOffDto = {
        ...createDto,
        monthlyIncome: 6000000,
        monthlyExpenses: 4000000,
        ownsHouse: true,
        houseCondition: 'Layak Huni',
        debtAmount: 0,
        assetValue: 50000000,
        members: [],
      };

      const result = await service.create(wellOffDto as any);
      expect(result.riskLevel).toBe(RiskLevel.SAFE);
      expect(result.povertyRiskScore).toBe(0.0); // No points added -> base 0
    });

    it('should throw ConflictException if KK number already exists', async () => {
      prismaService.family.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create(createDto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of families', async () => {
      prismaService.family.count.mockResolvedValue(1);
      prismaService.family.findMany.mockResolvedValue([
        { id: 'fam-1', headName: 'Suryadi', povertyRiskScore: 82.5 },
      ]);

      const result = await service.findAll({ village: 'Desa Sukamaju' });

      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(prismaService.family.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            village: 'Desa Sukamaju',
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return family by ID', async () => {
      const mockFamily = { id: 'fam-1', headName: 'Suryadi' };
      prismaService.family.findFirst.mockResolvedValue(mockFamily);

      const result = await service.findOne('fam-1');
      expect(result).toEqual(mockFamily);
    });

    it('should throw NotFoundException if family is not found', async () => {
      prismaService.family.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete the family', async () => {
      prismaService.family.findFirst.mockResolvedValue({ id: 'fam-1' });
      prismaService.family.update.mockResolvedValue({ id: 'fam-1', deletedAt: new Date() });

      await service.remove('fam-1');

      expect(prismaService.family.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fam-1' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('member operations', () => {
    it('should add a family member', async () => {
      prismaService.family.findFirst.mockResolvedValue({ id: 'fam-1' });
      prismaService.familyMember.create.mockResolvedValue({ id: 'member-1', name: 'Rian' });

      const result = await service.addMember('fam-1', {
        name: 'Rian',
        relationship: 'Anak',
        age: 14,
      });

      expect(result.name).toBe('Rian');
      expect(prismaService.familyMember.create).toHaveBeenCalled();
    });

    it('should delete a family member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({ id: 'member-1' });
      prismaService.familyMember.delete.mockResolvedValue({ id: 'member-1' });

      await service.deleteMember('member-1');

      expect(prismaService.familyMember.delete).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
    });
  });
});
