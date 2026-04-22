import type { LzChain } from './oft';
import { LZ_CHAINS } from './oft';

export interface OftPreset {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  adapters: Record<string, string>;
  adapterIsLockbox: Record<string, boolean>;
  tokenAddresses: Record<string, string>;
  defaultGasLimit: number;
  builtin?: boolean;
  notes?: string;
}

const STORAGE_KEY = 'chiparbi.oftPresets.v1';

export const CHIP_BUILTIN: OftPreset = {
  id: 'chip',
  name: 'CHIP (USD.AI)',
  symbol: 'CHIP',
  decimals: 18,
  adapters: {
    ethereum: '0xffC1002994B1e9A744036d0abDAefe8356B7cF4e',
    base: '',
    arbitrum: '',
  },
  adapterIsLockbox: {
    ethereum: true,
    base: false,
    arbitrum: false,
  },
  tokenAddresses: {
    ethereum: '0x0C1c1C109FE34733fca54b82d7B46B75CFb71F6e',
    base: '0x0C1c1C109FE34733fca54b82d7B46B75CFb71F6e',
    arbitrum: '0x0C1c1C109FE34733fca54b82d7B46B75CFb71F6e',
  },
  defaultGasLimit: 80_000,
  builtin: true,
  notes: 'Ethereum adapter is a lockbox (OFTAdapter) — approve CHIP before send(). Base/Arbitrum adapter addresses are blank; look them up via USD.AI Deployer on the relevant explorer.',
};

function load(): OftPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [CHIP_BUILTIN];
    const parsed = JSON.parse(raw) as OftPreset[];
    if (!Array.isArray(parsed)) return [CHIP_BUILTIN];
    const hasChip = parsed.some((p) => p.id === 'chip');
    return hasChip ? parsed : [CHIP_BUILTIN, ...parsed];
  } catch {
    return [CHIP_BUILTIN];
  }
}

function save(list: OftPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export function getPresets(): OftPreset[] {
  return load();
}

export function upsertPreset(preset: OftPreset): OftPreset[] {
  const list = load();
  const idx = list.findIndex((p) => p.id === preset.id);
  if (idx >= 0) list[idx] = preset;
  else list.push(preset);
  save(list);
  return list;
}

export function deletePreset(id: string): OftPreset[] {
  const list = load().filter((p) => !(p.id === id && !p.builtin));
  save(list);
  return list;
}

export function resetPresets(): OftPreset[] {
  save([CHIP_BUILTIN]);
  return [CHIP_BUILTIN];
}

export function emptyPreset(): OftPreset {
  const adapters: Record<string, string> = {};
  const lockbox: Record<string, boolean> = {};
  const tokens: Record<string, string> = {};
  for (const c of LZ_CHAINS as LzChain[]) {
    adapters[c.key] = '';
    lockbox[c.key] = false;
    tokens[c.key] = '';
  }
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: '',
    symbol: '',
    decimals: 18,
    adapters,
    adapterIsLockbox: lockbox,
    tokenAddresses: tokens,
    defaultGasLimit: 80_000,
    builtin: false,
  };
}
