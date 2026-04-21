import { useStore } from '@/state/store';

type BithumbTickerPayload = {
  type: string;
  content?: {
    symbol?: string;
    closePrice?: string;
    tickType?: string;
  };
};

export function startBithumb(symbol: string): () => void {
  const url = 'wss://pubwss.bithumb.com/pub/ws';
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let pollTimer: number | null = null;
  let closedByUser = false;
  let usingRestFallback = false;

  const subscribe = () => {
    const msg = {
      type: 'ticker',
      symbols: [symbol],
      tickTypes: ['30M', '1H', '24H'],
    };
    ws?.send(JSON.stringify(msg));
  };

  const startRestFallback = () => {
    if (usingRestFallback) return;
    usingRestFallback = true;
    useStore.getState().setSourceStatus('bithumb', {
      status: 'open',
      note: 'REST fallback (WS unavailable)',
      rawSymbol: symbol,
    });
    const [base, quote] = symbol.split('_');
    const restUrl = `https://api.bithumb.com/public/ticker/${base}_${quote}`;
    const poll = async () => {
      try {
        const r = await fetch(restUrl);
        if (!r.ok) return;
        const j = (await r.json()) as { status?: string; data?: { closing_price?: string } };
        if (j?.status !== '0000') return;
        const last = parseFloat(j?.data?.closing_price ?? '');
        if (!Number.isFinite(last)) return;
        useStore.getState().setTicker('bithumb', {
          venue: 'bithumb',
          symbol,
          bid: null,
          ask: null,
          last,
          quote: 'KRW',
          updatedAt: Date.now(),
        });
      } catch {
        // ignore
      }
    };
    void poll();
    pollTimer = window.setInterval(() => void poll(), 1500);
  };

  const connect = () => {
    useStore.getState().setSourceStatus('bithumb', { status: 'connecting', rawSymbol: symbol });
    try {
      ws = new WebSocket(url);
    } catch {
      startRestFallback();
      return;
    }

    const connectTimeout = window.setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        ws.close();
        startRestFallback();
      }
    }, 5000);

    ws.onopen = () => {
      window.clearTimeout(connectTimeout);
      useStore.getState().setSourceStatus('bithumb', { status: 'open' });
      subscribe();
    };
    ws.onerror = () => {
      useStore.getState().setSourceStatus('bithumb', { status: 'error' });
    };
    ws.onclose = () => {
      window.clearTimeout(connectTimeout);
      useStore.getState().setSourceStatus('bithumb', { status: 'closed' });
      if (!closedByUser && !usingRestFallback) {
        reconnectTimer = window.setTimeout(() => {
          startRestFallback();
        }, 2000);
      }
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as BithumbTickerPayload;
        if (m.type !== 'ticker' || !m.content) return;
        if (m.content.tickType && m.content.tickType !== '24H') return;
        const sym = m.content.symbol ?? symbol;
        const last = parseFloat(m.content.closePrice ?? '');
        if (!Number.isFinite(last)) return;
        useStore.getState().setTicker('bithumb', {
          venue: 'bithumb',
          symbol: sym,
          bid: null,
          ask: null,
          last,
          quote: 'KRW',
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
    if (pollTimer) window.clearInterval(pollTimer);
    ws?.close();
  };
}
