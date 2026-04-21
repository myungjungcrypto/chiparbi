import { useStore } from '@/state/store';

interface Route {
  label: string;
  provider: string;
  etaNote: string;
  feeNote: string;
  url: string;
  warning?: string;
}

const ROUTES: Route[] = [
  {
    label: 'Base → Arbitrum',
    provider: 'Across (intent)',
    etaNote: '~1-3 min',
    feeNote: '~$0.04-0.50 USDC (native token bridging requires allowlist)',
    url: 'https://app.across.to/bridge?inputChainId=8453&outputChainId=42161',
    warning: 'Across may not support $CHIP on day 1. Confirm allowlist before large txs.',
  },
  {
    label: 'Base → Arbitrum',
    provider: 'Stargate (OFT/LayerZero)',
    etaNote: '~3-10 min',
    feeNote: 'works if $CHIP is an OFT on both chains',
    url: 'https://stargate.finance/bridge',
  },
  {
    label: 'Ethereum → Arbitrum',
    provider: 'Arbitrum Native Bridge',
    etaNote: '~10-15 min',
    feeNote: 'only for tokens canonically bridgeable from L1',
    url: 'https://bridge.arbitrum.io/',
  },
  {
    label: 'Base → Arbitrum',
    provider: 'Orbiter Finance',
    etaNote: '~1-5 min',
    feeNote: 'per-token allowlist',
    url: 'https://www.orbiter.finance/',
  },
];

export function BridgePanel() {
  const q = useStore((s) => s.bridgeQuote);
  return (
    <div className="border border-ink-700 rounded bg-ink-800">
      <div className="px-3 py-2 border-b border-ink-700 text-sm font-semibold flex items-center gap-2">
        Bridge Options
        <span className="text-[10px] font-normal text-ink-400 font-mono">
          Target chain = Arbitrum (Upbit deposit network)
        </span>
      </div>
      <div className="p-3 space-y-2">
        {q && (
          <div className="text-xs font-mono text-ink-300 mb-2">
            Across live quote (USDC BASE→ARB, $1000):
            <span className="ml-2 text-ink-100">
              state={q.state} · fee={q.totalFeeUsd != null ? `$${q.totalFeeUsd.toFixed(2)}` : '—'} ·
              eta={q.etaSeconds != null ? `${q.etaSeconds}s` : '—'}
            </span>
            {q.message && <div className="text-ink-400">{q.message}</div>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ROUTES.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="block border border-ink-700 rounded p-2 hover:border-accent-blue hover:bg-ink-700"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-ink-100 font-semibold">{r.label}</span>
                <span className="text-ink-300">{r.provider}</span>
              </div>
              <div className="text-[11px] text-ink-400 font-mono mt-1">
                ETA {r.etaNote} · {r.feeNote}
              </div>
              {r.warning && (
                <div className="text-[11px] text-accent-yellow font-mono mt-1">⚠ {r.warning}</div>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
