import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    const emailLower = data.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: {
        email: emailLower,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException('Email ini sudah terdaftar');
    }

    return this.prisma.user.create({
      data: {
        ...data,
        email: emailLower,
      },
    });
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.email) {
      const emailLower = data.email.toLowerCase();
      const existing = await this.prisma.user.findFirst({
        where: {
          email: emailLower,
          id: { not: userId },
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException('Email ini sudah digunakan oleh akun lain');
      }
      updateData.email = emailLower;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async adminUpdateUser(
    userId: string,
    data: { name?: string; role?: UserRole; status?: UserStatus },
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.status) {
      updateData.status = data.status;
      if (data.status === UserStatus.ACTIVE) {
        updateData.failedLoginAttempts = 0;
        updateData.lockedUntil = null;
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async softDeleteUser(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: UserStatus.INACTIVE,
      },
    });
  }

  async incrementFailedLoginAttempts(userId: string): Promise<{ failedLoginAttempts: number; lockedUntil: Date | null }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { failedLoginAttempts: 0, lockedUntil: null };

    const attempts = user.failedLoginAttempts + 1;
    let lockedUntil: Date | null = null;

    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lockout
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
        status: lockedUntil ? UserStatus.LOCKED : user.status,
      },
    });

    return {
      failedLoginAttempts: updated.failedLoginAttempts,
      lockedUntil: updated.lockedUntil,
    };
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async findAllPaginated(filters: {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (filters.role) {
      where.role = filters.role;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
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
}
