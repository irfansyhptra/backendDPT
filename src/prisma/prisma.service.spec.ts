jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
  },
}));

import { PrismaService } from './prisma.service';

interface MockPrismaLifecycle {
  $connect: jest.MockedFunction<() => Promise<void>>;
  $disconnect: jest.MockedFunction<() => Promise<void>>;
}

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('connects when the module initializes', async () => {
    const prismaLifecycle = service as unknown as MockPrismaLifecycle;

    await service.onModuleInit();

    expect(prismaLifecycle.$connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the module is destroyed', async () => {
    const prismaLifecycle = service as unknown as MockPrismaLifecycle;

    await service.onModuleDestroy();

    expect(prismaLifecycle.$disconnect).toHaveBeenCalledTimes(1);
  });
});
