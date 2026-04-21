export type Chain = 'base' | 'eth' | 'arbitrum';
export type CexVenue = 'binance' | 'upbit' | 'bithumb';
export type SourceId = Chain | CexVenue;

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error' | 'idle';

export interface Ticker {
  venue: CexVenue;
  symbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  quote: 'USDT' | 'KRW';
  updatedAt: number;
}

export interface PoolQuote {
  chain: Chain;
  poolAddress: string | null;
  dexName: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  fdvUsd: number | null;
  updatedAt: number;
  state: 'no-pool' | 'live' | 'error';
  errorMessage?: string;
}

export interface FxState {
  usdKrw: number | null;
  source: 'upbit-implied' | 'exchangerate' | 'manual' | null;
  updatedAt: number;
}

export interface BridgeQuote {
  origin: Chain;
  destination: Chain;
  inputAmountUsd: number;
  etaSeconds: number | null;
  totalFeeUsd: number | null;
  provider: 'across' | 'stargate' | 'native' | 'orbiter';
  state: 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';
  message?: string;
  updatedAt: number;
}

export interface ListingSchedule {
  venue: CexVenue;
  tradingOpenAtMs: number | null;
  depositOpenAtMs: number | null;
  withdrawOpenAtMs: number | null;
}

export interface SourceStatus {
  id: SourceId;
  status: WsStatus;
  lastTickAgeMs: number | null;
  rawSymbol: string | null;
  note?: string;
}

export interface DepositNetworkEntry {
  venue: CexVenue;
  chain: Chain | 'unknown';
  confirmed: boolean;
  note?: string;
}
