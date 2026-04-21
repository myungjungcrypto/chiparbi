import { useStore } from '@/state/store';
import { CHAIN_IDS } from '@/lib/symbols';
import type { BridgeQuote, Chain } from '@/lib/types';

const USDC: Record<Chain, string> = {
  eth: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
};

interface AcrossResponse {
  totalRelayFee?: { total?: string };
  estimatedFillTimeSec?: number;
  isAmountTooLow?: boolean;
  timestamp?: number;
}

export async function fetchAcrossQuote(
  origin: Chain,
  destination: Chain,
  usdAmount = 1000,
): Promise<BridgeQuote> {
  const originChainId = CHAIN_IDS[origin];
  const destChainId = CHAIN_IDS[destination];
  const inputToken = USDC[origin];
  const amount = (BigInt(Math.floor(usdAmount)) * 1_000_000n).toString();
  const url = `https://app.across.to/api/suggested-fees?token=${inputToken}&originChainId=${originChainId}&destinationChainId=${destChainId}&amount=${amount}`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      return {
        origin,
        destination,
        inputAmountUsd: usdAmount,
        etaSeconds: null,
        totalFeeUsd: null,
        provider: 'across',
        state: 'unsupported',
        message: `Across: HTTP ${r.status} (token/pair likely not allowlisted for CHIP — use fallback)`,
        updatedAt: Date.now(),
      };
    }
    const j = (await r.json()) as AcrossResponse;
    const feeTotalRaw = j?.totalRelayFee?.total;
    const feeUsd = feeTotalRaw ? Number(feeTotalRaw) / 1_000_000 : null;
    const eta = j?.estimatedFillTimeSec ?? null;
    return {
      origin,
      destination,
      inputAmountUsd: usdAmount,
      etaSeconds: eta,
      totalFeeUsd: Number.isFinite(feeUsd as number) ? feeUsd : null,
      provider: 'across',
      state: 'ready',
      message: 'USDC quote (reference — CHIP bridging may differ)',
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      origin,
      destination,
      inputAmountUsd: usdAmount,
      etaSeconds: null,
      totalFeeUsd: null,
      provider: 'across',
      state: 'error',
      message: err instanceof Error ? err.message : 'unknown',
      updatedAt: Date.now(),
    };
  }
}

export function startAcrossLoop(intervalMs = 30_000): () => void {
  const run = async () => {
    const q = await fetchAcrossQuote('base', 'arbitrum');
    useStore.getState().setBridgeQuote(q);
  };
  void run();
  const id = window.setInterval(() => void run(), intervalMs);
  return () => window.clearInterval(id);
}
