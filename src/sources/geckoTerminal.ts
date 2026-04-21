import { useStore } from '@/state/store';
import { GECKOTERMINAL_NETWORK, resolveDexAddresses } from '@/lib/symbols';
import type { Chain } from '@/lib/types';

interface GtTokenAttributes {
  price_usd?: string | null;
  fdv_usd?: string | null;
  total_reserve_in_usd?: string | null;
  volume_usd?: { h24?: string | null };
  top_pools?: unknown;
}

interface GtTokenResponse {
  data?: {
    attributes?: GtTokenAttributes;
    relationships?: {
      top_pools?: { data?: Array<{ id?: string }> };
    };
  };
}

interface GtPoolAttributes {
  address?: string;
  name?: string;
  dex_id?: string;
  base_token_price_usd?: string;
  reserve_in_usd?: string;
  volume_usd?: { h24?: string };
}

interface GtPoolResponse {
  data?: {
    attributes?: GtPoolAttributes;
    relationships?: { dex?: { data?: { id?: string } } };
  };
}

function num(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchOne(chain: Chain): Promise<void> {
  const net = GECKOTERMINAL_NETWORK[chain];
  const addr = resolveDexAddresses().addresses[chain];
  const url = `https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${addr}`;
  try {
    const r = await fetch(url);
    if (r.status === 404) {
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
      return;
    }
    if (!r.ok) {
      useStore.getState().setPool(chain, {
        chain,
        poolAddress: null,
        dexName: null,
        priceUsd: null,
        liquidityUsd: null,
        volume24hUsd: null,
        fdvUsd: null,
        updatedAt: Date.now(),
        state: 'error',
        errorMessage: `HTTP ${r.status}`,
      });
      return;
    }
    const j = (await r.json()) as GtTokenResponse;
    const attrs = j?.data?.attributes ?? {};
    const priceUsd = num(attrs.price_usd);
    const fdvUsd = num(attrs.fdv_usd);
    const liquidityUsd = num(attrs.total_reserve_in_usd);
    const volume24hUsd = num(attrs.volume_usd?.h24 ?? null);

    const poolIds = j?.data?.relationships?.top_pools?.data ?? [];
    let poolAddress: string | null = null;
    let dexName: string | null = null;
    if (poolIds.length > 0) {
      const firstId = poolIds[0]?.id ?? '';
      const parts = firstId.split('_');
      poolAddress = parts.slice(1).join('_') || null;
      try {
        const pr = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${net}/pools/${poolAddress}`,
        );
        if (pr.ok) {
          const pj = (await pr.json()) as GtPoolResponse;
          dexName = pj?.data?.relationships?.dex?.data?.id ?? pj?.data?.attributes?.dex_id ?? null;
        }
      } catch {
        // ignore
      }
    }

    useStore.getState().setPool(chain, {
      chain,
      poolAddress,
      dexName,
      priceUsd,
      liquidityUsd,
      volume24hUsd,
      fdvUsd,
      updatedAt: Date.now(),
      state: priceUsd != null ? 'live' : 'no-pool',
    });
  } catch (err) {
    useStore.getState().setPool(chain, {
      chain,
      poolAddress: null,
      dexName: null,
      priceUsd: null,
      liquidityUsd: null,
      volume24hUsd: null,
      fdvUsd: null,
      updatedAt: Date.now(),
      state: 'error',
      errorMessage: err instanceof Error ? err.message : 'unknown',
    });
  }
}

export function startGeckoTerminal(intervalMs = 5000): () => void {
  const chains: Chain[] = ['base', 'eth', 'arbitrum'];
  const tick = () => {
    chains.forEach((c) => void fetchOne(c));
  };
  tick();
  const id = window.setInterval(tick, intervalMs);
  return () => window.clearInterval(id);
}
