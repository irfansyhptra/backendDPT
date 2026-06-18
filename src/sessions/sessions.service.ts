import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    deviceInfo: {
      deviceType: string;
      deviceName: string;
      os: string;
      browser?: string;
      ipAddress: string;
    },
    expiresAt: Date,
  ): Promise<Session> {
    const accessTokenHash = this.hashToken(accessToken);
    const refreshTokenHash = this.hashToken(refreshToken);

    return this.prisma.session.create({
      data: {
        userId,
        accessTokenHash,
        refreshTokenHash,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
        os: deviceInfo.os,
        browser: deviceInfo.browser || null,
        ipAddress: deviceInfo.ipAddress,
        expiresAt,
      },
    });
  }

  async findUserSessions(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
      },
      orderBy: {
        lastActivity: 'desc',
      },
    });
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const refreshTokenHash = this.hashToken(refreshToken);
    return this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
        expiresAt: { gte: new Date() },
      },
    });
  }

  async revokeSession(sessionId: string, userId?: string): Promise<void> {
    const where: any = { id: sessionId };
    if (userId) {
      where.userId = userId;
    }

    const session = await this.prisma.session.findFirst({ where });
    if (!session) {
      throw new NotFoundException('Sesi tidak ditemukan atau sudah dicabut');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async updateSessionActivity(sessionId: string, newRefreshToken?: string): Promise<void> {
    const data: any = {
      lastActivity: new Date(),
    };

    if (newRefreshToken) {
      data.refreshTokenHash = this.hashToken(newRefreshToken);
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data,
    });
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { lastActivity: { lte: thirtyDaysAgo } },
        ],
      },
    });

    return result.count;
  }
}
