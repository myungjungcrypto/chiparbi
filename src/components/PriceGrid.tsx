import { useStore } from '@/state/store';
import { selectSpreadsView } from '@/state/spreads';
import { CHAIN_LABEL, EXPLORER_URL, CHIP_ADDRESSES, VENUE_LABEL } from '@/lib/symbols';
import type { Chain, CexVenue } from '@/lib/types';
import { formatAge } from '@/lib/time';
import { useEffect, useState } from 'react';

function fmtUsd(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1000) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function fmtKrw(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1000) return `₩${v.toFixed(0)}`;
  return `₩${v.toFixed(2)}`;
}

function fmtLiq(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function PriceGrid() {
  const state = useStore();
  const view = selectSpreadsView(state);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const dexRows: Chain[] = ['base', 'eth', 'arbitrum'];
  const cexRows: CexVenue[] = ['binance', 'upbit', 'bithumb'];

  const cheapestUsd = Math.min(
    ...[
      ...dexRows.map((c) => view.dexPrices[c].priceUsd ?? Infinity),
      ...cexRows.map((c) => view.cexPrices[c].priceUsd ?? Infinity),
    ],
  );
  const richestUsd = Math.max(
    ...[
      ...dexRows.map((c) => view.dexPrices[c].priceUsd ?? -Infinity),
      ...cexRows.map((c) => view.cexPrices[c].priceUsd ?? -Infinity),
    ],
  );

  return (
    <div className="border border-ink-700 rounded bg-ink-800">
      <div className="px-3 py-2 border-b border-ink-700 text-sm font-semibold">
        Price Grid
      </div>
      <table className="w-full text-xs font-mono">
        <thead className="text-ink-300">
          <tr>
            <th className="text-left p-2">Source</th>
            <th className="text-right p-2">USD</th>
            <th className="text-right p-2">KRW</th>
            <th className="text-right p-2">Liquidity</th>
            <th className="text-right p-2">24h Vol</th>
            <th className="text-right p-2">FDV</th>
            <th className="text-right p-2">Age</th>
            <th className="text-left p-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {dexRows.map((chain) => {
            const pool = state.pools[chain];
            const row = view.dexPrices[chain];
            const isCheap = row.priceUsd != null && row.priceUsd === cheapestUsd;
            const isRich = row.priceUsd != null && row.priceUsd === richestUsd;
            const age = pool?.updatedAt ? now - pool.updatedAt : null;
            return (
              <tr key={chain} className="border-t border-ink-700">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] bg-ink-700 rounded">DEX</span>
                    <span>{CHAIN_LABEL[chain]}</span>
                  </div>
                </td>
                <td className={`text-right p-2 ${isCheap ? 'text-accent-green' : isRich ? 'text-accent-red' : ''}`}>
                  {pool?.state === 'no-pool'
                    ? <span className="text-ink-400">no pool yet</span>
                    : pool?.state === 'error'
                      ? <span className="text-accent-red">err</span>
                      : fmtUsd(row.priceUsd)}
                </td>
                <td className="text-right p-2">{fmtKrw(row.priceKrw)}</td>
                <td className="text-right p-2">{fmtLiq(pool?.liquidityUsd ?? null)}</td>
                <td className="text-right p-2">{fmtLiq(pool?.volume24hUsd ?? null)}</td>
                <td className="text-right p-2">{fmtLiq(pool?.fdvUsd ?? null)}</td>
                <td className="text-right p-2 text-ink-400">{formatAge(age)}</td>
                <td className="p-2 text-ink-300">
                  <a
                    className="hover:text-accent-blue"
                    href={`${EXPLORER_URL[chain]}/token/${CHIP_ADDRESSES[chain]}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {pool?.dexName ?? '—'} ↗
                  </a>
                </td>
              </tr>
            );
          })}

          {cexRows.map((venue) => {
            const t = state.tickers[venue];
            const row = view.cexPrices[venue];
            const isCheap = row.priceUsd != null && row.priceUsd === cheapestUsd;
            const isRich = row.priceUsd != null && row.priceUsd === richestUsd;
            const age = t?.updatedAt ? now - t.updatedAt : null;
            return (
              <tr key={venue} className="border-t border-ink-700">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] bg-ink-700 rounded">CEX</span>
                    <span>{VENUE_LABEL[venue]}</span>
                  </div>
                </td>
                <td className={`text-right p-2 ${isCheap ? 'text-accent-green' : isRich ? 'text-accent-red' : ''}`}>
                  {fmtUsd(row.priceUsd)}
                </td>
                <td className="text-right p-2">{fmtKrw(row.priceKrw)}</td>
                <td className="text-right p-2 text-ink-500">—</td>
                <td className="text-right p-2 text-ink-500">—</td>
                <td className="text-right p-2 text-ink-500">—</td>
                <td className="text-right p-2 text-ink-400">{formatAge(age)}</td>
                <td className="p-2 text-ink-300">{t?.symbol ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
