import type { Chain, CexVenue } from './types';

export const CHIP_TOKEN_ADDRESS = '0x0C1c1C109FE34733fca54b82d7B46B75CFb71F6e';

export const CHIP_ADDRESSES: Record<Chain, string> = {
  base: CHIP_TOKEN_ADDRESS,
  eth: CHIP_TOKEN_ADDRESS,
  arbitrum: CHIP_TOKEN_ADDRESS,
};

export const STANDIN_WETH_ADDRESSES: Record<Chain, string> = {
  base: '0x4200000000000000000000000000000000000006',
  eth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
};

export function resolveDexAddresses(): { addresses: Record<Chain, string>; live: boolean } {
  const { mode } = resolveSymbols();
  if (mode === 'LIVE') return { addresses: CHIP_ADDRESSES, live: true };
  return { addresses: STANDIN_WETH_ADDRESSES, live: false };
}

export const CHAIN_IDS: Record<Chain, number> = {
  base: 8453,
  eth: 1,
  arbitrum: 42161,
};

export const CHAIN_LABEL: Record<Chain, string> = {
  base: 'Base',
  eth: 'Ethereum',
  arbitrum: 'Arbitrum',
};

export const GECKOTERMINAL_NETWORK: Record<Chain, string> = {
  base: 'base',
  eth: 'eth',
  arbitrum: 'arbitrum',
};

export const DEXSCREENER_CHAIN: Record<Chain, string> = {
  base: 'base',
  eth: 'ethereum',
  arbitrum: 'arbitrum',
};

export const EXPLORER_URL: Record<Chain, string> = {
  base: 'https://basescan.org',
  eth: 'https://etherscan.io',
  arbitrum: 'https://arbiscan.io',
};

export interface VenueSymbols {
  binance: string;
  upbit: string;
  bithumb: string;
}

export const LIVE_SYMBOLS: VenueSymbols = {
  binance: 'CHIPUSDT',
  upbit: 'KRW-CHIP',
  bithumb: 'CHIP_KRW',
};

export const STANDIN_BTC: VenueSymbols = {
  binance: 'BTCUSDT',
  upbit: 'KRW-BTC',
  bithumb: 'BTC_KRW',
};

export const STANDIN_ETH: VenueSymbols = {
  binance: 'ETHUSDT',
  upbit: 'KRW-ETH',
  bithumb: 'ETH_KRW',
};

export function resolveSymbols(): { symbols: VenueSymbols; mode: 'LIVE' | 'BTC' | 'ETH' } {
  const mode = (import.meta.env.VITE_STANDIN_MODE ?? 'BTC') as 'BTC' | 'ETH' | 'OFF' | 'LIVE';
  if (mode === 'OFF' || mode === 'LIVE') return { symbols: LIVE_SYMBOLS, mode: 'LIVE' };
  if (mode === 'ETH') return { symbols: STANDIN_ETH, mode: 'ETH' };
  return { symbols: STANDIN_BTC, mode: 'BTC' };
}

export const VENUE_LABEL: Record<CexVenue, string> = {
  binance: 'Binance',
  upbit: 'Upbit',
  bithumb: 'Bithumb',
};

export const VENUE_QUOTE: Record<CexVenue, 'USDT' | 'KRW'> = {
  binance: 'USDT',
  upbit: 'KRW',
  bithumb: 'KRW',
};
