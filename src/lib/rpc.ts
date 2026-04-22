import { createPublicClient, http, type PublicClient, type Address } from 'viem';
import { LZ_CHAINS, type SendParam } from './oft';
import { OFT_ABI } from './abi';

const clients = new Map<string, PublicClient>();

export function rpcUrl(chainKey: string): string | undefined {
  const override = (import.meta.env[`VITE_RPC_${chainKey.toUpperCase()}`] as string | undefined) ?? undefined;
  if (override) return override;
  return LZ_CHAINS.find((c) => c.key === chainKey)?.rpcHint;
}

export function getClient(chainKey: string): PublicClient {
  const cached = clients.get(chainKey);
  if (cached) return cached;
  const url = rpcUrl(chainKey);
  if (!url) throw new Error(`no RPC configured for ${chainKey}`);
  const client = createPublicClient({
    transport: http(url, { timeout: 8_000, retryCount: 1 }),
  });
  clients.set(chainKey, client);
  return client;
}

export interface PeerDiscoveryResult {
  supported: Set<number>;
  errored: boolean;
  errorMessage?: string;
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export async function discoverPeers(
  chainKey: string,
  adapter: string,
  signal?: AbortSignal,
): Promise<PeerDiscoveryResult> {
  if (!adapter) return { supported: new Set(), errored: false };
  const client = getClient(chainKey);
  const results = await Promise.allSettled(
    LZ_CHAINS.map(async (c) => {
      if (signal?.aborted) throw new Error('aborted');
      const peer = await client.readContract({
        address: adapter as Address,
        abi: OFT_ABI,
        functionName: 'peers',
        args: [c.eid],
      });
      return { eid: c.eid, peer: peer as string };
    }),
  );
  if (signal?.aborted) throw new Error('aborted');

  const supported = new Set<number>();
  let nonAbortErrors = 0;
  let firstError: string | undefined;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.peer && r.value.peer.toLowerCase() !== ZERO_BYTES32) {
        supported.add(r.value.eid);
      }
    } else {
      nonAbortErrors += 1;
      if (!firstError) firstError = r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
  }
  const allFailed = nonAbortErrors === LZ_CHAINS.length;
  return {
    supported,
    errored: allFailed,
    errorMessage: allFailed ? firstError : undefined,
  };
}

export interface QuoteResult {
  nativeFee: bigint;
  lzTokenFee: bigint;
}

export async function fetchQuoteSend(
  chainKey: string,
  adapter: string,
  sendParam: SendParam,
  signal?: AbortSignal,
): Promise<QuoteResult> {
  const client = getClient(chainKey);
  if (signal?.aborted) throw new Error('aborted');
  const sp = {
    dstEid: sendParam.dstEid,
    to: sendParam.to as `0x${string}`,
    amountLD: BigInt(sendParam.amountLD),
    minAmountLD: BigInt(sendParam.minAmountLD),
    extraOptions: sendParam.extraOptions as `0x${string}`,
    composeMsg: (sendParam.composeMsg || '0x') as `0x${string}`,
    oftCmd: (sendParam.oftCmd || '0x') as `0x${string}`,
  };
  const result = (await client.readContract({
    address: adapter as Address,
    abi: OFT_ABI,
    functionName: 'quoteSend',
    args: [sp, false],
  })) as { nativeFee: bigint; lzTokenFee: bigint };
  return { nativeFee: result.nativeFee, lzTokenFee: result.lzTokenFee };
}
