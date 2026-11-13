/**
 * NEXUS ESPORTS — Organizer transactions
 *
 * The competition's real escrow ledger from the backend: every registration
 * fee, refund, payout and release, with totals. Nothing here is estimated.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentRequest, money, formatDateTime, txType, competitionState } from '../services/payments.js';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui.jsx';

export default function OrganizerRevenue() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try { setData(await paymentRequest(`/competitions/${encodeURIComponent(id)}/ledger`)); setError(''); } catch (err) { setError(err.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!id) return <main className="main-content"><ErrorState message="Open Transactions from a competition." /></main>;
  if (error) return <main className="main-content"><ErrorState message={error} onRetry={load} /></main>;
  if (!data) return <main className="main-content"><LoadingState label="Loading transactions…" /></main>;

  const tx = data.transactions || [];
  const registrations = tx.filter((t) => t.type === 'REGISTRATION');
  const held = registrations.filter((t) => t.status === 'ESCROWED').reduce((s, t) => s + t.amountMinor, 0);
  const refunded = tx.filter((t) => t.type === 'REFUND').reduce((s, t) => s + t.amountMinor, 0);
  const released = tx.filter((t) => t.type === 'REG_FEE_RELEASED' && t.status !== 'REVERSED').reduce((s, t) => s + t.amountMinor, 0);
  const state = competitionState(data.paymentStatus);

  return (
    <main className="main-content">
      <PageHeader
        title="Transactions"
        subtitle={`${data.competition} · ${state.label}`}
        actions={<Link className="btn-cancel" to={`/pages/competition-detail.html?id=${encodeURIComponent(id)}`}>Back to competition</Link>}
      />
      <div className="ui-grid" style={{ marginBottom: 24 }}>
        <div className="ui-card"><div className="ui-row-meta">Registration fees held in escrow</div><div className="page-title" style={{ fontSize: 26 }}>{money(held)}</div></div>
        <div className="ui-card"><div className="ui-row-meta">Released to you</div><div className="page-title" style={{ fontSize: 26 }}>{money(released)}</div></div>
        <div className="ui-card"><div className="ui-row-meta">Refunded to players</div><div className="page-title" style={{ fontSize: 26 }}>{money(refunded)}</div></div>
        <div className="ui-card"><div className="ui-row-meta">Paid registrations</div><div className="page-title" style={{ fontSize: 26 }}>{registrations.length}</div></div>
      </div>
      <p className="ui-row-meta" style={{ marginBottom: 14 }}>Registration revenue stays in escrow until the competition ends, the dispute window closes and a finance moderator settles it.</p>

      {tx.length === 0 ? <EmptyState title="No transactions yet" message="Fees appear here as teams register." /> : (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Date</th><th>Type</th><th>Player</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
            <tbody>
              {tx.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.paidAt || t.createdAt)}</td>
                  <td>{txType(t.type)}</td>
                  <td>@{t.userUsername}</td>
                  <td style={{ color: t.direction === 'OUT' ? '#fca5a5' : '#86efac' }}>{t.direction === 'OUT' ? '−' : '+'}{money(t.amountMinor)}</td>
                  <td>{t.status}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-dimmer)' }}>{t.gatewayRefId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
