import { useStore } from '@/state/store';
import { selectSpreadsView } from '@/state/spreads';

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1000) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

export function BestRouteCard() {
  const state = useStore();
  const { best, fxUsdKrw } = selectSpreadsView(state);
  const bridgeQuote = state.bridgeQuote;

  return (
    <div className="border border-ink-700 rounded bg-ink-800 p-3">
      <div className="text-sm font-semibold mb-2">Best Route</div>
      {!best ? (
        <div className="text-ink-400 text-sm font-mono">
          No positive-spread route yet. Waiting for liquidity & listings…
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2 font-mono text-sm">
            <span className="text-ink-300">BUY</span>
            <span className="text-accent-green">{best.sourceLabel}</span>
            <span className="text-ink-400">@ {fmtUsd(best.sourceUsd)}</span>
            <span className="text-ink-400">→</span>
            <span className="text-ink-300">SELL</span>
            <span className="text-accent-red">{best.sinkLabel}</span>
            <span className="text-ink-400">@ {fmtUsd(best.sinkUsd)}</span>
          </div>
          <div className="font-mono">
            <span className="text-accent-green text-lg font-semibold">
              +{best.spreadPct.toFixed(2)}%
            </span>
            <span className="text-ink-300 ml-2">
              ({fmtUsd(best.spreadAbsUsd)} per token
              {fxUsdKrw ? ` · ₩${(best.spreadAbsUsd * fxUsdKrw).toFixed(0)}` : ''})
            </span>
          </div>
          {bridgeQuote && bridgeQuote.state === 'ready' && (
            <div className="text-xs text-ink-300 font-mono border-t border-ink-700 pt-2 mt-2">
              Reference USDC bridge ({bridgeQuote.origin.toUpperCase()}→
              {bridgeQuote.destination.toUpperCase()}) via Across: fee {fmtUsd(bridgeQuote.totalFeeUsd)},
              ETA {bridgeQuote.etaSeconds ? `${bridgeQuote.etaSeconds}s` : '—'}
            </div>
          )}
          {bridgeQuote && bridgeQuote.state !== 'ready' && (
            <div className="text-xs text-accent-yellow font-mono border-t border-ink-700 pt-2 mt-2">
              Across: {bridgeQuote.message ?? bridgeQuote.state}. Use native/Stargate/Orbiter fallback.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
