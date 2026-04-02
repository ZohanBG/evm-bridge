import { PrismaClient } from '@prisma/client';
import { CHAIN_CONFIGS } from '../config/chains.config';
import { ChainListenerService } from './ChainListener.service';
import { WitnessService } from './Witness.service';

export class IndexerService {
  private prisma: PrismaClient;
  private listeners: ChainListenerService[] = [];
  private witnessService: WitnessService;
  private isRunning: boolean = false;

  constructor() {
    this.prisma = new PrismaClient();
    this.witnessService = new WitnessService(this.prisma);
  }

  async start(): Promise<void> {
    console.log('Bridge Indexer Starting...\n');

    try {
      await this.prisma.$connect();
      console.log('Database connected\n');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }

    this.validateConfig();

    for (const chainConfig of CHAIN_CONFIGS) {
      if (!chainConfig.bridgeAddress) {
        console.warn(`Skipping ${chainConfig.name} - no bridge address configured`);
        continue;
      }

      const listener = new ChainListenerService(this.prisma, chainConfig);
      this.listeners.push(listener);
    }

    if (this.listeners.length === 0) {
      throw new Error('No valid chains configured');
    }

    this.isRunning = true;

    await Promise.all(this.listeners.map((l) => l.start()));
    await this.witnessService.start();

    console.log('\nIndexer is running...\n');
  }

  async stop(): Promise<void> {
    console.log('\nStopping indexer...');
    this.isRunning = false;

    await Promise.all(this.listeners.map((l) => l.stop()));
    await this.witnessService.stop();
    await this.prisma.$disconnect();

    console.log('Indexer stopped');
  }

  private validateConfig(): void {
    console.log('Validating configuration...\n');

    for (const chain of CHAIN_CONFIGS) {
      console.log(`  - ${chain.name}:`);
      console.log(`    Chain ID: ${chain.chainId}`);
      console.log(`    RPC: ${chain.rpcUrl}`);
      console.log(`    Bridge: ${chain.bridgeAddress || 'NOT SET'}`);
      console.log(`    Start Block: ${chain.startBlock}`);
    }

    console.log('');
  }
}