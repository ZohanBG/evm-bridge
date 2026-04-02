import { Test, TestingModule } from '@nestjs/testing';
import { BridgeService } from './bridge.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaClient = {
  bridgeEvent: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    findFirst: jest.fn(),
    aggregate: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
  $connect: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
  BridgeEventType: {
    TOKEN_LOCKED: 'TOKEN_LOCKED',
    TOKEN_CLAIMED: 'TOKEN_CLAIMED',
    TOKEN_BURNED: 'TOKEN_BURNED',
    TOKEN_RELEASED: 'TOKEN_RELEASED',
  },
  Prisma: { BridgeEventScalarFieldEnum: {} },
}));

describe('BridgeService', () => {
  let service: BridgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BridgeService,
        {
          provide: PrismaService,
          useValue: mockPrismaClient,
        },
      ],
    }).compile();

    service = module.get<BridgeService>(BridgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTokensWaitingToClaim', () => {
    it('should return paginated claims', async () => {
      const mockData = [{ id: 1, tokenAddress: '0x...', amount: '100' }];
      const mockMeta = { total: 1, page: 1, limit: 10, totalPages: 1 };

      const prismaClient = (service as any).prisma;
      jest.spyOn(prismaClient.bridgeEvent, 'findMany').mockResolvedValue(mockData);
      jest.spyOn(prismaClient.bridgeEvent, 'count').mockResolvedValue(1);
      jest.spyOn(service as any, 'serializeBridgeEvent').mockReturnValue(mockData[0]);

      const result = await service.getTokensWaitingToClaim({ page: 1, limit: 10 });
      expect(result).toEqual({ data: mockData, meta: mockMeta });
    });
  });

  describe('getTokensWaitingToRelease', () => {
    it('should return paginated releases', async () => {
      const mockData = [{ id: 1, tokenAddress: '0x...', amount: '100' }];
      const mockMeta = { total: 1, page: 1, limit: 10, totalPages: 1 };

      const prismaClient = (service as any).prisma;
      jest.spyOn(prismaClient.bridgeEvent, 'findMany').mockResolvedValue(mockData);
      jest.spyOn(prismaClient.bridgeEvent, 'count').mockResolvedValue(1);
      jest.spyOn(service as any, 'serializeBridgeEvent').mockReturnValue(mockData[0]);

      const result = await service.getTokensWaitingToRelease({ page: 1, limit: 10 });
      expect(result).toEqual({ data: mockData, meta: mockMeta });
    });
  });

  describe('getBridgedTokensByWallet', () => {
    it('should return paginated tokens by wallet', async () => {
      const mockData = [{ id: 1, tokenAddress: '0x...', amount: '100' }];
      const mockMeta = { total: 1, page: 1, limit: 10, totalPages: 1 };

      const prismaClient = (service as any).prisma;
      jest.spyOn(prismaClient.bridgeEvent, 'findMany').mockResolvedValue(mockData);
      jest.spyOn(prismaClient.bridgeEvent, 'count').mockResolvedValue(1);
      jest.spyOn(service as any, 'serializeBridgeEvent').mockReturnValue(mockData[0]);

      const result = await service.getBridgedTokensByWallet({ address: '0x123' }, { page: 1, limit: 10 });
      expect(result).toEqual({ data: mockData, meta: mockMeta });
    });
  });

    describe('getAllBridgedTokens', () => {
      it('should return all bridged tokens', async () => {
        const mockGrouped = [{ tokenAddress: '0x...', chainId: 1, _count: { _all: 1 }, _sum: { amount: 100n }, _min: { blockTimestamp: new Date() }, _max: { blockTimestamp: new Date() } }];
        const mockData = [{ tokenAddress: '0x...', chainId: 1, eventCount: 1, totalVolume: '100', firstBridgedAt: new Date(), lastBridgedAt: new Date() }];  // Fixed chainId to number
    
        const prismaClient = (service as any).prisma;
        jest.spyOn(prismaClient.bridgeEvent, 'groupBy').mockResolvedValue(mockGrouped);
    
        const result = await service.getAllBridgedTokens({ page: 1, limit: 10 });
        expect(result).toEqual({ data: mockData });
      });
    });
    
  describe('getEventByTxHash', () => {
    it('should return event by txHash', async () => {
      const mockEvent = { id: 1, txHash: '0x123' };
      const prismaClient = (service as any).prisma;
      jest.spyOn(prismaClient.bridgeEvent, 'findFirst').mockResolvedValue(mockEvent);
      jest.spyOn(service as any, 'serializeBridgeEvent').mockReturnValue(mockEvent);

      const result = await service.getEventByTxHash('0x123');
      expect(result).toEqual(mockEvent);
    });

    it('should throw NotFoundException if event not found', async () => {
      const prismaClient = (service as any).prisma;
      jest.spyOn(prismaClient.bridgeEvent, 'findFirst').mockResolvedValue(null);

      await expect(service.getEventByTxHash('0x123')).rejects.toThrow('Event with witness hash 0x123 not found');
    });
  });

  describe('getBridgeStatistics', () => {
    it('should return bridge statistics', async () => {
      const mockStats = {
        totalTransactions: 10,
        totalVolume: '1000',
        uniqueTokens: 2,
        uniqueUsers: 2,
        pendingClaims: 10,
        pendingReleases: 10,
      };

      const prismaClient = (service as any).prisma;
      jest.spyOn(prismaClient.bridgeEvent, 'count').mockResolvedValue(10);
      jest.spyOn(prismaClient.bridgeEvent, 'findMany').mockImplementation((args) => {
        if (args.distinct?.includes('tokenAddress')) return [{ tokenAddress: '0x1' }, { tokenAddress: '0x2' }];
        if (args.distinct?.includes('fromAddress')) return [{ fromAddress: '0x1' }];
        if (args.distinct?.includes('toAddress')) return [{ toAddress: '0x2' }];
        return [];
      });
      jest.spyOn(prismaClient.bridgeEvent, 'aggregate').mockResolvedValue({ _sum: { amount: 1000n } });

      const result = await service.getBridgeStatistics();
      expect(result).toEqual(mockStats);
    });

    it('should return bridge statistics with chainId', async () => {
      const mockStats = {
        totalTransactions: 10,
        totalVolume: '1000',
        uniqueTokens: 2,
        uniqueUsers: 2,
        pendingClaims: 10,
        pendingReleases: 10,
      };

      const prismaClient = (service as any).prisma;
      jest.spyOn(prismaClient.bridgeEvent, 'count').mockResolvedValue(10);
      jest.spyOn(prismaClient.bridgeEvent, 'findMany').mockImplementation((args) => {
        if (args.distinct?.includes('tokenAddress')) return [{ tokenAddress: '0x1' }, { tokenAddress: '0x2' }];
        if (args.distinct?.includes('fromAddress')) return [{ fromAddress: '0x1' }];
        if (args.distinct?.includes('toAddress')) return [{ toAddress: '0x2' }];
        return [];
      });
      jest.spyOn(prismaClient.bridgeEvent, 'aggregate').mockResolvedValue({ _sum: { amount: 1000n } });

      const result = await service.getBridgeStatistics(1);
      expect(result).toEqual(mockStats);
    });
  });

  describe('toStr', () => {
    it('should convert bigint to string', () => {
      const result = (service as any).toStr(123n);
      expect(result).toBe('123');
    });

    it('should return non-bigint as is', () => {
      const result = (service as any).toStr('123');
      expect(result).toBe('123');
    });
  });

  describe('serializeBridgeEvent', () => {
    it('should serialize event', () => {
      const event = { id: 1, eventType: 'TOKEN_LOCKED', chainId: 1, amount: 100n };
      const result = (service as any).serializeBridgeEvent(event);
      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('amount', '100');
    });
  });
});