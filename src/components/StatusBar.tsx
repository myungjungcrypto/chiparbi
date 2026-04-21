import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import type { SourceId, SourceStatus } from '@/lib/types';
import { formatAge } from '@/lib/time';

const LABEL: Record<SourceId, string> = {
  binance: 'Binance',
  upbit: 'Upbit',
  bithumb: 'Bithumb',
  base: 'DEX · Base',
  eth: 'DEX · ETH',
  arbitrum: 'DEX · ARB',
};

function dotColor(s: SourceStatus['status']): string {
  switch (s) {
    case 'open':
      return 'bg-accent-green';
    case 'connecting':
      return 'bg-accent-yellow animate-pulse';
    case 'error':
      return 'bg-accent-red';
    case 'closed':
      return 'bg-ink-400';
    default:
      return 'bg-ink-500';
  }
}

export function StatusBar() {
  const sources = useStore((s) => s.sources);
  const tickers = useStore((s) => s.tickers);
  const pools = useStore((s) => s.pools);
  const fx = useStore((s) => s.fx);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const order: SourceId[] = ['binance', 'upbit', 'bithumb', 'base', 'eth', 'arbitrum'];

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 border-b border-ink-700 text-xs font-mono">
      {order.map((id) => {
        const s = sources[id];
        let lastMs = 0;
        if (id === 'binance' || id === 'upbit' || id === 'bithumb') {
          lastMs = tickers[id]?.updatedAt ?? 0;
        } else {
          lastMs = pools[id]?.updatedAt ?? 0;
        }
        const age = lastMs ? now - lastMs : null;
        const stale = age != null && age > 10_000;
        return (
          <div
            key={id}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-ink-800 border border-ink-700"
            title={s.note ?? ''}
          >
            <span className={`h-2 w-2 rounded-full ${dotColor(s.status)}`} />
            <span className="text-ink-100">{LABEL[id]}</span>
            <span className="text-ink-300">{s.rawSymbol ?? '—'}</span>
            <span className={stale ? 'text-accent-red' : 'text-ink-400'}>
              {formatAge(age)}
            </span>
          </div>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-ink-300">USD/KRW</span>
        <span className="text-ink-100">
          {fx.usdKrw ? fx.usdKrw.toFixed(2) : '—'}
        </span>
        <span className="text-ink-400">({fx.source ?? 'no src'})</span>
      </div>
    </div>
  );
}
