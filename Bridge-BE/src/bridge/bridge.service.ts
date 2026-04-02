import { Injectable, NotFoundException } from '@nestjs/common';
import { BridgeEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEventsDto, WalletAddressDto } from './dto/query-events.dto';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const MAX_PAGE_SIZE = 50;

@Injectable()
export class BridgeService {
  constructor(private readonly prisma: PrismaService) {}

  private toStr(v: unknown): unknown {
    if (typeof v === 'bigint') return v.toString();
    if (v != null && typeof v === 'object' && 'toFixed' in v) return (v as any).toFixed(0);
    return v;
  }

  /** Normalize to lowercase to avoid case-sensitive address mismatches */
  private normalizeAddress(addr: string): string {
    return addr.toLowerCase();
  }

  private serializeBridgeEvent(event: any) {
    if (!event) return event;

    const isBurn =
      event.eventType === 'TOKEN_BURNED' ||
      event.eventType === BridgeEventType.TOKEN_BURNED;

    return {
      id: event.id,
      eventType: event.eventType,
      chainId: this.toStr(event.chainId),
      sourceChainId: this.toStr(event.sourceChainId),
      targetChainId: this.toStr(event.targetChainId),
      transactionHash: event.transactionHash,
      txHash: event.txHash,
      tokenAddress: event.tokenAddress,
      fromAddress: event.fromAddress,
      toAddress: event.toAddress ?? (isBurn ? event.fromAddress : null),
      relayerAddress: event.relayerAddress,
      amount: this.toStr(event.amount) ?? '0',
      fee: this.toStr(event.fee) ?? null,
      gasPrice: this.toStr(event.gasPrice) ?? null,
      gasUsed: this.toStr(event.gasUsed),
      nonce: this.toStr(event.nonce),
      blockNumber: this.toStr(event.blockNumber),
      logIndex: this.toStr(event.logIndex),
      processed: event.processed,
      blockTimestamp: event.blockTimestamp,
      indexedAt: event.indexedAt,
    };
  }

  async getTokensWaitingToClaim(queryDto: QueryEventsDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, chainId, targetChainId, tokenAddress, userAddress } = queryDto;

    const where: Prisma.BridgeEventWhereInput = {
      eventType: BridgeEventType.TOKEN_LOCKED,
      processed: false,
    };

    if (chainId) where.chainId = chainId;
    if (targetChainId) where.targetChainId = targetChainId;
    if (tokenAddress) where.tokenAddress = this.normalizeAddress(tokenAddress);
    if (userAddress) where.fromAddress = this.normalizeAddress(userAddress);

