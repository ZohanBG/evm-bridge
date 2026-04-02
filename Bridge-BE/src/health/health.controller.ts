import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HealthIndicator,
  HealthIndicatorStatus,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      const status: HealthIndicatorStatus = 'down';
      return this.getStatus(key, false, { status, error: (error as Error).message });
    }
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly dbIndicator: PrismaHealthIndicator;

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {
    this.dbIndicator = new PrismaHealthIndicator(prisma);
  }

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Service health check' })
  check() {
    return this.health.check([
      () => this.dbIndicator.isHealthy('database'),
    ]);
  }
}
