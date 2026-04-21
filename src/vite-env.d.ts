/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STANDIN_MODE?: 'BTC' | 'ETH' | 'OFF' | 'LIVE';
  readonly VITE_WS_PROXY_URL?: string;
  readonly VITE_ACROSS_INTEGRATOR_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
