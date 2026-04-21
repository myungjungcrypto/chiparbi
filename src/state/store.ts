import { create } from 'zustand';
import type {
  BridgeQuote,
  Chain,
  CexVenue,
  DepositNetworkEntry,
  FxState,
  ListingSchedule,
  PoolQuote,
  SourceId,
  SourceStatus,
  Ticker,
  WsStatus,
} from '@/lib/types';
import { kstTodayAt } from '@/lib/time';

interface Store {
  tickers: Record<CexVenue, Ticker | null>;
  pools: Record<Chain, PoolQuote | null>;
  fx: FxState;
  bridgeQuote: BridgeQuote | null;
  sources: Record<SourceId, SourceStatus>;
  schedules: Record<CexVenue, ListingSchedule>;
  depositNetworks: Record<CexVenue, DepositNetworkEntry>;

  setTicker: (v: CexVenue, t: Ticker) => void;
  setPool: (c: Chain, p: PoolQuote) => void;
  setFx: (fx: FxState) => void;
  setBridgeQuote: (q: BridgeQuote) => void;
  setSourceStatus: (id: SourceId, patch: Partial<SourceStatus>) => void;
  setSchedule: (v: CexVenue, patch: Partial<ListingSchedule>) => void;
  setDepositNetwork: (v: CexVenue, patch: Partial<DepositNetworkEntry>) => void;
}

const emptyStatus = (id: SourceId): SourceStatus => ({
  id,
  status: 'idle' as WsStatus,
  lastTickAgeMs: null,
  rawSymbol: null,
});

export const useStore = create<Store>((set) => ({
  tickers: { binance: null, upbit: null, bithumb: null },
  pools: { base: null, eth: null, arbitrum: null },
  fx: { usdKrw: null, source: null, updatedAt: 0 },
  bridgeQuote: null,
  sources: {
    binance: emptyStatus('binance'),
    upbit: emptyStatus('upbit'),
    bithumb: emptyStatus('bithumb'),
    base: emptyStatus('base'),
    eth: emptyStatus('eth'),
    arbitrum: emptyStatus('arbitrum'),
  },
  schedules: {
    binance: { venue: 'binance', tradingOpenAtMs: kstTodayAt(22, 0), depositOpenAtMs: null, withdrawOpenAtMs: null },
    upbit: { venue: 'upbit', tradingOpenAtMs: kstTodayAt(22, 0), depositOpenAtMs: null, withdrawOpenAtMs: null },
    bithumb: { venue: 'bithumb', tradingOpenAtMs: kstTodayAt(22, 0), depositOpenAtMs: null, withdrawOpenAtMs: null },
  },
  depositNetworks: {
    binance: { venue: 'binance', chain: 'unknown', confirmed: false, note: 'Check official listing notice' },
    upbit: { venue: 'upbit', chain: 'arbitrum', confirmed: true, note: 'User-confirmed: ARB' },
    bithumb: { venue: 'bithumb', chain: 'unknown', confirmed: false, note: 'Check official listing notice' },
  },

  setTicker: (v, t) =>
    set((s) => ({
      tickers: { ...s.tickers, [v]: t },
      sources: {
        ...s.sources,
        [v]: { ...s.sources[v], lastTickAgeMs: 0, rawSymbol: t.symbol, status: 'open' },
      },
    })),
  setPool: (c, p) =>
    set((s) => ({
      pools: { ...s.pools, [c]: p },
      sources: {
        ...s.sources,
        [c]: {
          ...s.sources[c],
          status: p.state === 'live' ? 'open' : p.state === 'error' ? 'error' : 'idle',
          lastTickAgeMs: 0,
          rawSymbol: p.poolAddress ?? null,
        },
      },
    })),
  setFx: (fx) => set(() => ({ fx })),
  setBridgeQuote: (q) => set(() => ({ bridgeQuote: q })),
  setSourceStatus: (id, patch) =>
    set((s) => ({ sources: { ...s.sources, [id]: { ...s.sources[id], ...patch } } })),
  setSchedule: (v, patch) =>
    set((s) => ({ schedules: { ...s.schedules, [v]: { ...s.schedules[v], ...patch } } })),
  setDepositNetwork: (v, patch) =>
    set((s) => ({ depositNetworks: { ...s.depositNetworks, [v]: { ...s.depositNetworks[v], ...patch } } })),
}));
