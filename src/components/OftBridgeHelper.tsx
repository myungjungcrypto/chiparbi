import { useEffect, useMemo, useState } from 'react';
import { CopyField } from './CopyField';
import {
  LZ_CHAINS,
  buildSendParam,
  sendParamAsTupleString,
  messagingFeeTupleString,
  addressToBytes32,
} from '@/lib/oft';
import { formatUnits, isValidAddress, parseUnits } from '@/lib/units';
import {
  CHIP_BUILTIN,
  deletePreset,
  emptyPreset,
  getPresets,
  upsertPreset,
  type OftPreset,
} from '@/lib/presets';

export function OftBridgeHelper() {
  const [presets, setPresets] = useState<OftPreset[]>(() => getPresets());
  const [selectedId, setSelectedId] = useState<string>(CHIP_BUILTIN.id);
  const preset = useMemo(
    () => presets.find((p) => p.id === selectedId) ?? presets[0] ?? CHIP_BUILTIN,
    [presets, selectedId],
  );

  const srcChains = LZ_CHAINS.filter((c) => (preset.adapters[c.key] ?? '').length > 0);
  const dstChains = LZ_CHAINS;

  const [srcKey, setSrcKey] = useState<string>(srcChains[0]?.key ?? 'ethereum');
  const [dstKey, setDstKey] = useState<string>(
    LZ_CHAINS.find((c) => c.key !== srcKey)?.key ?? 'arbitrum',
  );
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('100');
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [gasLimit, setGasLimit] = useState<number>(preset.defaultGasLimit ?? 80_000);
  const [nativeFee, setNativeFee] = useState<string>('');
  const [editing, setEditing] = useState<boolean>(false);

  useEffect(() => {
    setGasLimit(preset.defaultGasLimit ?? 80_000);
    const first = LZ_CHAINS.find((c) => (preset.adapters[c.key] ?? '').length > 0);
    if (first && !preset.adapters[srcKey]) setSrcKey(first.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const srcChain = LZ_CHAINS.find((c) => c.key === srcKey);
  const dstChain = LZ_CHAINS.find((c) => c.key === dstKey);
  const srcAdapter = preset.adapters[srcKey] ?? '';
  const srcToken = preset.tokenAddresses[srcKey] ?? '';
  const needsApprove = preset.adapterIsLockbox[srcKey] === true;

  const recipientValid = isValidAddress(recipient);
  let sendParamError: string | null = null;
  let sendParamTuple = '';
  let toBytes32 = '';
  let amountLDStr = '';
  let minAmountLDStr = '';
  let extraOptionsStr = '';

  try {
    if (!dstChain) throw new Error('destination chain not selected');
    if (!recipientValid) throw new Error('recipient not a valid 0x address');
    const p = buildSendParam({
      dstEid: dstChain.eid,
      recipient,
      amount,
      decimals: preset.decimals,
      slippageBps,
      gasLimit,
    });
    sendParamTuple = sendParamAsTupleString(p);
    toBytes32 = p.to;
    amountLDStr = p.amountLD;
    minAmountLDStr = p.minAmountLD;
    extraOptionsStr = p.extraOptions;
  } catch (e) {
    sendParamError = e instanceof Error ? e.message : 'error';
  }

  const approveAmountLD = (() => {
    try {
      return parseUnits(amount, preset.decimals).toString();
    } catch {
      return '';
    }
  })();

  const feeTuple = messagingFeeTupleString(nativeFee);

  const prettyMin = minAmountLDStr
    ? `${formatUnits(BigInt(minAmountLDStr), preset.decimals)} ${preset.symbol || 'TOKEN'}`
    : '';

  const srcExplorerBase = srcChain?.explorer ?? '';
  const writeUrl = srcAdapter ? `${srcExplorerBase}/address/${srcAdapter}#writeContract` : '';
  const readUrl = srcAdapter ? `${srcExplorerBase}/address/${srcAdapter}#readContract` : '';
  const tokenApproveUrl = srcToken ? `${srcExplorerBase}/address/${srcToken}#writeContract` : '';
  const lzScanBase = 'https://layerzeroscan.com';

  const savePreset = (updated: OftPreset) => {
    const list = upsertPreset(updated);
    setPresets(list);
  };

  const deleteCurrent = () => {
    if (preset.builtin) return;
    const list = deletePreset(preset.id);
    setPresets(list);
    setSelectedId(list[0]?.id ?? CHIP_BUILTIN.id);
  };

  const addNew = () => {
    const p = emptyPreset();
    const list = upsertPreset(p);
    setPresets(list);
    setSelectedId(p.id);
    setEditing(true);
  };

  return (
    <div className="border border-ink-700 rounded bg-ink-800">
      <div className="px-3 py-2 border-b border-ink-700 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">OFT Bridge Helper</span>
        <span className="text-[10px] text-ink-400 font-mono">
          builds SendParam calldata for Etherscan Write Contract — no wallet, no execution
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setEditing(false);
            }}
            className="bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || '(unnamed)'} {p.builtin ? '· built-in' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="px-2 py-1 text-xs rounded bg-ink-700 hover:bg-ink-600 border border-ink-600"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={addNew}
            className="px-2 py-1 text-xs rounded bg-ink-700 hover:bg-ink-600 border border-ink-600"
          >
            + New
          </button>
          {!preset.builtin && (
            <button
              type="button"
              onClick={deleteCurrent}
              className="px-2 py-1 text-xs rounded bg-accent-red/20 hover:bg-accent-red/30 border border-accent-red/40 text-accent-red"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {editing && (
        <PresetEditor
          preset={preset}
          onChange={savePreset}
        />
      )}

      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 border-b border-ink-700">
        <Field label="Source chain">
          <select
            value={srcKey}
            onChange={(e) => setSrcKey(e.target.value)}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          >
            {LZ_CHAINS.map((c) => (
              <option
                key={c.key}
                value={c.key}
                disabled={!(preset.adapters[c.key] ?? '').length}
              >
                {c.label} (eid {c.eid}) {(preset.adapters[c.key] ?? '').length ? '' : '· no adapter'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destination chain">
          <select
            value={dstKey}
            onChange={(e) => setDstKey(e.target.value)}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          >
            {dstChains.map((c) => (
              <option key={c.key} value={c.key} disabled={c.key === srcKey}>
                {c.label} (eid {c.eid})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Recipient (EVM address)">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x...  (will be left-padded to bytes32)"
            className={`w-full bg-ink-900 border rounded px-2 py-1 text-xs font-mono ${
              !recipient ? 'border-ink-700' : recipientValid ? 'border-accent-green/50' : 'border-accent-red/60'
            }`}
          />
        </Field>
        <Field label={`Amount (${preset.symbol || 'token'})`}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1000"
            inputMode="decimal"
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          />
        </Field>
        <Field label={`Slippage: ${(slippageBps / 100).toFixed(2)}%`}>
          <input
            type="range"
            min={0}
            max={1000}
            step={10}
            value={slippageBps}
            onChange={(e) => setSlippageBps(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="text-[10px] text-ink-400 font-mono mt-1">
            minAmountLD ≈ {prettyMin || '—'}
          </div>
        </Field>
        <Field label="Dest gas (lzReceive)">
          <input
            type="number"
            value={gasLimit}
            onChange={(e) => setGasLimit(parseInt(e.target.value, 10) || 0)}
            min={20_000}
            step={1000}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          />
          <div className="text-[10px] text-ink-400 font-mono mt-1">
            USD.AI reference: 80,000. Too low = lzReceive reverts on dst; too high = bigger native fee.
          </div>
        </Field>
      </div>

      {sendParamError && (
        <div className="px-3 py-2 text-accent-red text-xs font-mono border-b border-ink-700">
          {sendParamError}
        </div>
      )}

      <div className="p-3 space-y-2 border-b border-ink-700">
        <div className="text-xs font-semibold text-ink-200">Derived values</div>
        <CopyField label="to (bytes32)" value={toBytes32} />
        <CopyField label="amountLD (wei)" value={amountLDStr} />
        <CopyField label="minAmountLD (wei)" value={minAmountLDStr} />
        <CopyField label="extraOptions" value={extraOptionsStr} />
      </div>

      {needsApprove && srcAdapter && srcToken && (
        <div className="p-3 space-y-2 border-b border-ink-700">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-accent-yellow">
              Step 0 · approve (lockbox adapter)
            </span>
            <a href={tokenApproveUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-blue hover:underline">
              Open token on {srcChain?.label} ↗
            </a>
          </div>
          <div className="text-[11px] text-ink-300 font-mono">
            Call <code>approve</code> on the token contract ({srcToken}):
          </div>
          <CopyField label="spender" value={srcAdapter} />
          <CopyField label="amount" value={approveAmountLD} />
        </div>
      )}

      <div className="p-3 space-y-2 border-b border-ink-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-100">Step 1 · quoteSend (Read Contract)</span>
          {readUrl && (
            <a href={readUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-blue hover:underline">
              Open adapter Read on {srcChain?.label} ↗
            </a>
          )}
        </div>
        <div className="text-[11px] text-ink-300 font-mono">
          Paste the SendParam tuple into <code>quoteSend</code>. Record the returned{' '}
          <code>nativeFee</code> — you'll need it in Step 2.
        </div>
        <CopyField label="_sendParam" value={sendParamTuple} multiline />
        <CopyField label="_payInLzToken" value="false" />
      </div>

      <div className="p-3 space-y-2 border-b border-ink-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-100">Step 2 · send (Write Contract, payable)</span>
          {writeUrl && (
            <a href={writeUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-blue hover:underline">
              Open adapter Write on {srcChain?.label} ↗
            </a>
          )}
        </div>
        <div className="text-[11px] text-ink-300 font-mono">
          Enter <code>nativeFee</code> from Step 1 below, then copy all three fields into the{' '}
          <code>send</code> call. Payable value = <code>nativeFee</code>.
        </div>
        <Field label="nativeFee (from quoteSend)">
          <input
            value={nativeFee}
            onChange={(e) => setNativeFee(e.target.value)}
            placeholder="wei, copied from quoteSend result"
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          />
        </Field>
        <CopyField label="_sendParam" value={sendParamTuple} multiline />
        <CopyField label="_fee" value={feeTuple} />
        <CopyField label="_refundAddress" value={recipient} />
        <CopyField label="value (native wei)" value={nativeFee.trim() || '0'} />
      </div>

      <div className="p-3 space-y-1">
        <div className="text-xs font-semibold text-ink-200">After send</div>
        <div className="text-[11px] text-ink-300 font-mono">
          Paste the ETH tx hash into LayerZero Scan to track delivery on{' '}
          {dstChain?.label ?? 'destination'}:
        </div>
        <a
          href={lzScanBase}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent-blue hover:underline font-mono"
        >
          {lzScanBase} ↗
        </a>
        {preset.notes && (
          <div className="text-[11px] text-accent-yellow font-mono mt-2 pt-2 border-t border-ink-700">
            ⚠ {preset.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink-300 font-mono mb-1">{label}</div>
      {children}
    </label>
  );
}

function PresetEditor({
  preset,
  onChange,
}: {
  preset: OftPreset;
  onChange: (p: OftPreset) => void;
}) {
  const update = (patch: Partial<OftPreset>) => onChange({ ...preset, ...patch });

  const updateAdapter = (chainKey: string, val: string) =>
    onChange({ ...preset, adapters: { ...preset.adapters, [chainKey]: val.trim() } });
  const updateToken = (chainKey: string, val: string) =>
    onChange({ ...preset, tokenAddresses: { ...preset.tokenAddresses, [chainKey]: val.trim() } });
  const updateLockbox = (chainKey: string, val: boolean) =>
    onChange({ ...preset, adapterIsLockbox: { ...preset.adapterIsLockbox, [chainKey]: val } });

  const autoFill = (chainKey: string, addr: string) => {
    try {
      addressToBytes32(addr);
    } catch {
      // ignore invalid, just set raw
    }
    updateAdapter(chainKey, addr);
  };

  return (
    <div className="p-3 border-b border-ink-700 bg-ink-900/60 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Field label="Name">
          <input
            value={preset.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          />
        </Field>
        <Field label="Symbol">
          <input
            value={preset.symbol}
            onChange={(e) => update({ symbol: e.target.value })}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          />
        </Field>
        <Field label="Decimals">
          <input
            type="number"
            value={preset.decimals}
            onChange={(e) => update({ decimals: parseInt(e.target.value, 10) || 0 })}
            className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          />
        </Field>
      </div>

      <Field label="Default gas for lzReceive">
        <input
          type="number"
          value={preset.defaultGasLimit}
          onChange={(e) => update({ defaultGasLimit: parseInt(e.target.value, 10) || 0 })}
          className="w-full md:w-48 bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
        />
      </Field>

      <div>
        <div className="text-[11px] text-ink-300 font-mono mb-1">
          Per-chain adapters (leave blank if not deployed)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-ink-300">
              <tr>
                <th className="text-left p-1">Chain</th>
                <th className="text-left p-1">Adapter / OFT address</th>
                <th className="text-left p-1">Lockbox?</th>
                <th className="text-left p-1">Token address (for approve)</th>
              </tr>
            </thead>
            <tbody>
              {LZ_CHAINS.map((c) => (
                <tr key={c.key} className="border-t border-ink-700">
                  <td className="p-1 text-ink-100">
                    {c.label}
                    <div className="text-[10px] text-ink-400">eid {c.eid}</div>
                  </td>
                  <td className="p-1">
                    <input
                      value={preset.adapters[c.key] ?? ''}
                      onChange={(e) => autoFill(c.key, e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="checkbox"
                      checked={!!preset.adapterIsLockbox[c.key]}
                      onChange={(e) => updateLockbox(c.key, e.target.checked)}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      value={preset.tokenAddresses[c.key] ?? ''}
                      onChange={(e) => updateToken(c.key, e.target.value)}
                      placeholder="0x... (only needed if lockbox)"
                      className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 font-mono"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-ink-400 font-mono mt-2">
          Lockbox = OFTAdapter wrapping an existing ERC20 (approve required before send).
          Native OFT = token itself is the OFT contract (no approve).
        </div>
      </div>

      <Field label="Notes (shown at bottom of panel)">
        <textarea
          value={preset.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
          className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono"
          rows={2}
        />
      </Field>
    </div>
  );
}
