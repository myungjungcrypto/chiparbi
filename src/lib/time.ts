export function nowMs(): number {
  return Date.now();
}

export function formatAge(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatCountdown(targetMs: number | null): string {
  if (targetMs == null) return '—';
  const diff = targetMs - Date.now();
  const sign = diff < 0 ? '+' : '-';
  const abs = Math.abs(diff);
  const s = Math.floor(abs / 1000);
  const hh = Math.floor(s / 3600).toString().padStart(2, '0');
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `T${sign}${hh}:${mm}:${ss}`;
}

export function kstTodayAt(hh: number, mm = 0): number {
  const kstNowMs = Date.now() + 9 * 3600 * 1000;
  const kstNow = new Date(kstNowMs);
  const y = kstNow.getUTCFullYear();
  const mo = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  return Date.UTC(y, mo, d, hh - 9, mm, 0, 0);
}
