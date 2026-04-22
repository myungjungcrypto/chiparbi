import { useState } from 'react';

interface Props {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}

export function CopyField({ label, value, mono = true, multiline = false }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="w-36 shrink-0 text-ink-300 pt-1">{label}</div>
      <div className="flex-1 min-w-0">
        {multiline ? (
          <textarea
            readOnly
            value={value}
            className={`w-full bg-ink-900 border border-ink-700 rounded p-2 ${mono ? 'font-mono' : ''} text-ink-100 resize-y`}
            rows={2}
          />
        ) : (
          <input
            readOnly
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            className={`w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 ${mono ? 'font-mono' : ''} text-ink-100`}
          />
        )}
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 px-2 py-1 text-xs rounded bg-ink-700 hover:bg-ink-600 border border-ink-600"
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}
