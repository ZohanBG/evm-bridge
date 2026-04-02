import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { BridgeModule } from './bridge/bridge.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TerminusModule,
    PrismaModule,
    BridgeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
