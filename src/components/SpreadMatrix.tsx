import { useStore } from '@/state/store';
import { selectSpreadsView } from '@/state/spreads';
import type { SpreadCell } from '@/state/spreads';

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function pctColor(v: number | null): string {
  if (v == null) return 'text-ink-400';
  if (v >= 20) return 'text-accent-green font-semibold';
  if (v >= 5) return 'text-accent-green';
  if (v >= 0) return 'text-ink-100';
  if (v >= -5) return 'text-ink-300';
  return 'text-accent-red';
}

export function SpreadMatrix() {
  const state = useStore();
  const { matrix } = selectSpreadsView(state);

  const sources = Array.from(new Set(matrix.map((c) => c.sourceKey)));
  const sinks = Array.from(new Set(matrix.map((c) => c.sinkKey)));

  const cellMap = new Map<string, SpreadCell>();
  for (const c of matrix) cellMap.set(`${c.sourceKey}->${c.sinkKey}`, c);

  const firstCell = (src: string) => matrix.find((c) => c.sourceKey === src);
  const firstSinkCell = (sink: string) => matrix.find((c) => c.sinkKey === sink);

  return (
    <div className="border border-ink-700 rounded bg-ink-800">
      <div className="px-3 py-2 border-b border-ink-700 text-sm font-semibold">
        Spread Matrix (<span className="text-ink-300">Buy row → Sell column</span>)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-ink-300">
              <th className="text-left p-2">From \ To</th>
              {sinks.map((sink) => (
                <th key={sink} className="text-right p-2">
                  {firstSinkCell(sink)?.sinkLabel ?? sink}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((src) => (
              <tr key={src} className="border-t border-ink-700">
                <td className="p-2 text-ink-200">{firstCell(src)?.sourceLabel ?? src}</td>
                {sinks.map((sink) => {
                  if (src === sink) return <td key={sink} className="p-2 text-right text-ink-500">—</td>;
                  const c = cellMap.get(`${src}->${sink}`);
                  return (
                    <td key={sink} className={`p-2 text-right ${pctColor(c?.spreadPct ?? null)}`}>
                      {fmtPct(c?.spreadPct ?? null)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
