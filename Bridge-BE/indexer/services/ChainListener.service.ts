import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { ChainConfig, INDEXER_CONFIG } from '../config/chains.config';
import { EventParserService } from './EventParser.service';
import { BridgeEventType } from '../types/events.types';

// Updated ABI matching redesigned Bridge.sol event signatures
const BRIDGE_ABI = [
  'event TokenLocked(address indexed token, address indexed from, uint256 amount, uint256 fee, uint256 indexed targetChainId, uint256 sourceChainId, uint256 nonce, bytes32 txHash)',
  'event TokenClaimed(address indexed wrappedToken, address indexed to, uint256 amount, uint256 fee, address relayer, uint256 sourceChainId, uint256 targetChainId, bytes32 indexed txHash)',
  'event TokenBurned(address indexed wrappedToken, address indexed from, uint256 amount, uint256 fee, uint256 indexed targetChainId, uint256 sourceChainId, uint256 nonce, bytes32 txHash)',
  'event TokenReleased(address indexed token, address indexed to, uint256 amount, uint256 fee, address relayer, uint256 sourceChainId, uint256 targetChainId, bytes32 indexed txHash)',
  'function lockRoutes(uint256 targetChainId, address originalToken) view returns (address)',
  'function burnRoutes(address wrappedToken) view returns (address)',
];

// Circuit breaker thresholds
const MAX_CONSECUTIVE_FAILURES = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000; // 30s pause after hitting failure threshold
const MAX_TOKEN_CACHE_SIZE = 500;

