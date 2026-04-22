import { isValidAddress, parseUnits } from './units';

export interface LzChain {
  key: string;
  label: string;
  eid: number;
  chainId: number;
  explorer: string;
  rpcHint: string;
}

export const LZ_CHAINS: LzChain[] = [
  { key: 'ethereum', label: 'Ethereum', eid: 30101, chainId: 1, explorer: 'https://etherscan.io', rpcHint: 'https://eth.llamarpc.com' },
  { key: 'arbitrum', label: 'Arbitrum One', eid: 30110, chainId: 42161, explorer: 'https://arbiscan.io', rpcHint: 'https://arb1.arbitrum.io/rpc' },
  { key: 'base', label: 'Base', eid: 30184, chainId: 8453, explorer: 'https://basescan.org', rpcHint: 'https://mainnet.base.org' },
  { key: 'optimism', label: 'Optimism', eid: 30111, chainId: 10, explorer: 'https://optimistic.etherscan.io', rpcHint: 'https://mainnet.optimism.io' },
  { key: 'bsc', label: 'BNB Smart Chain', eid: 30102, chainId: 56, explorer: 'https://bscscan.com', rpcHint: 'https://bsc-dataseed.binance.org' },
  { key: 'polygon', label: 'Polygon', eid: 30109, chainId: 137, explorer: 'https://polygonscan.com', rpcHint: 'https://polygon-rpc.com' },
  { key: 'avalanche', label: 'Avalanche C-Chain', eid: 30106, chainId: 43114, explorer: 'https://snowtrace.io', rpcHint: 'https://api.avax.network/ext/bc/C/rpc' },
  { key: 'mantle', label: 'Mantle', eid: 30181, chainId: 5000, explorer: 'https://explorer.mantle.xyz', rpcHint: 'https://rpc.mantle.xyz' },
  { key: 'linea', label: 'Linea', eid: 30183, chainId: 59144, explorer: 'https://lineascan.build', rpcHint: 'https://rpc.linea.build' },
  { key: 'scroll', label: 'Scroll', eid: 30214, chainId: 534352, explorer: 'https://scrollscan.com', rpcHint: 'https://rpc.scroll.io' },
  { key: 'blast', label: 'Blast', eid: 30243, chainId: 81457, explorer: 'https://blastscan.io', rpcHint: 'https://rpc.blast.io' },
];

export function findChainByEid(eid: number): LzChain | undefined {
  return LZ_CHAINS.find((c) => c.eid === eid);
}

export function findChainByKey(key: string): LzChain | undefined {
  return LZ_CHAINS.find((c) => c.key === key);
}

export function addressToBytes32(addr: string): string {
  const clean = addr.trim().toLowerCase().replace(/^0x/, '');
  if (clean.length !== 40 || !/^[0-9a-f]{40}$/.test(clean)) {
    throw new Error(`invalid address: ${addr}`);
  }
  return '0x' + '0'.repeat(24) + clean;
}

export function buildLzReceiveOptions(gasLimit: bigint | number): string {
  const g = BigInt(gasLimit);
  if (g < 0n || g > 2n ** 128n - 1n) throw new Error('gas limit out of uint128 range');
  const gasHex = g.toString(16).padStart(32, '0');
  return '0x' + '0003' + '01' + '0011' + '01' + gasHex;
}

export function buildLzReceiveOptionsWithValue(gasLimit: bigint | number, msgValue: bigint): string {
  const g = BigInt(gasLimit);
  if (msgValue === 0n) return buildLzReceiveOptions(g);
  const gasHex = g.toString(16).padStart(32, '0');
  const valHex = msgValue.toString(16).padStart(32, '0');
  return '0x' + '0003' + '01' + '0021' + '01' + gasHex + valHex;
}

export interface SendParam {
  dstEid: number;
  to: string;
  amountLD: string;
  minAmountLD: string;
  extraOptions: string;
  composeMsg: string;
  oftCmd: string;
}

export interface BuildSendParamArgs {
  dstEid: number;
  recipient: string;
  amount: string;
  decimals: number;
  slippageBps: number;
  gasLimit: number;
}

export function buildSendParam(args: BuildSendParamArgs): SendParam {
  const { dstEid, recipient, amount, decimals, slippageBps, gasLimit } = args;
  if (!isValidAddress(recipient)) throw new Error('invalid recipient address');
  if (slippageBps < 0 || slippageBps > 10_000) throw new Error('slippageBps must be 0-10000');
  const amountLD = parseUnits(amount, decimals);
  const minAmountLD = (amountLD * BigInt(10_000 - slippageBps)) / 10_000n;
  return {
    dstEid,
    to: addressToBytes32(recipient),
    amountLD: amountLD.toString(),
    minAmountLD: minAmountLD.toString(),
    extraOptions: buildLzReceiveOptions(gasLimit),
    composeMsg: '0x',
    oftCmd: '0x',
  };
}

export function sendParamAsTupleJson(p: SendParam): string {
  return JSON.stringify([
    p.dstEid,
    p.to,
    p.amountLD,
    p.minAmountLD,
    p.extraOptions,
    p.composeMsg,
    p.oftCmd,
  ]);
}

export function sendParamAsTupleString(p: SendParam): string {
  return `[${p.dstEid},"${p.to}","${p.amountLD}","${p.minAmountLD}","${p.extraOptions}","${p.composeMsg}","${p.oftCmd}"]`;
}

export function messagingFeeTupleString(nativeFee: string): string {
  const fee = nativeFee && nativeFee.trim() ? nativeFee.trim() : '0';
  return `[${fee},0]`;
}
