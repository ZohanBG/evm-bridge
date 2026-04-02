import { ethers } from 'ethers';
import { BridgeEventType, ParsedBridgeEvent } from '../types/events.types';

// ABI matches the redesigned Bridge.sol event signatures
const BRIDGE_EVENT_ABI = [
  'event TokenLocked(address indexed token, address indexed from, uint256 amount, uint256 fee, uint256 indexed targetChainId, uint256 sourceChainId, uint256 nonce, bytes32 txHash)',
  'event TokenClaimed(address indexed wrappedToken, address indexed to, uint256 amount, uint256 fee, address relayer, uint256 sourceChainId, uint256 targetChainId, bytes32 indexed txHash)',
  'event TokenBurned(address indexed wrappedToken, address indexed from, uint256 amount, uint256 fee, uint256 indexed targetChainId, uint256 sourceChainId, uint256 nonce, bytes32 txHash)',
  'event TokenReleased(address indexed token, address indexed to, uint256 amount, uint256 fee, address relayer, uint256 sourceChainId, uint256 targetChainId, bytes32 indexed txHash)',
];

export class EventParserService {
  private readonly iface: ethers.Interface;

  constructor() {
    this.iface = new ethers.Interface(BRIDGE_EVENT_ABI);
  }

  async parseEvent(
    log: ethers.Log,
    chainId: number,
    blockTimestamp: Date,
    receipt?: ethers.TransactionReceipt,
  ): Promise<ParsedBridgeEvent | null> {
    let parsedLog: ethers.LogDescription | null;

    try {
      parsedLog = this.iface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
    } catch {
      return null;
    }

    if (!parsedLog) return null;

    const base = {
      chainId,
      blockNumber:     BigInt(log.blockNumber),
      logIndex:        log.index,
      transactionHash: log.transactionHash,
      blockTimestamp,
      gasUsed:         receipt ? BigInt(receipt.gasUsed) : null,
      gasPrice:        receipt?.gasPrice != null ? receipt.gasPrice.toString() : null,
    };

    const args = parsedLog.args;

    switch (parsedLog.name) {
      case 'TokenLocked':
        return {
          ...base,
          eventType:     BridgeEventType.TOKEN_LOCKED,
          tokenAddress:  args.token as string,
          fromAddress:   args.from as string,
          toAddress:     null,
          relayerAddress: null,
          amount:        (args.amount as bigint).toString(),
          fee:           (args.fee as bigint).toString(),
          targetChainId: Number(args.targetChainId),
          sourceChainId: Number(args.sourceChainId),
          nonce:         BigInt(args.nonce as bigint),
          txHash:        args.txHash as string,
        };

      case 'TokenClaimed':
        return {
          ...base,
          eventType:     BridgeEventType.TOKEN_CLAIMED,
          tokenAddress:  args.wrappedToken as string,
          fromAddress:   null,
          toAddress:     args.to as string,
          relayerAddress: args.relayer as string,
          amount:        (args.amount as bigint).toString(),
          fee:           (args.fee as bigint).toString(),
          targetChainId: Number(args.targetChainId),
          sourceChainId: Number(args.sourceChainId),
          nonce:         null,
          txHash:        args.txHash as string,
        };

      case 'TokenBurned':
        return {
          ...base,
          eventType:     BridgeEventType.TOKEN_BURNED,
          tokenAddress:  args.wrappedToken as string,
          fromAddress:   args.from as string,
          toAddress:     null,
          relayerAddress: null,
          amount:        (args.amount as bigint).toString(),
          fee:           (args.fee as bigint).toString(),
          targetChainId: Number(args.targetChainId),
          sourceChainId: Number(args.sourceChainId),
          nonce:         BigInt(args.nonce as bigint),
          txHash:        args.txHash as string,
        };

      case 'TokenReleased':
        return {
          ...base,
          eventType:     BridgeEventType.TOKEN_RELEASED,
          tokenAddress:  args.token as string,
          fromAddress:   null,
          toAddress:     args.to as string,
          relayerAddress: args.relayer as string,
          amount:        (args.amount as bigint).toString(),
          fee:           (args.fee as bigint).toString(),
          targetChainId: Number(args.targetChainId),
          sourceChainId: Number(args.sourceChainId),
          nonce:         null,
          txHash:        args.txHash as string,
        };

      default:
        return null;
    }
  }
}
