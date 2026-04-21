import { useStore } from '@/state/store';

type BookTicker = {
  u: number;
  s: string;
  b: string;
  B: string;
  a: string;
  A: string;
};

export function startBinance(symbol: string): () => void {
  const lower = symbol.toLowerCase();
  const url = `wss://stream.binance.com:9443/ws/${lower}@bookTicker`;
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let closedByUser = false;

  const connect = () => {
    useStore.getState().setSourceStatus('binance', { status: 'connecting', rawSymbol: symbol });
    ws = new WebSocket(url);

    ws.onopen = () => {
      useStore.getState().setSourceStatus('binance', { status: 'open' });
    };
    ws.onerror = () => {
      useStore.getState().setSourceStatus('binance', { status: 'error' });
    };
    ws.onclose = () => {
      useStore.getState().setSourceStatus('binance', { status: 'closed' });
      if (!closedByUser) {
        reconnectTimer = window.setTimeout(connect, 2000);
      }
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data) as BookTicker;
        if (!m?.s) return;
        const bid = parseFloat(m.b);
        const ask = parseFloat(m.a);
        const last = bid && ask ? (bid + ask) / 2 : null;
        useStore.getState().setTicker('binance', {
          venue: 'binance',
          symbol: m.s,
          bid: Number.isFinite(bid) ? bid : null,
          ask: Number.isFinite(ask) ? ask : null,
          last,
          quote: 'USDT',
          updatedAt: Date.now(),
        });
      } catch {
        // ignore
      }
    };
  };

  connect();

  return () => {
    closedByUser = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}
