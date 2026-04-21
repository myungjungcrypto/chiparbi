import { useStore } from '@/state/store';
import { DEXSCREENER_CHAIN, resolveDexAddresses } from '@/lib/symbols';
import type { Chain } from '@/lib/types';

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

export async function refreshDexScreener(): Promise<void> {
  const { addresses } = resolveDexAddresses();
  const uniqAddresses = Array.from(new Set(Object.values(addresses)));
  const url = `https://api.dexscreener.com/latest/dex/tokens/${uniqAddresses.join(',')}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return;
    const j = (await r.json()) as DsResponse;
    const pairs = j?.pairs ?? [];

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
      if (!pair) {
        // Don't overwrite GeckoTerminal data if it has a live price and DEX Screener has nothing
        const existing = useStore.getState().pools[chain];
        if (existing && existing.state === 'live') continue;
        useStore.getState().setPool(chain, {
          chain,
          poolAddress: null,
          dexName: null,
          priceUsd: null,
          liquidityUsd: null,
          volume24hUsd: null,
          fdvUsd: null,
          updatedAt: Date.now(),
          state: 'no-pool',
        });
        continue;
      }
      const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : null;
      useStore.getState().setPool(chain, {
        chain,
        poolAddress: pair.pairAddress ?? null,
        dexName: pair.dexId ?? null,
        priceUsd: Number.isFinite(priceUsd as number) ? priceUsd : null,
        liquidityUsd: pair.liquidity?.usd ?? null,
        volume24hUsd: pair.volume?.h24 ?? null,
        fdvUsd: pair.fdv ?? null,
        updatedAt: Date.now(),
        state: priceUsd != null ? 'live' : 'no-pool',
      });
    }
  } catch {
    // ignore; Gecko polling will continue
  }
}

export function startDexScreener(intervalMs = 6000): () => void {
  void refreshDexScreener();
  const id = window.setInterval(() => void refreshDexScreener(), intervalMs);
  return () => window.clearInterval(id);
}
