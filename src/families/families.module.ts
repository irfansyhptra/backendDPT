import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FamiliesService } from './families.service';
import { FamiliesController } from './families.controller';

@Module({
  imports: [PrismaModule],
  providers: [FamiliesService],
  controllers: [FamiliesController],
  exports: [FamiliesService],
})
export class FamiliesModule {}
