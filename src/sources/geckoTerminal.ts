import { useStore } from '@/state/store';
import { GECKOTERMINAL_NETWORK, resolveDexAddresses } from '@/lib/symbols';
import type { Chain, PoolQuote } from '@/lib/types';

interface GtTokenAttributes {
  price_usd?: string | null;
  fdv_usd?: string | null;
  total_reserve_in_usd?: string | null;
  volume_usd?: { h24?: string | null };
}

interface GtTokenResponse {
  data?: {
    attributes?: GtTokenAttributes;
    relationships?: {
      top_pools?: { data?: Array<{ id?: string }> };
    };
  };
}

function num(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

const STALE_AFTER_MS = 30_000;

function applyError(chain: Chain, message: string): void {
  const existing = useStore.getState().pools[chain];
  const now = Date.now();
  if (existing && existing.state === 'live' && now - existing.updatedAt < STALE_AFTER_MS) {
    console.warn(`[geckoTerminal] ${chain} error (keeping last live): ${message}`);
    return;
  }
  if (existing && existing.state === 'no-pool' && now - existing.updatedAt < STALE_AFTER_MS) {
    console.warn(`[geckoTerminal] ${chain} error (keeping last no-pool): ${message}`);
    return;
  }
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

async function fetchOne(chain: Chain): Promise<void> {
  const net = GECKOTERMINAL_NETWORK[chain];
  const addr = resolveDexAddresses().addresses[chain];
  const url = `https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${addr}`;
  try {
    const r = await fetch(url);
    if (r.status === 404) {
      const existing = useStore.getState().pools[chain];
      if (existing?.state === 'live') return;
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
      applyError(chain, `HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as GtTokenResponse;
    const attrs = j?.data?.attributes ?? {};
    const priceUsd = num(attrs.price_usd);
    const fdvUsd = num(attrs.fdv_usd);
    const liquidityUsd = num(attrs.total_reserve_in_usd);
    const volume24hUsd = num(attrs.volume_usd?.h24 ?? null);

    const poolIds = j?.data?.relationships?.top_pools?.data ?? [];
    const existing = useStore.getState().pools[chain];
    let poolAddress: string | null = existing?.poolAddress ?? null;
    if (poolIds.length > 0) {
      const firstId = poolIds[0]?.id ?? '';
      const parts = firstId.split('_');
      poolAddress = parts.slice(1).join('_') || poolAddress;
    }

    const next: PoolQuote = {
      chain,
      poolAddress,
      dexName: existing?.dexName ?? null,
      priceUsd,
      liquidityUsd,
      volume24hUsd,
      fdvUsd,
      updatedAt: Date.now(),
      state: priceUsd != null ? 'live' : 'no-pool',
    };
    useStore.getState().setPool(chain, next);
  } catch (err) {
    applyError(chain, err instanceof Error ? err.message : 'unknown');
  }
}

export function startGeckoTerminal(intervalMs = 15_000): () => void {
  const chains: Chain[] = ['base', 'eth', 'arbitrum'];
  const tick = () => {
    chains.forEach((c) => void fetchOne(c));
  };
  tick();
  const id = window.setInterval(tick, intervalMs);
  return () => window.clearInterval(id);
}
