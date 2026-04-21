import { useStore } from '@/state/store';

const UPBIT_USDT_KRW_URL = 'https://api.upbit.com/v1/ticker?markets=KRW-USDT';
const FALLBACK_URL = 'https://api.exchangerate.host/latest?base=USD&symbols=KRW';

async function fetchUpbitImplied(): Promise<number | null> {
  try {
    const r = await fetch(UPBIT_USDT_KRW_URL);
    if (!r.ok) return null;
    const j = (await r.json()) as Array<{ trade_price?: number }>;
    const p = j?.[0]?.trade_price;
    return typeof p === 'number' && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function fetchFallback(): Promise<number | null> {
  try {
    const r = await fetch(FALLBACK_URL);
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: { KRW?: number } };
    const p = j?.rates?.KRW;
    return typeof p === 'number' && p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function refreshFx(): Promise<void> {
  const upbit = await fetchUpbitImplied();
  if (upbit) {
    useStore.getState().setFx({ usdKrw: upbit, source: 'upbit-implied', updatedAt: Date.now() });
    return;
  }
  const fb = await fetchFallback();
  if (fb) {
    useStore.getState().setFx({ usdKrw: fb, source: 'exchangerate', updatedAt: Date.now() });
    return;
  }
  useStore.getState().setFx({ usdKrw: null, source: null, updatedAt: Date.now() });
}

export function startFxLoop(intervalMs = 15_000): () => void {
  void refreshFx();
  const id = setInterval(() => void refreshFx(), intervalMs);
  return () => clearInterval(id);
}
