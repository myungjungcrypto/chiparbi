import { useStore } from '@/state/store';
import { CHAIN_LABEL, VENUE_LABEL } from '@/lib/symbols';
import type { CexVenue } from '@/lib/types';

const NOTICE_URLS: Record<CexVenue, string> = {
  binance: 'https://www.binance.com/en/support/announcement',
  upbit: 'https://upbit.com/service_center/notice',
  bithumb: 'https://feed.bithumb.com/notice',
};

export function DepositNetworks() {
  const networks = useStore((s) => s.depositNetworks);
  const venues: CexVenue[] = ['binance', 'upbit', 'bithumb'];

  return (
    <div className="border border-ink-700 rounded bg-ink-800">
      <div className="px-3 py-2 border-b border-ink-700 text-sm font-semibold">
        Deposit Networks
      </div>
      <table className="w-full text-xs font-mono">
        <thead className="text-ink-300">
          <tr>
            <th className="text-left p-2">Exchange</th>
            <th className="text-left p-2">Deposit Chain</th>
            <th className="text-left p-2">Confirmed</th>
            <th className="text-left p-2">Note</th>
            <th className="text-left p-2">Official Notice</th>
          </tr>
        </thead>
        <tbody>
          {venues.map((v) => {
            const n = networks[v];
            return (
              <tr key={v} className="border-t border-ink-700">
                <td className="p-2 text-ink-100">{VENUE_LABEL[v]}</td>
                <td className="p-2">
                  {n.chain === 'unknown' ? (
                    <span className="text-accent-yellow">UNKNOWN</span>
                  ) : (
                    <span className="text-accent-green">{CHAIN_LABEL[n.chain]}</span>
                  )}
                </td>
                <td className={`p-2 ${n.confirmed ? 'text-accent-green' : 'text-accent-yellow'}`}>
                  {n.confirmed ? '✓' : 'pending'}
                </td>
                <td className="p-2 text-ink-300">{n.note ?? ''}</td>
                <td className="p-2">
                  <a
                    href={NOTICE_URLS[v]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-blue hover:underline"
                  >
                    check ↗
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
