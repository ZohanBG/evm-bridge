export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  bridgeAddress: string;
  startBlock: number;
}

export const INDEXER_CONFIG = {
  pollInterval: parseInt(process.env.INDEXER_POLL_INTERVAL ?? '5000'),
  batchSize:    1000,
  maxRetries:   3,
};

const CHAIN_CONFIGS_RAW: ChainConfig[] = [
  {
    name:          'Chain A (Anvil)',
    chainId:       parseInt(process.env.CHAIN_A_ID        ?? '31337'),
    rpcUrl:        process.env.CHAIN_A_RPC_URL            ?? 'http://127.0.0.1:8545',
    bridgeAddress: process.env.BRIDGE_A                   ?? '',
    startBlock:    parseInt(process.env.START_BLOCK_A     ?? '0'),
  },
  {
    name:          'Chain B (Anvil)',
    chainId:       parseInt(process.env.CHAIN_B_ID        ?? '31338'),
    rpcUrl:        process.env.CHAIN_B_RPC_URL            ?? 'http://127.0.0.1:8546',
    bridgeAddress: process.env.BRIDGE_B                   ?? '',
    startBlock:    parseInt(process.env.START_BLOCK_B     ?? '0'),
  },
  {
    name:          'Chain C (Anvil)',
    chainId:       parseInt(process.env.CHAIN_C_ID        ?? '31339'),
    rpcUrl:        process.env.CHAIN_C_RPC_URL            ?? 'http://127.0.0.1:8547',
    bridgeAddress: process.env.BRIDGE_C                   ?? '',
    startBlock:    parseInt(process.env.START_BLOCK_C     ?? '0'),
  },
];

// Only include chains that have a bridge address configured
export const CHAIN_CONFIGS: ChainConfig[] = CHAIN_CONFIGS_RAW.filter(
  (c) => c.bridgeAddress.length > 0,
);
