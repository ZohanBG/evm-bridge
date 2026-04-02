 import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Bridge API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/bridge (GET)', () => {
    it('should return tokens waiting to claim', async () => {
      const response = await request(app.getHttpServer())
        .get('/bridge/pending/claims')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return tokens waiting to release', async () => {
      const response = await request(app.getHttpServer())
        .get('/bridge/pending/releases')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return bridged tokens by wallet', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const response = await request(app.getHttpServer())
        .get(`/bridge/wallet/${walletAddress}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return all bridged tokens', async () => {
      const response = await request(app.getHttpServer())
        .get('/bridge/tokens')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return bridge statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/bridge/statistics');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalTransactions');
      expect(response.body).toHaveProperty('totalVolume');
      expect(response.body).toHaveProperty('uniqueTokens');
      expect(response.body).toHaveProperty('uniqueUsers');
      expect(response.body).toHaveProperty('pendingClaims');
      expect(response.body).toHaveProperty('pendingReleases');
    });

    it('should return event by txHash', async () => {
      const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const response = await request(app.getHttpServer())
        .get(`/bridge/event/${txHash}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limit', async () => {
      let rateLimited = false;
      for (let i = 0; i < 105; i++) {
        const response = await request(app.getHttpServer()).get('/bridge/statistics');
        if (response.status === 429) {
          rateLimited = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(rateLimited).toBe(true);
    });
  });
});