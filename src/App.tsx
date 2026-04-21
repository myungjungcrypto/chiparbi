import { useEffect } from 'react';
import { StatusBar } from '@/components/StatusBar';
import { PriceGrid } from '@/components/PriceGrid';
import { SpreadMatrix } from '@/components/SpreadMatrix';
import { BestRouteCard } from '@/components/BestRouteCard';
import { BridgePanel } from '@/components/BridgePanel';
import { DepositNetworks } from '@/components/DepositNetworks';
import { CountdownBar } from '@/components/CountdownBar';
import { RiskBanner } from '@/components/RiskBanner';
import { startBinance } from '@/sources/binanceWs';
import { startUpbit } from '@/sources/upbitWs';
import { startBithumb } from '@/sources/bithumbWs';
import { startGeckoTerminal } from '@/sources/geckoTerminal';
import { startDexScreener } from '@/sources/dexscreener';
import { startAcrossLoop } from '@/sources/acrossQuote';
import { startFxLoop } from '@/lib/fx';
import { resolveSymbols } from '@/lib/symbols';

export default function App() {
  useEffect(() => {
    const { symbols, mode } = resolveSymbols();
    const stops = [
      startBinance(symbols.binance),
      startUpbit(symbols.upbit),
      startBithumb(symbols.bithumb),
      startGeckoTerminal(),
      startDexScreener(),
      startAcrossLoop(),
      startFxLoop(),
    ];
    console.info(`[chiparbi] mode=${mode}`, symbols);
    return () => {
      for (const s of stops) s();
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink-900 text-ink-100">
      <header className="border-b border-ink-700 px-4 py-3 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold">$CHIP Arb Dashboard</h1>
          <p className="text-xs text-ink-400 font-mono">
            CEX × DEX spread monitor · BASE/ETH/ARB → Binance/Upbit/Bithumb
          </p>
        </div>
        <div className="text-xs text-ink-400 font-mono">
          Monitoring only · No execution · KR egress
        </div>
      </header>
      <StatusBar />
      <main className="p-4 space-y-4 max-w-[1400px] mx-auto">
        <RiskBanner />
        <CountdownBar />
        <BestRouteCard />
        <PriceGrid />
        <SpreadMatrix />
        <BridgePanel />
        <DepositNetworks />
        <footer className="text-center text-[11px] text-ink-500 py-4 font-mono">
          chiparbi · built for $CHIP TGE monitoring · data: Binance, Upbit, Bithumb WS · GeckoTerminal, DEX Screener REST · Across REST
        </footer>
      </main>
    </div>
  );
}