    const take = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.bridgeEvent.findMany({ where, skip, take, orderBy: { blockTimestamp: 'desc' } }),
      this.prisma.bridgeEvent.count({ where }),
    ]);

    return {
      data: data.map((e) => this.serializeBridgeEvent(e)),
      meta: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  async getTokensWaitingToRelease(queryDto: QueryEventsDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, chainId, targetChainId, tokenAddress, userAddress } = queryDto;

    const where: Prisma.BridgeEventWhereInput = {
      eventType: BridgeEventType.TOKEN_BURNED,
      processed: false,
    };

    if (chainId) where.chainId = chainId;
    if (targetChainId) where.targetChainId = targetChainId;
    if (tokenAddress) where.tokenAddress = this.normalizeAddress(tokenAddress);
    if (userAddress) where.fromAddress = this.normalizeAddress(userAddress);

    const take = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.bridgeEvent.findMany({ where, skip, take, orderBy: { blockTimestamp: 'desc' } }),
      this.prisma.bridgeEvent.count({ where }),
    ]);

    return {
      data: data.map((e) => this.serializeBridgeEvent(e)),
      meta: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  async getBridgedTokensByWallet(
    walletDto: WalletAddressDto,
    queryDto: QueryEventsDto,
  ): Promise<PaginatedResponse<any>> {
    const address = this.normalizeAddress(walletDto.address);
    const { page = 1, limit = 20, chainId, eventType } = queryDto;

    const where: Prisma.BridgeEventWhereInput = {
      OR: [{ fromAddress: address }, { toAddress: address }],
    };

    if (chainId) where.chainId = chainId;
    if (eventType) where.eventType = eventType;

    const take = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.bridgeEvent.findMany({ where, skip, take, orderBy: { blockTimestamp: 'desc' } }),
      this.prisma.bridgeEvent.count({ where }),
    ]);

    return {
      data: data.map((e) => this.serializeBridgeEvent(e)),
      meta: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  async getAllBridgedTokens(queryDto: QueryEventsDto) {
    const where: Prisma.BridgeEventWhereInput = {
      eventType: { in: [BridgeEventType.TOKEN_LOCKED, BridgeEventType.TOKEN_BURNED] },
      ...(queryDto.chainId ? { chainId: queryDto.chainId } : {}),
    };

    const grouped = await this.prisma.bridgeEvent.groupBy({
      by: ['tokenAddress', 'chainId'],
      where,
      _count: { _all: true },
      _sum: { amount: true },
      _min: { blockTimestamp: true },
      _max: { blockTimestamp: true },
    });

    return {
      data: grouped
        .map((g) => ({
          tokenAddress: g.tokenAddress,
          chainId: this.toStr(g.chainId),
          eventCount: g._count._all,
          totalVolume: (g._sum.amount ?? 0).toFixed(0),
          firstBridgedAt: g._min.blockTimestamp!,
          lastBridgedAt: g._max.blockTimestamp!,
        }))
        .sort((a, b) => b.eventCount - a.eventCount),
    };
  }

  async getEventByTxHash(txHash: string, chainId?: number) {
    const where: Prisma.BridgeEventWhereInput = {
      txHash: txHash.toLowerCase(),
      ...(chainId ? { chainId } : {}),
    };

    const event = await this.prisma.bridgeEvent.findFirst({ where });
    if (!event) throw new NotFoundException(`Event with witness hash ${txHash} not found`);
    return this.serializeBridgeEvent(event);
  }

  async getBridgeStatistics(chainId?: number) {
    const where: Prisma.BridgeEventWhereInput = chainId ? { chainId } : {};

    const [
      totalTransactions,
      pendingClaims,
      pendingReleases,
      totalLocked,
      totalBurned,
      tokenSet,
      volumeAgg,
      uniqueFrom,
      uniqueTo,
    ] = await Promise.all([
      this.prisma.bridgeEvent.count({ where }),
      this.prisma.bridgeEvent.count({
        where: { ...where, eventType: BridgeEventType.TOKEN_LOCKED, processed: false },
      }),
      this.prisma.bridgeEvent.count({
        where: { ...where, eventType: BridgeEventType.TOKEN_BURNED, processed: false },
      }),
      this.prisma.bridgeEvent.count({
        where: { ...where, eventType: BridgeEventType.TOKEN_LOCKED },
      }),
      this.prisma.bridgeEvent.count({
        where: { ...where, eventType: BridgeEventType.TOKEN_BURNED },
      }),
      this.prisma.bridgeEvent.findMany({
        where,
        distinct: ['tokenAddress'],
        select: { tokenAddress: true },
      }),
      this.prisma.bridgeEvent.aggregate({
        where: {
          ...where,
          eventType: { in: [BridgeEventType.TOKEN_LOCKED, BridgeEventType.TOKEN_BURNED] },
        },
        _sum: { amount: true },
      }),
      this.prisma.bridgeEvent.findMany({
        where: { ...where, fromAddress: { not: null } },
        distinct: ['fromAddress'],
        select: { fromAddress: true },
      }),
      this.prisma.bridgeEvent.findMany({
        where: { ...where, toAddress: { not: null } },
        distinct: ['toAddress'],
        select: { toAddress: true },
      }),
    ]);

    const allAddresses = new Set<string>([
      ...uniqueFrom.map((e) => e.fromAddress!),
      ...uniqueTo.map((e) => e.toAddress!),
    ]);

    return {
      totalTransactions,
      totalVolume: (volumeAgg._sum.amount ?? 0).toFixed(0),
      uniqueTokens: tokenSet.length,
      uniqueUsers: allAddresses.size,
      pendingClaims,
      pendingReleases,
      totalLocked,
      totalBurned,
    };
  }
}
