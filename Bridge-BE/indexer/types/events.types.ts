export enum BridgeEventType {
  TOKEN_LOCKED = 'TOKEN_LOCKED',
  TOKEN_CLAIMED = 'TOKEN_CLAIMED',
  TOKEN_BURNED = 'TOKEN_BURNED',
  TOKEN_RELEASED = 'TOKEN_RELEASED',
}

export interface ParsedBridgeEvent {
  eventType: BridgeEventType;
  chainId: number;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: string;
  tokenAddress: string;
  fromAddress: string | null;
  toAddress: string | null;
  relayerAddress: string | null;
  amount: string;
  fee: string | null;
  nonce: bigint | null;
  targetChainId: number | null;
  sourceChainId: number | null;
  blockTimestamp: Date;
  txHash: string;
  gasUsed: bigint | null;
  gasPrice: string | null;
}