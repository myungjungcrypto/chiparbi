import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import { VENUE_LABEL } from '@/lib/symbols';
import type { CexVenue } from '@/lib/types';
import { formatCountdown } from '@/lib/time';

export function CountdownBar() {
  const schedules = useStore((s) => s.schedules);
  const setSchedule = useStore((s) => s.setSchedule);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const venues: CexVenue[] = ['binance', 'upbit', 'bithumb'];

  const onChange = (v: CexVenue, value: string) => {
    if (!value) {
      setSchedule(v, { tradingOpenAtMs: null });
      return;
    }
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) setSchedule(v, { tradingOpenAtMs: ms });
  };

  const toLocalInput = (ms: number | null): string => {
    if (!ms) return '';
    const d = new Date(ms);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="border border-ink-700 rounded bg-ink-800">
      <div className="px-3 py-2 border-b border-ink-700 text-sm font-semibold">
        TGE Countdowns (editable per exchange)
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {venues.map((v) => {
          const s = schedules[v];
          const isOpen = s.tradingOpenAtMs != null && Date.now() >= s.tradingOpenAtMs;
          return (
            <div key={v} className="border border-ink-700 rounded p-2 bg-ink-900">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{VENUE_LABEL[v]}</span>
                <span className={`text-xs font-mono ${isOpen ? 'text-accent-green' : 'text-accent-yellow'}`}>
                  {isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <div className="text-2xl font-mono mt-1">
                {formatCountdown(s.tradingOpenAtMs)}
              </div>
              <input
                type="datetime-local"
                className="mt-2 w-full bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
                value={toLocalInput(s.tradingOpenAtMs)}
                onChange={(e) => onChange(v, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
