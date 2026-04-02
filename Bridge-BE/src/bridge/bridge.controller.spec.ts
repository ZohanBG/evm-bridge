import { Test, TestingModule } from '@nestjs/testing';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';

// Mock @prisma/client so BridgeEventType is defined at module load time
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  BridgeEventType: {
    TOKEN_LOCKED: 'TOKEN_LOCKED',
    TOKEN_CLAIMED: 'TOKEN_CLAIMED',
    TOKEN_BURNED: 'TOKEN_BURNED',
    TOKEN_RELEASED: 'TOKEN_RELEASED',
  },
  Prisma: { BridgeEventScalarFieldEnum: {} },
}));

// Mock ThrottlerGuard
jest.mock('@nestjs/throttler', () => ({
  ThrottlerGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

describe('BridgeController', () => {
  let controller: BridgeController;
  let service: BridgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BridgeController],
      providers: [
        {
          provide: BridgeService,
          useValue: {
            getTokensWaitingToClaim: jest.fn(),
            getTokensWaitingToRelease: jest.fn(),
            getBridgedTokensByWallet: jest.fn(),
            getAllBridgedTokens: jest.fn(),
            getBridgeStatistics: jest.fn(),
            getEventByTxHash: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BridgeController>(BridgeController);
    service = module.get<BridgeService>(BridgeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPendingClaims', () => {
    it('should return claims', async () => {
      const mockResult = { data: [], meta: {} };
      jest.spyOn(service, 'getTokensWaitingToClaim').mockResolvedValue(mockResult);

      const result = await controller.getPendingClaims({ page: 1, limit: 10 });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getPendingReleases', () => {
    it('should return releases', async () => {
      const mockResult = { data: [], meta: {} };
      jest.spyOn(service, 'getTokensWaitingToRelease').mockResolvedValue(mockResult);

      const result = await controller.getPendingReleases({ page: 1, limit: 10 });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBridgedTokensByWallet', () => {
    it('should return tokens by wallet', async () => {
      const wallet = '0x123...';
      const mockResult = { data: [], meta: {} };
      jest.spyOn(service, 'getBridgedTokensByWallet').mockResolvedValue(mockResult);

      const result = await controller.getBridgedTokensByWallet(wallet, 1, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllBridgedTokens', () => {
    it('should return all tokens', async () => {
      const mockResult = { data: [] };
      jest.spyOn(service, 'getAllBridgedTokens').mockResolvedValue(mockResult);

      const result = await controller.getAllBridgedTokens(1, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBridgeStatistics', () => {
    it('should return statistics', async () => {
      const mockResult = { totalTransactions: 10 };
      jest.spyOn(service, 'getBridgeStatistics').mockResolvedValue(mockResult);

      const result = await controller.getBridgeStatistics();
      expect(result).toEqual(mockResult);
    });
  });

  describe('getEventByTxHash', () => {
    it('should return event by txHash', async () => {
      const txHash = '0x123...';
      const mockResult = { id: 1 };
      jest.spyOn(service, 'getEventByTxHash').mockResolvedValue(mockResult);

      const result = await controller.getEventByTxHash(txHash);
      expect(result).toEqual(mockResult);
    });
  });
});