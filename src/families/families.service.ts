import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto, UpdateFamilyDto, CreateFamilyMemberDto, UpdateFamilyMemberDto } from './dto/families.dto';
import { Family, Prisma, RiskLevel } from '@prisma/client';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  private calculatePrsAndRiskLevel(data: {
    monthlyIncome: number;
    monthlyExpenses: number;
    ownsHouse: boolean;
    houseCondition: string;
    debtAmount: number;
    assetValue: number;
  }): { score: number; level: RiskLevel } {
    let score = 0.0;

    // Income factor
    if (data.monthlyIncome < 1000000) {
      score += 25;
    } else if (data.monthlyIncome < 1500000) {
      score += 15;
    } else if (data.monthlyIncome < 2500000) {
      score += 5;
    }

    // Expense factor
    if (data.monthlyExpenses > data.monthlyIncome) {
      score += 15;
    }

    // Housing factor
    if (!data.ownsHouse) {
      score += 10;
    }
    const cond = (data.houseCondition || '').toLowerCase();
    if (cond.includes('tidak layak')) {
      score += 20;
    } else if (cond.includes('cukup layak') || cond.includes('sedang')) {
      score += 10;
    }

    // Debt factor
    if (data.debtAmount > 5000000) {
      score += 15;
    } else if (data.debtAmount > 2000000) {
      score += 8;
    }

    // Asset factor
    if (data.assetValue < 500000) {
      score += 15;
    } else if (data.assetValue < 1500000) {
      score += 8;
    }

    // Cap at 0 - 100
    score = Math.max(0, Math.min(100, score));

    // Determine risk level
    let level: RiskLevel = RiskLevel.SAFE;
    if (score >= 85) {
      level = RiskLevel.CRITICAL;
    } else if (score >= 70) {
      level = RiskLevel.HIGH_RISK;
    } else if (score >= 50) {
      level = RiskLevel.WARNING;
    } else if (score >= 30) {
      level = RiskLevel.VULNERABLE;
    }

    return { score, level };
  }

  async create(dto: CreateFamilyDto): Promise<Family> {
    const existing = await this.prisma.family.findFirst({
      where: {
        kkNumber: dto.kkNumber,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Nomor Kartu Keluarga sudah terdaftar');
    }

    const { score, level } = this.calculatePrsAndRiskLevel({
      monthlyIncome: dto.monthlyIncome,
      monthlyExpenses: dto.monthlyExpenses,
      ownsHouse: dto.ownsHouse,
      houseCondition: dto.houseCondition,
      debtAmount: dto.debtAmount,
      assetValue: dto.assetValue,
    });

    const povertyRiskScore = dto.povertyRiskScore ?? score;
    const riskLevel = dto.riskLevel ?? level;
    const scoreHistory = dto.scoreHistory ?? [povertyRiskScore];

    return this.prisma.$transaction(async (tx) => {
      return tx.family.create({
        data: {
          kkNumber: dto.kkNumber,
          headName: dto.headName,
          address: dto.address,
          village: dto.village,
          subDistrict: dto.subDistrict,
          monthlyIncome: dto.monthlyIncome,
          monthlyExpenses: dto.monthlyExpenses,
          ownsHouse: dto.ownsHouse,
          houseCondition: dto.houseCondition,
          debtAmount: dto.debtAmount,
          assetValue: dto.assetValue,
          povertyRiskScore,
          riskLevel,
          scoreHistory,
          members: {
            create: dto.members.map((m) => ({
              name: m.name,
              relationship: m.relationship,
              age: m.age,
              education: m.education
                ? {
                    create: {
                      level: m.education.level,
                      status: m.education.status,
                      schoolName: m.education.schoolName || null,
                    },
                  }
                : undefined,
              employment: m.employment
                ? {
                    create: {
                      occupation: m.employment.occupation,
                      status: m.employment.status,
                      monthlyIncome: m.employment.monthlyIncome,
                      employerName: m.employment.employerName || null,
                    },
                  }
                : undefined,
            })),
          },
          incomes: dto.incomes
            ? {
                create: dto.incomes.map((i) => ({
                  source: i.source,
                  amount: i.amount,
                  recipientName: i.recipientName || null,
                })),
              }
            : undefined,
          assets: dto.assets
            ? {
                create: dto.assets.map((a) => ({
                  name: a.name,
                  value: a.value,
                  description: a.description || null,
                })),
              }
            : undefined,
          debts: dto.debts
            ? {
                create: dto.debts.map((d) => ({
                  source: d.source,
                  amount: d.amount,
                  monthlyPayment: d.monthlyPayment,
                  interestRate: d.interestRate || null,
                })),
              }
            : undefined,
        },
        include: {
          members: {
            include: {
              education: true,
              employment: true,
            },
          },
          incomes: true,
          assets: true,
          debts: true,
        },
      });
    });
  }

  async findAll(filters: {
    village?: string;
    riskLevel?: RiskLevel;
    minPrs?: number;
    maxPrs?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FamilyWhereInput = {
      deletedAt: null,
    };

    if (filters.village) {
      where.village = filters.village;
    }
    if (filters.riskLevel) {
      where.riskLevel = filters.riskLevel;
    }

    if (filters.minPrs !== undefined || filters.maxPrs !== undefined) {
      where.povertyRiskScore = {};
      if (filters.minPrs !== undefined) {
        where.povertyRiskScore.gte = filters.minPrs;
      }
      if (filters.maxPrs !== undefined) {
        where.povertyRiskScore.lte = filters.maxPrs;
      }
    }

    if (filters.search) {
      where.OR = [
        { headName: { contains: filters.search, mode: 'insensitive' } },
        { kkNumber: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.family.count({ where }),
      this.prisma.family.findMany({
        where,
        include: {
          members: {
            include: {
              education: true,
              employment: true,
            },
          },
        },
        orderBy: {
          povertyRiskScore: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Family> {
    const family = await this.prisma.family.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        members: {
          include: {
            education: true,
            employment: true,
          },
        },
        incomes: true,
        assets: true,
        debts: true,
      },
    });

    if (!family) {
      throw new NotFoundException('Keluarga tidak ditemukan');
    }

    return family;
  }

  async update(id: string, dto: UpdateFamilyDto): Promise<Family> {
    const family = await this.findOne(id);

    // Calculate new PRS if metrics are updated
    const incomeVal = dto.monthlyIncome ?? family.monthlyIncome;
    const expenseVal = dto.monthlyExpenses ?? family.monthlyExpenses;
    const ownsHouseVal = dto.ownsHouse ?? family.ownsHouse;
    const condVal = dto.houseCondition ?? family.houseCondition;
    const debtVal = dto.debtAmount ?? family.debtAmount;
    const assetVal = dto.assetValue ?? family.assetValue;

    const { score, level } = this.calculatePrsAndRiskLevel({
      monthlyIncome: incomeVal,
      monthlyExpenses: expenseVal,
      ownsHouse: ownsHouseVal,
      houseCondition: condVal,
      debtAmount: debtVal,
      assetValue: assetVal,
    });

    const povertyRiskScore = dto.povertyRiskScore ?? score;
    const riskLevel = dto.riskLevel ?? level;

    // Track score changes in history
    let scoreHistory = family.scoreHistory;
    if (povertyRiskScore !== family.povertyRiskScore) {
      scoreHistory = [...family.scoreHistory, povertyRiskScore];
    }

    return this.prisma.$transaction(async (tx) => {
      // Handle relations overwrite if provided in DTO
      if (dto.members) {
        await tx.familyMember.deleteMany({ where: { familyId: id } });
      }
      if (dto.incomes) {
        await tx.income.deleteMany({ where: { familyId: id } });
      }
      if (dto.assets) {
        await tx.asset.deleteMany({ where: { familyId: id } });
      }
      if (dto.debts) {
        await tx.debt.deleteMany({ where: { familyId: id } });
      }

      return tx.family.update({
        where: { id },
        data: {
          kkNumber: dto.kkNumber,
          headName: dto.headName,
          address: dto.address,
          village: dto.village,
          subDistrict: dto.subDistrict,
          monthlyIncome: incomeVal,
          monthlyExpenses: expenseVal,
          ownsHouse: ownsHouseVal,
          houseCondition: condVal,
          debtAmount: debtVal,
          assetValue: assetVal,
          povertyRiskScore,
          riskLevel,
          scoreHistory,
          lastAssessment: new Date(),
          members: dto.members
            ? {
                create: dto.members.map((m) => ({
                  name: m.name,
                  relationship: m.relationship,
                  age: m.age,
                  education: m.education
                    ? {
                        create: {
                          level: m.education.level,
                          status: m.education.status,
                          schoolName: m.education.schoolName || null,
                        },
                      }
                    : undefined,
                  employment: m.employment
                    ? {
                        create: {
                          occupation: m.employment.occupation,
                          status: m.employment.status,
                          monthlyIncome: m.employment.monthlyIncome,
                          employerName: m.employment.employerName || null,
                        },
                      }
                    : undefined,
                })),
              }
            : undefined,
          incomes: dto.incomes
            ? {
                create: dto.incomes.map((i) => ({
                  source: i.source,
                  amount: i.amount,
                  recipientName: i.recipientName || null,
                })),
              }
            : undefined,
          assets: dto.assets
            ? {
                create: dto.assets.map((a) => ({
                  name: a.name,
                  value: a.value,
                  description: a.description || null,
                })),
              }
            : undefined,
          debts: dto.debts
            ? {
                create: dto.debts.map((d) => ({
                  source: d.source,
                  amount: d.amount,
                  monthlyPayment: d.monthlyPayment,
                  interestRate: d.interestRate || null,
                })),
              }
            : undefined,
        },
        include: {
          members: {
            include: {
              education: true,
              employment: true,
            },
          },
          incomes: true,
          assets: true,
          debts: true,
        },
      });
    });
  }

  async remove(id: string): Promise<Family> {
    await this.findOne(id);
    return this.prisma.family.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Sub-member Specific Operations
  async addMember(familyId: string, dto: CreateFamilyMemberDto) {
    await this.findOne(familyId);
    return this.prisma.familyMember.create({
      data: {
        familyId,
        name: dto.name,
        relationship: dto.relationship,
        age: dto.age,
        education: dto.education
          ? {
              create: {
                level: dto.education.level,
                status: dto.education.status,
                schoolName: dto.education.schoolName || null,
              },
            }
          : undefined,
        employment: dto.employment
          ? {
              create: {
                occupation: dto.employment.occupation,
                status: dto.employment.status,
                monthlyIncome: dto.employment.monthlyIncome,
                employerName: dto.employment.employerName || null,
              },
            }
          : undefined,
      },
      include: {
        education: true,
        employment: true,
      },
    });
  }

  async updateMember(memberId: string, dto: UpdateFamilyMemberDto) {
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      include: { education: true, employment: true },
    });

    if (!member) {
      throw new NotFoundException('Anggota keluarga tidak ditemukan');
    }

    return this.prisma.$transaction(async (tx) => {
      // Handle nested updates/upserts
      if (dto.education) {
        await tx.education.upsert({
          where: { memberId },
          create: {
            memberId,
            level: dto.education.level || '',
            status: dto.education.status || '',
            schoolName: dto.education.schoolName || null,
          },
          update: {
            level: dto.education.level,
            status: dto.education.status,
            schoolName: dto.education.schoolName || null,
          },
        });
      }

      if (dto.employment) {
        await tx.employment.upsert({
          where: { memberId },
          create: {
            memberId,
            occupation: dto.employment.occupation || '',
            status: dto.employment.status || '',
            monthlyIncome: dto.employment.monthlyIncome || 0,
            employerName: dto.employment.employerName || null,
          },
          update: {
            occupation: dto.employment.occupation,
            status: dto.employment.status,
            monthlyIncome: dto.employment.monthlyIncome,
            employerName: dto.employment.employerName || null,
          },
        });
      }

      return tx.familyMember.update({
        where: { id: memberId },
        data: {
          name: dto.name,
          relationship: dto.relationship,
          age: dto.age,
        },
        include: {
          education: true,
          employment: true,
        },
      });
    });
  }

  async deleteMember(memberId: string) {
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Anggota keluarga tidak ditemukan');
    }

    await this.prisma.familyMember.delete({
      where: { id: memberId },
    });
  }
}
