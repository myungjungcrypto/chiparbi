import type { Chain, CexVenue } from '@/lib/types';
import { useStore } from '@/state/store';

export interface NormalizedPrice {
  priceUsd: number | null;
  priceKrw: number | null;
  label: string;
  sourceId: string;
}

export interface SpreadCell {
  sourceLabel: string;
  sinkLabel: string;
  sourceKey: string;
  sinkKey: string;
  sourceUsd: number | null;
  sinkUsd: number | null;
  spreadPct: number | null;
  spreadAbsUsd: number | null;
}

export interface BestRoute {
  sourceKey: string;
  sinkKey: string;
  sourceLabel: string;
  sinkLabel: string;
  sourceUsd: number;
  sinkUsd: number;
  spreadPct: number;
  spreadAbsUsd: number;
}

export interface SpreadsView {
  dexPrices: Record<Chain, NormalizedPrice>;
  cexPrices: Record<CexVenue, NormalizedPrice>;
  matrix: SpreadCell[];
  best: BestRoute | null;
  fxUsdKrw: number | null;
}

export function selectSpreadsView(state: ReturnType<typeof useStore.getState>): SpreadsView {
  const fx = state.fx.usdKrw;

  const dexPrices: Record<Chain, NormalizedPrice> = {
    base: buildDex(state, 'base', fx),
    eth: buildDex(state, 'eth', fx),
    arbitrum: buildDex(state, 'arbitrum', fx),
  };

  const cexPrices: Record<CexVenue, NormalizedPrice> = {
    binance: buildCex(state, 'binance', fx),
    upbit: buildCex(state, 'upbit', fx),
    bithumb: buildCex(state, 'bithumb', fx),
  };

  const cells: SpreadCell[] = [];
  const cexKeys: CexVenue[] = ['binance', 'upbit', 'bithumb'];
  const dexKeys: Chain[] = ['base', 'eth', 'arbitrum'];

  for (const dex of dexKeys) {
    for (const cex of cexKeys) {
      const source = dexPrices[dex];
      const sink = cexPrices[cex];
      cells.push(makeCell(source, sink, dex, cex));
    }
  }
  for (let i = 0; i < cexKeys.length; i++) {
    for (let j = 0; j < cexKeys.length; j++) {
      if (i === j) continue;
      const source = cexPrices[cexKeys[i]];
      const sink = cexPrices[cexKeys[j]];
      cells.push(makeCell(source, sink, cexKeys[i], cexKeys[j]));
    }
  }

  let best: BestRoute | null = null;
  for (const cell of cells) {
    if (
      cell.spreadPct == null ||
      cell.sourceUsd == null ||
      cell.sinkUsd == null ||
      cell.spreadAbsUsd == null
    )
      continue;
    if (cell.spreadPct <= 0) continue;
    if (!best || cell.spreadPct > best.spreadPct) {
      best = {
        sourceKey: cell.sourceKey,
        sinkKey: cell.sinkKey,
        sourceLabel: cell.sourceLabel,
        sinkLabel: cell.sinkLabel,
        sourceUsd: cell.sourceUsd,
        sinkUsd: cell.sinkUsd,
        spreadPct: cell.spreadPct,
        spreadAbsUsd: cell.spreadAbsUsd,
      };
    }
  }

  return { dexPrices, cexPrices, matrix: cells, best, fxUsdKrw: fx };
}

function makeCell(
  source: NormalizedPrice,
  sink: NormalizedPrice,
  sourceKey: string,
  sinkKey: string,
): SpreadCell {
  const su = source.priceUsd;
  const xu = sink.priceUsd;
  let spreadPct: number | null = null;
  let spreadAbsUsd: number | null = null;
  if (su != null && xu != null && su > 0) {
    spreadPct = ((xu - su) / su) * 100;
    spreadAbsUsd = xu - su;
  }
  return {
    sourceLabel: source.label,
    sinkLabel: sink.label,
    sourceKey,
    sinkKey,
    sourceUsd: su,
    sinkUsd: xu,
    spreadPct,
    spreadAbsUsd,
  };
}

function buildDex(
  state: ReturnType<typeof useStore.getState>,
  chain: Chain,
  fx: number | null,
): NormalizedPrice {
  const pool = state.pools[chain];
  const priceUsd = pool?.priceUsd ?? null;
  const priceKrw = priceUsd != null && fx != null ? priceUsd * fx : null;
  const label = `DEX · ${chain.toUpperCase()}`;
  return { priceUsd, priceKrw, label, sourceId: chain };
}

function buildCex(
  state: ReturnType<typeof useStore.getState>,
  venue: CexVenue,
  fx: number | null,
): NormalizedPrice {
  const t = state.tickers[venue];
  let priceUsd: number | null = null;
  let priceKrw: number | null = null;
  if (t?.last != null) {
    if (t.quote === 'USDT') {
      priceUsd = t.last;
      priceKrw = fx != null ? t.last * fx : null;
    } else {
      priceKrw = t.last;
      priceUsd = fx != null && fx > 0 ? t.last / fx : null;
    }
  }
  const labels = { binance: 'Binance (USDT)', upbit: 'Upbit (KRW)', bithumb: 'Bithumb (KRW)' };
  return { priceUsd, priceKrw, label: labels[venue], sourceId: venue };
}
