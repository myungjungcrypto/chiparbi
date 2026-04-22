import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  detectAdapter,
  discoverPeers,
  fetchQuoteSend,
  rpcUrl,
  type AdapterInfo,
  type PeerDiscoveryResult,
  type QuoteResult,
} from '@/lib/rpc';
import { buildGraph, directPeer, shortestPath, type PeerMap } from '@/lib/topology';

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

  const [peersResult, setPeersResult] = useState<PeerDiscoveryResult | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);
  const peersRefreshRef = useRef(0);

  const [peerMap, setPeerMap] = useState<PeerMap>({});
  const [detectionMap, setDetectionMap] = useState<Record<string, AdapterInfo | null>>({});
  const [detectingChains, setDetectingChains] = useState<Set<string>>(new Set());

  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteAt, setQuoteAt] = useState<number>(0);

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
  const built = useMemo(() => {
    try {
      if (!dstChain) return { error: 'destination chain not selected' as const };
      if (!recipientValid) return { error: 'recipient not a valid 0x address' as const };
      const p = buildSendParam({
        dstEid: dstChain.eid,
        recipient,
        amount,
        decimals: preset.decimals,
        slippageBps,
        gasLimit,
      });
      return { param: p };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'error' };
    }
  }, [dstChain, recipientValid, recipient, amount, preset.decimals, slippageBps, gasLimit]);

  const sendParamError = built.error ?? null;
  const sendParamTuple = built.param ? sendParamAsTupleString(built.param) : '';
  const toBytes32 = built.param?.to ?? '';
  const amountLDStr = built.param?.amountLD ?? '';
  const minAmountLDStr = built.param?.minAmountLD ?? '';
  const extraOptionsStr = built.param?.extraOptions ?? '';

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
  const srcRpc = rpcUrl(srcKey);

  const adapterKey = `${srcKey}:${srcAdapter.toLowerCase()}`;
  useEffect(() => {
    setPeersResult(null);
    if (!isValidAddress(srcAdapter)) return;
    const ctrl = new AbortController();
    setPeersLoading(true);
    const myTicket = ++peersRefreshRef.current;
    discoverPeers(srcKey, srcAdapter, ctrl.signal)
      .then((res) => {
        if (myTicket !== peersRefreshRef.current) return;
        setPeersResult(res);
        setPeerMap((m) => ({ ...m, [srcKey]: res.supported }));
      })
      .catch((e) => {
        if (myTicket !== peersRefreshRef.current) return;
        setPeersResult({
          supported: new Set(),
          errored: true,
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => {
        if (myTicket === peersRefreshRef.current) setPeersLoading(false);
      });
    return () => {
      ctrl.abort();
    };
  }, [adapterKey, srcKey, srcAdapter]);

  const quoteKey = `${adapterKey}|${dstChain?.eid ?? ''}|${amountLDStr}|${minAmountLDStr}|${extraOptionsStr}|${toBytes32}`;
  useEffect(() => {
    setQuoteResult(null);
    setQuoteError(null);
    if (!built.param || !isValidAddress(srcAdapter)) return;
    const ctrl = new AbortController();
    setQuoteLoading(true);
    const timer = window.setTimeout(() => {
      fetchQuoteSend(srcKey, srcAdapter, built.param!, ctrl.signal)
        .then((q) => {
          if (ctrl.signal.aborted) return;
          setQuoteResult(q);
          setQuoteAt(Date.now());
        })
        .catch((e) => {
          if (ctrl.signal.aborted) return;
          setQuoteError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setQuoteLoading(false);
        });
    }, 500);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [quoteKey, srcKey, srcAdapter, built.param]);

  const useQuoteAsFee = () => {
    if (quoteResult) setNativeFee(quoteResult.nativeFee.toString());
  };

  const detectOne = async (chainKey: string) => {
    const addr = preset.adapters[chainKey];
    if (!addr || !isValidAddress(addr)) return;
    setDetectingChains((s) => new Set(s).add(chainKey));
    try {
      const info = await detectAdapter(chainKey, addr);
      setDetectionMap((m) => ({ ...m, [chainKey]: info }));
      setPeerMap((m) => ({ ...m, [chainKey]: info.supportedEids }));
      const patch: Partial<OftPreset> = {};
      const nextLockbox = { ...preset.adapterIsLockbox };
      const nextTokens = { ...preset.tokenAddresses };
      const nextSymbol = !preset.symbol && info.symbol ? info.symbol : preset.symbol;
      const nextDecimals = info.decimals ?? preset.decimals;
      if (info.approvalRequired != null) nextLockbox[chainKey] = info.approvalRequired;
      if (info.token) nextTokens[chainKey] = info.token;
      if (info.token || info.approvalRequired != null) {
        patch.adapterIsLockbox = nextLockbox;
        patch.tokenAddresses = nextTokens;
      }
      if (nextDecimals !== preset.decimals) patch.decimals = nextDecimals;
      if (nextSymbol !== preset.symbol) patch.symbol = nextSymbol;
      if (Object.keys(patch).length > 0) {
        const merged: OftPreset = { ...preset, ...patch };
        savePreset(merged);
      }
    } catch (e) {
      setDetectionMap((m) => ({
        ...m,
        [chainKey]: {
          adapter: addr,
          chainKey,
          endpoint: null,
          token: null,
          approvalRequired: null,
          decimals: null,
          symbol: null,
          supportedEids: new Set(),
          isOft: false,
          notes: [e instanceof Error ? e.message : String(e)],
        },
      }));
    } finally {
      setDetectingChains((s) => {
        const next = new Set(s);
        next.delete(chainKey);
        return next;
      });
    }
  };

  const detectAll = async () => {
    const filled = LZ_CHAINS.filter((c) => isValidAddress(preset.adapters[c.key] ?? ''));
    await Promise.all(filled.map((c) => detectOne(c.key)));
  };

  const refreshPeers = () => {
    if (!isValidAddress(srcAdapter)) return;
    setPeersResult(null);
    setPeersLoading(true);
    const myTicket = ++peersRefreshRef.current;
    discoverPeers(srcKey, srcAdapter)
      .then((res) => {
        if (myTicket !== peersRefreshRef.current) return;
        setPeersResult(res);
      })
      .catch((e) => {
        if (myTicket !== peersRefreshRef.current) return;
        setPeersResult({
          supported: new Set(),
          errored: true,
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => {
        if (myTicket === peersRefreshRef.current) setPeersLoading(false);
      });
  };

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
          onDetectOne={detectOne}
          onDetectAll={detectAll}
          detectionMap={detectionMap}
          detectingChains={detectingChains}
        />
      )}

      <TopologyBox
        peerMap={peerMap}
        detectionMap={detectionMap}
        preset={preset}
      />

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
            {dstChains.map((c) => {
              const isPeer = peersResult?.supported.has(c.eid);
              const badge = peersResult
                ? isPeer
                  ? ' ✓ peer'
                  : ' ✗ not a peer'
                : '';
              return (
                <option key={c.key} value={c.key} disabled={c.key === srcKey}>
                  {c.label} (eid {c.eid}){badge}
                </option>
              );
            })}
          </select>
          <div className="text-[10px] text-ink-400 font-mono mt-1 flex items-center gap-2">
            {peersLoading && <span>discovering peers…</span>}
            {!peersLoading && peersResult && !peersResult.errored && (
              <span>
                {peersResult.supported.size > 0 ? (
                  <>
                    supported:{' '}
                    {LZ_CHAINS.filter((c) => peersResult.supported.has(c.eid))
                      .map((c) => c.label)
                      .join(', ')}
                  </>
                ) : (
                  <span className="text-accent-yellow">
                    no peers found — not an OFT? try refresh or check RPC
                  </span>
                )}
              </span>
            )}
            {!peersLoading && peersResult?.errored && (
              <span className="text-accent-red">
                RPC error: {peersResult.errorMessage?.slice(0, 80) ?? 'unknown'}
              </span>
            )}
            <button
              type="button"
              onClick={refreshPeers}
              disabled={!isValidAddress(srcAdapter)}
              className="ml-auto px-2 py-0.5 rounded bg-ink-700 hover:bg-ink-600 border border-ink-600 disabled:opacity-50"
            >
              ↻
            </button>
          </div>
          <RouteSuggestion
            peerMap={peerMap}
            srcKey={srcKey}
            dstKey={dstKey}
            dstEid={dstChain?.eid ?? null}
          />
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
          <span className="text-[10px] text-ink-500 font-mono ml-auto">
            RPC: {srcRpc ?? '—'}
          </span>
        </div>

        <LiveQuoteCard
          loading={quoteLoading}
          error={quoteError}
          result={quoteResult}
          quoteAt={quoteAt}
          onUse={useQuoteAsFee}
          hasParams={!!built.param}
        />

        <div className="text-[11px] text-ink-400 font-mono pt-1">
          Or run it manually: paste the tuple below into <code>quoteSend</code> on Etherscan.
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
  onDetectOne,
  onDetectAll,
  detectionMap,
  detectingChains,
}: {
  preset: OftPreset;
  onChange: (p: OftPreset) => void;
  onDetectOne: (chainKey: string) => void;
  onDetectAll: () => void;
  detectionMap: Record<string, AdapterInfo | null>;
  detectingChains: Set<string>;
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
        <div className="text-[11px] text-ink-300 font-mono mb-1 flex items-center gap-2">
          <span>Per-chain adapters (paste address, then click Detect to auto-fill rest)</span>
          <button
            type="button"
            onClick={onDetectAll}
            className="ml-auto px-2 py-0.5 rounded bg-accent-blue/20 hover:bg-accent-blue/30 border border-accent-blue/40 text-accent-blue text-xs"
          >
            Detect all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-ink-300">
              <tr>
                <th className="text-left p-1">Chain</th>
                <th className="text-left p-1">Adapter / OFT address</th>
                <th className="text-left p-1">Lockbox?</th>
                <th className="text-left p-1">Token address</th>
                <th className="text-left p-1">Detect</th>
              </tr>
            </thead>
            <tbody>
              {LZ_CHAINS.map((c) => {
                const info = detectionMap[c.key];
                const loading = detectingChains.has(c.key);
                const addr = preset.adapters[c.key] ?? '';
                const validAddr = isValidAddress(addr);
                return (
                  <tr key={c.key} className="border-t border-ink-700 align-top">
                    <td className="p-1 text-ink-100">
                      {c.label}
                      <div className="text-[10px] text-ink-400">eid {c.eid}</div>
                    </td>
                    <td className="p-1">
                      <input
                        value={addr}
                        onChange={(e) => autoFill(c.key, e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 font-mono"
                      />
                      {info && (
                        <div className="text-[10px] mt-0.5">
                          {info.isOft ? (
                            <span className="text-accent-green">
                              ✓ OFT{info.symbol ? ` · ${info.symbol}` : ''} · {info.supportedEids.size} peer(s)
                            </span>
                          ) : (
                            <span className="text-accent-red">✗ not an OFT</span>
                          )}
                          {info.notes.length > 0 && (
                            <div className="text-accent-yellow">{info.notes.join('; ')}</div>
                          )}
                        </div>
                      )}
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
                        placeholder="auto-filled after Detect"
                        className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 font-mono"
                      />
                    </td>
                    <td className="p-1">
                      <button
                        type="button"
                        onClick={() => onDetectOne(c.key)}
                        disabled={!validAddr || loading}
                        className="px-2 py-1 rounded bg-ink-700 hover:bg-ink-600 border border-ink-600 disabled:opacity-40"
                      >
                        {loading ? '…' : 'Detect'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-ink-400 font-mono mt-2">
          Detect calls endpoint() / token() / approvalRequired() / decimals() and scans all 11 peers()
          on that chain's RPC. Lockbox auto-unchecks for native OFTs, auto-checks for adapters.
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

function LiveQuoteCard({
  loading,
  error,
  result,
  quoteAt,
  hasParams,
  onUse,
}: {
  loading: boolean;
  error: string | null;
  result: QuoteResult | null;
  quoteAt: number;
  hasParams: boolean;
  onUse: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const age = result && quoteAt ? Math.floor((now - quoteAt) / 1000) : null;

  const nativeFeeWei = result?.nativeFee ?? 0n;
  const nativeFeeEth = result ? formatUnits(nativeFeeWei, 18) : '';

  let body: React.ReactNode;
  if (!hasParams) {
    body = <span className="text-ink-400">Fill recipient + amount to get a live quote.</span>;
  } else if (loading) {
    body = <span className="text-accent-yellow">quoting via RPC…</span>;
  } else if (error) {
    body = (
      <span className="text-accent-red">
        RPC quote failed: {error.slice(0, 140)}
        {error.length > 140 ? '…' : ''}
      </span>
    );
  } else if (result) {
    body = (
      <div className="flex items-baseline gap-3 flex-wrap">
        <span>
          <span className="text-ink-300">nativeFee:</span>{' '}
          <span className="text-accent-green font-semibold">{nativeFeeEth}</span>{' '}
          <span className="text-ink-400">ETH ({nativeFeeWei.toString()} wei)</span>
        </span>
        {result.lzTokenFee > 0n && (
          <span className="text-ink-400">
            lzTokenFee: {result.lzTokenFee.toString()}
          </span>
        )}
        {age !== null && <span className="text-ink-500 text-[10px]">{age}s ago</span>}
        <button
          type="button"
          onClick={onUse}
          className="ml-auto px-2 py-0.5 text-xs rounded bg-accent-green/20 hover:bg-accent-green/30 border border-accent-green/40 text-accent-green"
        >
          Use this ↓
        </button>
      </div>
    );
  } else {
    body = <span className="text-ink-400">waiting for params…</span>;
  }

  return (
    <div className="border border-ink-700 rounded bg-ink-900 p-2 text-xs font-mono">
      <div className="flex items-center gap-2 text-[10px] text-ink-400 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-accent-blue"></span>
        Live RPC quote (auto-updates, 500ms debounce)
      </div>
      {body}
    </div>
  );
}

function TopologyBox({
  peerMap,
  detectionMap,
  preset,
}: {
  peerMap: PeerMap;
  detectionMap: Record<string, AdapterInfo | null>;
  preset: OftPreset;
}) {
  const detectedChains = LZ_CHAINS.filter(
    (c) => peerMap[c.key] !== undefined || detectionMap[c.key] !== undefined,
  );
  const filledChains = LZ_CHAINS.filter((c) => (preset.adapters[c.key] ?? '').length > 0);

  if (detectedChains.length === 0 && filledChains.length === 0) return null;

  return (
    <div className="p-3 border-b border-ink-700 bg-ink-900/40">
      <div className="text-xs font-semibold text-ink-100 mb-2">
        Detected topology
        <span className="ml-2 text-[10px] text-ink-400 font-normal font-mono">
          per-chain peers discovered via RPC
        </span>
      </div>
      {detectedChains.length === 0 ? (
        <div className="text-[11px] text-ink-400 font-mono">
          No detections yet. Click <span className="text-ink-200">Detect all</span> in the editor
          above (or per-row Detect) to scan each filled adapter.
        </div>
      ) : (
        <div className="space-y-1 font-mono text-xs">
          {detectedChains.map((c) => {
            const eids = peerMap[c.key];
            const dests = eids
              ? LZ_CHAINS.filter((x) => eids.has(x.eid)).map((x) => x.label)
              : [];
            const info = detectionMap[c.key];
            return (
              <div key={c.key} className="flex items-start gap-2">
                <span className="w-32 shrink-0 text-ink-100">{c.label}</span>
                <span className="text-ink-400">→</span>
                {dests.length > 0 ? (
                  <span className="text-accent-green">{dests.join(', ')}</span>
                ) : (
                  <span className="text-accent-yellow">no peers found</span>
                )}
                {info?.symbol && (
                  <span className="ml-auto text-ink-500 text-[10px]">
                    {info.symbol}
                    {info.decimals != null ? ` · ${info.decimals}d` : ''}
                    {info.approvalRequired === true
                      ? ' · lockbox'
                      : info.approvalRequired === false
                        ? ' · native OFT'
                        : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RouteSuggestion({
  peerMap,
  srcKey,
  dstKey,
  dstEid,
}: {
  peerMap: PeerMap;
  srcKey: string;
  dstKey: string;
  dstEid: number | null;
}) {
  if (!dstEid || srcKey === dstKey) return null;
  const srcPeers = peerMap[srcKey];
  if (!srcPeers) return null;
  const isDirect = directPeer(peerMap, srcKey, dstEid);
  if (isDirect) return null;

  const graph = buildGraph(peerMap);
  const path = shortestPath(graph, srcKey, dstKey);

  if (!path || path.length <= 1) {
    return (
      <div className="text-[11px] text-accent-red font-mono mt-1 p-2 border border-accent-red/30 bg-accent-red/5 rounded">
        ⚠ Direct peer not configured and no indirect route found in detected topology.
        send() will revert. Detect more chains or use a CEX as bridge.
      </div>
    );
  }

  const labels = path
    .map((k) => LZ_CHAINS.find((c) => c.key === k)?.label ?? k)
    .join(' → ');
  const hops = path.length - 1;

  return (
    <div className="text-[11px] font-mono mt-1 p-2 border border-accent-yellow/40 bg-accent-yellow/5 rounded">
      <div className="text-accent-yellow">
        ⚠ Direct send from {labels.split(' → ')[0]} to{' '}
        {labels.split(' → ').slice(-1)[0]} not configured. send() would revert.
      </div>
      <div className="text-ink-200 mt-1">
        Suggested route ({hops} hop{hops > 1 ? 's' : ''}): <span className="text-accent-green">{labels}</span>
      </div>
      <div className="text-ink-400 mt-0.5">
        Each hop = separate send() + approve() + LZ fee. No atomicity between hops.
      </div>
    </div>
  );
}
