import { useStore } from '@/state/store';
import { DEXSCREENER_CHAIN, resolveDexAddresses } from '@/lib/symbols';
import type { Chain, PoolQuote } from '@/lib/types';

interface DsPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  fdv?: number;
}

interface DsResponse {
  pairs?: DsPair[] | null;
}

const STALE_AFTER_MS = 30_000;

function applyError(chain: Chain, message: string): void {
  const existing = useStore.getState().pools[chain];
  const now = Date.now();
  if (existing && existing.state === 'live' && now - existing.updatedAt < STALE_AFTER_MS) {
    console.warn(`[dexscreener] ${chain} error (keeping last live): ${message}`);
    return;
  }
  if (existing && existing.state === 'no-pool' && now - existing.updatedAt < STALE_AFTER_MS) return;
  useStore.getState().setPool(chain, {
    chain,
    poolAddress: existing?.poolAddress ?? null,
    dexName: existing?.dexName ?? null,
    priceUsd: null,
    liquidityUsd: null,
    volume24hUsd: null,
    fdvUsd: null,
    updatedAt: now,
    state: 'error',
    errorMessage: message,
  });
}

export async function refreshDexScreener(): Promise<void> {
  const { addresses } = resolveDexAddresses();
  const uniqAddresses = Array.from(new Set(Object.values(addresses)));
  const url = `https://api.dexscreener.com/latest/dex/tokens/${uniqAddresses.join(',')}`;
  let pairs: DsPair[] = [];
  try {
    const r = await fetch(url);
    if (!r.ok) {
      for (const c of Object.keys(addresses) as Chain[]) applyError(c, `HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as DsResponse;
    pairs = j?.pairs ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    for (const c of Object.keys(addresses) as Chain[]) applyError(c, msg);
    return;
  }

  const byChain: Record<Chain, DsPair | null> = { base: null, eth: null, arbitrum: null };
  for (const pair of pairs) {
    for (const [chain, ds] of Object.entries(DEXSCREENER_CHAIN) as Array<[Chain, string]>) {
      if (pair.chainId === ds) {
        const existing = byChain[chain];
        if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
          byChain[chain] = pair;
        }
      }
    }
  }

  for (const chain of Object.keys(byChain) as Chain[]) {
    const pair = byChain[chain];
    const existing = useStore.getState().pools[chain];
    if (!pair) {
      if (existing?.state === 'live') continue;
      useStore.getState().setPool(chain, {
        chain,
        poolAddress: existing?.poolAddress ?? null,
        dexName: existing?.dexName ?? null,
        priceUsd: null,
        liquidityUsd: null,
        volume24hUsd: null,
        fdvUsd: null,
        updatedAt: Date.now(),
        state: 'no-pool',
      });
      continue;
    }
    const priceUsdRaw = pair.priceUsd ? parseFloat(pair.priceUsd) : NaN;
    const priceUsd = Number.isFinite(priceUsdRaw) ? priceUsdRaw : null;
    const next: PoolQuote = {
      chain,
      poolAddress: pair.pairAddress ?? existing?.poolAddress ?? null,
      dexName: pair.dexId ?? existing?.dexName ?? null,
      priceUsd,
      liquidityUsd: pair.liquidity?.usd ?? null,
      volume24hUsd: pair.volume?.h24 ?? null,
      fdvUsd: pair.fdv ?? existing?.fdvUsd ?? null,
      updatedAt: Date.now(),
      state: priceUsd != null ? 'live' : 'no-pool',
    };
    useStore.getState().setPool(chain, next);
  }
}

export function startDexScreener(intervalMs = 3000): () => void {
  void refreshDexScreener();
  const id = window.setInterval(() => void refreshDexScreener(), intervalMs);
  return () => window.clearInterval(id);
}