export class ChainListenerService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private eventParser: EventParserService;
  private isRunning = false;
  private currentBlock = 0;

  // Cache token mappings to avoid repeated RPC calls (issue #43)
  private tokenMappingCache = new Map<string, string>();

  // Circuit breaker state
  private consecutiveFailures = 0;

  constructor(
    private prisma: PrismaClient,
    private chainConfig: ChainConfig,
  ) {
    this.provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    this.contract  = new ethers.Contract(chainConfig.bridgeAddress, BRIDGE_ABI, this.provider);
    this.eventParser = new EventParserService();
  }

  async start(): Promise<void> {
    console.log(`\nStarting listener for ${this.chainConfig.name}`);
    console.log(`RPC: ${this.chainConfig.rpcUrl}`);
    console.log(`Bridge: ${this.chainConfig.bridgeAddress}`);

    let checkpoint = await this.prisma.indexerCheckpoint.findUnique({
      where: { chainId: this.chainConfig.chainId },
    });

    if (!checkpoint) {
      checkpoint = await this.prisma.indexerCheckpoint.create({
        data: {
          chainId: this.chainConfig.chainId,
          lastProcessedBlock: BigInt(this.chainConfig.startBlock - 1),
          lastProcessedLogIndex: 0,
          isHealthy: true,
        },
      });
    }

    this.currentBlock = Number(checkpoint.lastProcessedBlock) + 1;
    console.log(`Starting from block: ${this.currentBlock}\n`);

    this.isRunning = true;
    this.poll();
  }

  async stop(): Promise<void> {
    console.log(`\nStopping listener for ${this.chainConfig.name}`);
    this.isRunning = false;
    this.provider.destroy();
    this.tokenMappingCache.clear();
  }

  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processNewBlocks();
        // Reset circuit breaker on success
        this.consecutiveFailures = 0;
      } catch (error) {
        this.consecutiveFailures++;
        console.error(
          `Error in ${this.chainConfig.name} (failure ${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
          error,
        );

        await this.prisma.indexerCheckpoint.update({
          where: { chainId: this.chainConfig.chainId },
          data: {
            isHealthy: this.consecutiveFailures < MAX_CONSECUTIVE_FAILURES,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        // Circuit breaker: pause longer after repeated failures
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.warn(
            `[CIRCUIT BREAKER] ${this.chainConfig.name}: ${this.consecutiveFailures} consecutive failures — pausing ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`,
          );
          await new Promise((resolve) => setTimeout(resolve, CIRCUIT_BREAKER_COOLDOWN_MS));
          this.consecutiveFailures = 0; // reset after cooldown
          continue;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, INDEXER_CONFIG.pollInterval));
    }
  }

  private async processNewBlocks(): Promise<void> {
    const latestBlock = await this.provider.getBlockNumber();

    if (this.currentBlock > latestBlock) return;

    const toBlock = Math.min(this.currentBlock + INDEXER_CONFIG.batchSize - 1, latestBlock);

    console.log(`[${this.chainConfig.name}] Processing blocks ${this.currentBlock} -> ${toBlock}`);

    const logs = await this.contract.queryFilter('*', this.currentBlock, toBlock);

    if (logs.length > 0) {
      await this.processLogs(logs as ethers.EventLog[]);
    }

    await this.updateCheckpoint(toBlock, 0);
    this.currentBlock = toBlock + 1;
  }

  private async processLogs(logs: ethers.EventLog[]): Promise<void> {
    // Batch-fetch unique blocks and receipts to avoid N+1 RPC calls (issue #6)
    const uniqueBlockNumbers = [...new Set(logs.map((l) => l.blockNumber))];
    const uniqueTxHashes     = [...new Set(logs.map((l) => l.transactionHash))];

    const [blocks, receipts] = await Promise.all([
      Promise.all(uniqueBlockNumbers.map((n) => this.provider.getBlock(n))),
      Promise.all(uniqueTxHashes.map((h) => this.provider.getTransactionReceipt(h))),
    ]);

    const blockMap   = new Map(uniqueBlockNumbers.map((n, i) => [n, blocks[i]]));
    const receiptMap = new Map(uniqueTxHashes.map((h, i) => [h, receipts[i]]));

    const events: any[] = [];

    for (const log of logs) {
      const block   = blockMap.get(log.blockNumber);
      if (!block) continue;

      const receipt        = receiptMap.get(log.transactionHash) ?? undefined;
      const blockTimestamp = new Date(block.timestamp * 1000);

      const event = await this.eventParser.parseEvent(
        log,
        this.chainConfig.chainId,
        blockTimestamp,
        receipt ?? undefined,
      );

      if (!event) continue;

      // Resolve token mappings with cache (issue #43)
      if (event.eventType === BridgeEventType.TOKEN_LOCKED) {
        event.tokenAddress = await this.cachedTokenLookup(
          `lock:${event.targetChainId}:${event.tokenAddress}`,
          () => this.contract.lockRoutes(event.targetChainId, event.tokenAddress),
        );
      } else if (event.eventType === BridgeEventType.TOKEN_BURNED) {
        event.tokenAddress = await this.cachedTokenLookup(
          `burn:${event.tokenAddress}`,
          () => this.contract.burnRoutes(event.tokenAddress),
        );
      }

      events.push({
        eventType:       event.eventType,
        chainId:         event.chainId,
        blockNumber:     event.blockNumber,
        logIndex:        event.logIndex,
        transactionHash: event.transactionHash,
        tokenAddress:    event.tokenAddress?.toLowerCase(),
        fromAddress:     event.fromAddress?.toLowerCase() ?? null,
        toAddress:       event.toAddress?.toLowerCase() ?? null,
        relayerAddress:  event.relayerAddress?.toLowerCase() ?? null,
        amount:          event.amount,
        fee:             event.fee,
        nonce:           event.nonce,
        targetChainId:   event.targetChainId,
        sourceChainId:   event.sourceChainId,
        blockTimestamp:  event.blockTimestamp,
        txHash:          event.txHash?.toLowerCase(),
        gasUsed:         event.gasUsed,
        gasPrice:        event.gasPrice,
        processed:       false,
      });

      console.log(`  ${event.eventType} | TX: ${event.transactionHash.slice(0, 10)}...`);
    }

    if (events.length === 0) return;

    // Wrap createMany + markRelated in a single Prisma transaction (issue #10)
    await this.prisma.$transaction(async (tx) => {
      await tx.bridgeEvent.createMany({ data: events, skipDuplicates: true });

      for (const event of events) {
        if (event.eventType === BridgeEventType.TOKEN_CLAIMED && event.txHash) {
          await tx.bridgeEvent.updateMany({
            where: { txHash: event.txHash, eventType: BridgeEventType.TOKEN_LOCKED, processed: false },
            data:  { processed: true },
          });
        }
        if (event.eventType === BridgeEventType.TOKEN_RELEASED && event.txHash) {
          await tx.bridgeEvent.updateMany({
            where: { txHash: event.txHash, eventType: BridgeEventType.TOKEN_BURNED, processed: false },
            data:  { processed: true },
          });
        }
      }
    });

    console.log(`  Saved ${events.length} events to database`);
  }

  private async cachedTokenLookup(key: string, fetcher: () => Promise<string>): Promise<string> {
    if (this.tokenMappingCache.has(key)) {
      return this.tokenMappingCache.get(key)!;
    }

    // Evict oldest entries if cache exceeds max size
    if (this.tokenMappingCache.size >= MAX_TOKEN_CACHE_SIZE) {
      const firstKey = this.tokenMappingCache.keys().next().value;
      if (firstKey !== undefined) this.tokenMappingCache.delete(firstKey);
    }

    const value = await fetcher();
    this.tokenMappingCache.set(key, value);
    return value;
  }

  private async updateCheckpoint(blockNumber: number, logIndex: number): Promise<void> {
    await this.prisma.indexerCheckpoint.upsert({
      where: { chainId: this.chainConfig.chainId },
      update: {
        lastProcessedBlock:    BigInt(blockNumber),
        lastProcessedLogIndex: logIndex,
        isHealthy:             true,
        errorMessage:          null,
      },
      create: {
        chainId:               this.chainConfig.chainId,
        lastProcessedBlock:    BigInt(blockNumber),
        lastProcessedLogIndex: logIndex,
        isHealthy:             true,
      },
    });
  }
}
