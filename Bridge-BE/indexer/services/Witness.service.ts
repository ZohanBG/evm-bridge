import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { CHAIN_CONFIGS } from '../config/chains.config';
import { BridgeEventType } from '../types/events.types';

const SUBMIT_WITNESS_ABI = ['function submitWitness(bytes32 txHash) external'];
const POLL_INTERVAL_MS   = 10_000;
const BATCH_SIZE         = 10;
const MAX_CONCURRENT     = 5; // max parallel witness submissions

export class WitnessService {
  private providers  = new Map<number, ethers.JsonRpcProvider>();
  private contracts  = new Map<number, ethers.Contract>();
  private wallet: ethers.Wallet;
  private isRunning  = false;

  // Tracks pending tx hashes so we don't retry while waiting for confirmation
  private pendingSubmissions = new Set<string>();

  constructor(private prisma: PrismaClient) {
    const privateKey = process.env.VALIDATOR_PRIVATE_KEY;
    if (!privateKey) throw new Error('VALIDATOR_PRIVATE_KEY not set');

    this.wallet = new ethers.Wallet(privateKey);

    for (const chain of CHAIN_CONFIGS) {
      if (!chain.bridgeAddress) continue;
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      this.providers.set(chain.chainId, provider);
      this.contracts.set(
        chain.chainId,
        new ethers.Contract(chain.bridgeAddress, SUBMIT_WITNESS_ABI, this.wallet.connect(provider)),
      );
    }

    console.log(`Witness service initialised — validator: ${this.wallet.address}`);
  }

  async start(): Promise<void> {
    console.log('\nStarting Witness Service...\n');
    this.isRunning = true;
    this.poll();
  }

  async stop(): Promise<void> {
    console.log('\nStopping Witness Service...');
    this.isRunning = false;
    this.pendingSubmissions.clear();

    // Disconnect all providers to release resources
    for (const provider of this.providers.values()) {
      provider.destroy();
    }
    this.providers.clear();
    this.contracts.clear();
  }

  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processWitnessSubmissions();
      } catch (error) {
        console.error('Witness service error:', error);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  private async processWitnessSubmissions(): Promise<void> {
    // Find lock/burn events that don't yet have a confirmed witness submission
    const confirmedTxHashes = (
      await this.prisma.witnessSubmission.findMany({
        where: { confirmed: true },
        select: { txHash: true },
      })
    ).map((w) => w.txHash);

    const unprocessed = await this.prisma.bridgeEvent.findMany({
      where: {
        eventType: { in: [BridgeEventType.TOKEN_LOCKED, BridgeEventType.TOKEN_BURNED] },
        processed: false,
        ...(confirmedTxHashes.length > 0
          ? { txHash: { notIn: confirmedTxHashes } }
          : {}),
      },
      orderBy: { blockNumber: 'asc' },
      take: BATCH_SIZE,
    });

    if (unprocessed.length === 0) return;

    // Process witnesses in batches with concurrency limit
    for (let i = 0; i < unprocessed.length; i += MAX_CONCURRENT) {
      const batch = unprocessed.slice(i, i + MAX_CONCURRENT);
      await Promise.allSettled(batch.map((event) => this.submitWitness(event)));
    }
  }

  private async submitWitness(event: any): Promise<void> {
    const targetChainId = event.targetChainId;
    if (!targetChainId) {
      console.warn(`Event ${event.id} has no targetChainId — skipping`);
      return;
    }

    const contract = this.contracts.get(targetChainId);
    if (!contract) {
      console.warn(`No contract for chain ${targetChainId}`);
      return;
    }

    const txHash = event.txHash;
    if (this.pendingSubmissions.has(txHash)) return;

    // Check for an existing submission record
    const existing = await this.prisma.witnessSubmission.findUnique({ where: { txHash } });

    if (existing) {
      if (existing.confirmed) {
        // Witness already confirmed — nothing more for the witness service to do.
        // The bridge event stays processed=false until the actual claim/release is indexed.
        console.log(`[WITNESS] Skipping already-confirmed ${txHash.slice(0, 10)}...`);
        return;
      }

      // Check confirmation status of the already-submitted tx
      if (existing.submittedTxHash) {
        const receipt = await this.providers
          .get(targetChainId)
          ?.getTransactionReceipt(existing.submittedTxHash);

        if (receipt?.status === 1) {
          await this.prisma.witnessSubmission.update({
            where: { id: existing.id },
            data:  { confirmed: true, confirmations: 1 },
          });
          console.log(`Witness confirmed: ${txHash.slice(0, 10)}...`);
        } else {
          console.log(`Still waiting for witness confirmation: ${txHash.slice(0, 10)}...`);
        }
      }
      return;
    }

    // Submit the witness to the target chain
    try {
      this.pendingSubmissions.add(txHash);
      console.log(
        `Submitting witness ${event.eventType} (${txHash.slice(0, 10)}...) → chain ${targetChainId}`,
      );

      const tx = await contract.submitWitness(txHash);
      console.log(`  TX sent: ${tx.hash}`);

      await this.prisma.witnessSubmission.upsert({
        where:  { txHash },
        create: {
          txHash,
          sourceEventId:   event.id,
          sourceChainId:   event.chainId,
          targetChainId,
          submittedAt:     new Date(),
          submittedTxHash: tx.hash,
          confirmed:       false,
          confirmations:   0,
        },
        update: {
          submittedAt:     new Date(),
          submittedTxHash: tx.hash,
        },
      });
    } catch (error: any) {
      console.error(`Failed to submit witness for ${txHash.slice(0, 10)}:`, error.message);
    } finally {
      this.pendingSubmissions.delete(txHash);
    }
  }
}
