export const BRIDGE_ABI = [
  // Read
  {
    name: 'feeBps', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'minFeeAmount', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'lockRoutes', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'targetChainId', type: 'uint256' },
      { name: 'originalToken', type: 'address' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'burnRoutes', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wrappedToken', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'transactionStatuses', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'txHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'totalLocked', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'paused', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'bool' }],
  },
  // Write
  {
    name: 'lock', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',         type: 'address' },
      { name: 'targetChainId', type: 'uint256' },
      { name: 'amount',        type: 'uint256' },
      { name: 'maxFee',        type: 'uint256' },
    ],
    outputs: [{ name: 'txHash', type: 'bytes32' }],
  },
  {
    name: 'claim', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'wrappedToken',  type: 'address' },
      { name: 'to',            type: 'address' },
      { name: 'amount',        type: 'uint256' },
      { name: 'fee',           type: 'uint256' },
      { name: 'sourceChainId', type: 'uint256' },
      { name: 'nonce',         type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'burn', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'wrappedToken',  type: 'address' },
      { name: 'targetChainId', type: 'uint256' },
      { name: 'amount',        type: 'uint256' },
      { name: 'maxFee',        type: 'uint256' },
    ],
    outputs: [{ name: 'txHash', type: 'bytes32' }],
  },
  {
    name: 'release', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',         type: 'address' },
      { name: 'to',            type: 'address' },
      { name: 'amount',        type: 'uint256' },
      { name: 'fee',           type: 'uint256' },
      { name: 'sourceChainId', type: 'uint256' },
      { name: 'nonce',         type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export const ERC20_ABI = [
  {
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'string' }],
  },
] as const;
