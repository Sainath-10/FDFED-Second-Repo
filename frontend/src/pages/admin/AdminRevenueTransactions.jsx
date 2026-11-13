/**
 * NEXUS ESPORTS — Revenue and ledger
 *
 * The platform's payment ledger from the backend: platform fees (platform
 * revenue), prize deposits, registrations, refunds and payouts.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentRequest, money, formatDateTime, txType } from '../../services/payments.js';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui.jsx';

const TYPES = ['', 'PLATFORM_FEE', 'PRIZE_POOL', 'REGISTRATION', 'REFUND', 'PAYOUT', 'REG_FEE_RELEASED', 'PRIZE_RETURN', 'CLAWBACK'];

export default function AdminRevenueTransactions() {
  const [type, setType] = useState('PLATFORM_FEE');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ page: String(page), ...(type ? { type } : {}) });
      setData(await paymentRequest(`/transactions?${q}`));
      setError('');
    } catch (err) { setError(err.message); }
  }, [page, type]);
  useEffect(() => { load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const confirmedOnPage = (data?.items || []).filter((t) => ['CONFIRMED', 'ESCROWED', 'RELEASED'].includes(t.status)).reduce((s, t) => s + t.amountMinor, 0);

  return (
    <main className="main-content">
      <PageHeader
        title="Revenue and ledger"
        subtitle="Every money movement recorded by the escrow ledger. Platform fees are the platform's revenue."
        actions={<Link className="btn-cancel" to="/pages/admin/revenue-config.html">Platform fee settings</Link>}
      />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select className="form-input" style={{ maxWidth: 260 }} aria-label="Transaction type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          {TYPES.map((t) => <option key={t || 'all'} value={t}>{t ? txType(t) : 'All types'}</option>)}
        </select>
        {data && <span className="ui-row-meta">{data.total} transaction{data.total === 1 ? '' : 's'} · this page: {money(confirmedOnPage)}</span>}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <LoadingState label="Loading ledger…" />}
      {data && data.items.length === 0 && <EmptyState title="No transactions" message="Nothing of this type has been recorded yet." />}
      {data && data.items.length > 0 && (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Date</th><th>Type</th><th>Competition</th><th>User</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.paidAt || t.createdAt)}</td>
                  <td>{txType(t.type)}</td>
                  <td>{t.competitionName ? <Link to={`/pages/competition-detail.html?id=${encodeURIComponent(t.competitionId)}`}>{t.competitionName}</Link> : '—'}</td>
                  <td>@{t.userUsername}</td>
                  <td style={{ color: t.direction === 'OUT' ? '#fca5a5' : '#86efac' }}>{t.direction === 'OUT' ? '−' : '+'}{money(t.amountMinor)}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <div className="ui-row-actions" style={{ marginTop: 14 }}>
          <button type="button" className="btn-table-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="ui-row-meta">Page {page} of {pages}</span>
          <button type="button" className="btn-table-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </main>
  );
}
