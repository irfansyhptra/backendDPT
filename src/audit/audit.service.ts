import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditOutcome, Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(
    userId: string | null,
    action: AuditAction,
    outcome: AuditOutcome,
    ipAddress: string,
    deviceInfo?: string,
    resource?: string,
    metadata?: Record<string, any>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        outcome,
        ipAddress,
        deviceInfo: deviceInfo || null,
        resource: resource || null,
        metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async queryLogs(filters: {
    userId?: string;
    action?: AuditAction;
    outcome?: AuditOutcome;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.outcome) {
      where.outcome = filters.outcome;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: data.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name || 'Anonymous',
        userEmail: log.user?.email || null,
        action: log.action,
        resource: log.resource,
        outcome: log.outcome,
        ipAddress: log.ipAddress,
        deviceInfo: log.deviceInfo,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
