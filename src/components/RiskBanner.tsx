import { resolveSymbols, CHIP_TOKEN_ADDRESS } from '@/lib/symbols';

export function RiskBanner() {
  const { mode } = resolveSymbols();
  return (
    <div className="border border-accent-yellow/40 bg-accent-yellow/5 rounded p-3 text-xs font-mono space-y-1">
      {mode !== 'LIVE' && (
        <div className="text-accent-yellow">
          ⚠ STAND-IN MODE ({mode}). CEX rows subscribe to {mode}/USDT·KRW; DEX rows query WETH.
          Flip <code className="text-ink-100">VITE_STANDIN_MODE=OFF</code> (or edit{' '}
          <code>src/lib/symbols.ts</code>) at T-5min to go live.
        </div>
      )}
      <div className="text-ink-300">
        ⚠ Same token address on Base/Ethereum/Arbitrum ({CHIP_TOKEN_ADDRESS.slice(0, 10)}…) — likely
        vanity. If $CHIP is NOT an OFT/xERC20, balances are chain-independent and you cannot bridge
        between them. <strong className="text-accent-yellow">Verify token standard on each
          explorer before a large trade.</strong>
      </div>
      <div className="text-ink-300">
        ⚠ Only Upbit=ARB is user-confirmed. Fill Binance & Bithumb deposit networks from their
        official listing notices as they drop.
      </div>
      <div className="text-ink-300">
        ⚠ Across Protocol's bridge-token allowlist likely won't include $CHIP at T+0. Primary plan
        for CHIP movement between chains: Stargate (if OFT), native L1↔L2 bridge, Orbiter.
      </div>
    </div>
  );
}
