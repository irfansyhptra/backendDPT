import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

interface PrismaConnectionLifecycle {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await (this as unknown as PrismaConnectionLifecycle).$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await (this as unknown as PrismaConnectionLifecycle).$disconnect();
  }
}
