import { useStore } from '@/state/store';

type UpbitTicker = {
  type: string;
  code: string;
  trade_price: number;
  prev_closing_price?: number;
  change?: string;
  timestamp: number;
};

export function startUpbit(code: string): () => void {
  const url = 'wss://api.upbit.com/websocket/v1';
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let closedByUser = false;

  const subscribe = () => {
    const payload = [
      { ticket: `chiparbi-${Math.random().toString(36).slice(2)}` },
      { type: 'ticker', codes: [code] },
      { format: 'DEFAULT' },
    ];
    ws?.send(JSON.stringify(payload));
  };

  const connect = () => {
    useStore.getState().setSourceStatus('upbit', { status: 'connecting', rawSymbol: code });
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      useStore.getState().setSourceStatus('upbit', { status: 'open' });
      subscribe();
    };
    ws.onerror = () => {
      useStore.getState().setSourceStatus('upbit', { status: 'error' });
    };
    ws.onclose = () => {
      useStore.getState().setSourceStatus('upbit', { status: 'closed' });
      if (!closedByUser) reconnectTimer = window.setTimeout(connect, 2000);
    };
    ws.onmessage = (ev) => {
      try {
        let text: string;
        if (ev.data instanceof ArrayBuffer) {
          text = new TextDecoder('utf-8').decode(new Uint8Array(ev.data));
        } else if (typeof ev.data === 'string') {
          text = ev.data;
        } else {
          return;
        }
        const m = JSON.parse(text) as UpbitTicker;
        if (m.type !== 'ticker' || !m.code) return;
        const last = typeof m.trade_price === 'number' ? m.trade_price : null;
        useStore.getState().setTicker('upbit', {
          venue: 'upbit',
          symbol: m.code,
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
    ws?.close();
  };
}
