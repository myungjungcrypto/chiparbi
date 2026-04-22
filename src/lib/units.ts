export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  const negative = trimmed.startsWith('-');
  const v = negative ? trimmed.slice(1) : trimmed;
  if (!/^\d*\.?\d*$/.test(v)) throw new Error(`invalid number: ${value}`);
  const [intPart = '0', fracPartRaw = ''] = v.split('.');
  const fracPart = fracPartRaw.slice(0, decimals).padEnd(decimals, '0');
  const combined = (intPart || '0') + fracPart;
  const cleaned = combined.replace(/^0+/, '') || '0';
  const result = BigInt(cleaned);
  return negative ? -result : result;
}

export function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const str = abs.toString().padStart(decimals + 1, '0');
  const int = str.slice(0, -decimals) || '0';
  const frac = str.slice(-decimals).replace(/0+$/, '');
  const out = frac ? `${int}.${frac}` : int;
  return negative ? `-${out}` : out;
}

export function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
}
