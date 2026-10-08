/**
 * NEXUS ESPORTS — Organizer Revenue
 *
 * totals +
 * paid count + entry fee, and the payment ledger derived from the competition's
 * teams / members / join requests per the competition fee model.
 */
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import '../styles/pages/admin/dashboard.css';

const INLINE_CSS = `
.rev-page { padding:40px 60px 80px 100px; min-height:100vh; }
.rev-header { margin-bottom:28px; }
.rev-title { font-family:var(--font-display); font-size:34px; text-transform:uppercase; color:var(--text-white); }
.rev-sub { color:var(--text-muted); margin-top:6px; font-size:14px; }
.rev-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:28px; }
.rev-card { background:var(--bg-card); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:20px; }
.rev-num { font-family:var(--font-display); font-size:26px; color:var(--accent); }
.rev-label { margin-top:4px; color:var(--text-muted); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; }
@media (max-width:800px) { .rev-page { padding:28px 18px; } .rev-grid { grid-template-columns:1fr; } }
`;

const money = (value) => `Rs.${(Number(value) || 0).toLocaleString('en-IN')}`;
const paymentStatusLabel = (item) => (((item && item.paymentStatus === 'paid') || Number((item && item.feePaid) || 0) > 0) ? 'paid' : 'not_paid');

export default function OrganizerRevenue() {
  const [params] = useSearchParams();
  const compId = params.get('id') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('last_comp_id') : '');
  const comp = (NexusData && compId) ? NexusData.getCompetitionById(compId) : null;

  const rows = useMemo(() => {
    const out = [];
    if (!comp || !Array.isArray(comp.teams)) return out;
    comp.teams.forEach((team) => {
      if ((comp.feeType || 'free') === 'per_team') {
        out.push({ name: team.name || 'Team', type: 'Team', team: team.name || '-', amount: Number(team.feePaid || comp.entryFeeAmount || 0), paymentStatus: paymentStatusLabel(team) });
      }
      const joinRequests = team.joinRequests || [];
      const memberNames = new Set((team.members || []).map((m) => String(m.username || '').toLowerCase()));
      (team.members || []).forEach((member) => {
        if ((comp.feeType || 'free') === 'per_player') {
          const requestPayment = joinRequests.find((req) => String(req.username || '').toLowerCase() === String(member.username || '').toLowerCase());
          const paymentSource = requestPayment || member;
          out.push({ name: member.username || member.displayName || 'Player', type: 'Player', team: team.name || '-', amount: Number(paymentSource.feePaid || comp.entryFeeAmount || 0), paymentStatus: paymentStatusLabel(paymentSource) });
        }
      });
      joinRequests.forEach((req) => {
        if ((comp.feeType || 'free') === 'per_player' && !memberNames.has(String(req.username || '').toLowerCase())) {
          out.push({ name: req.username || req.displayName || 'Player', type: 'Player', team: team.name || '-', amount: Number(req.feePaid || comp.entryFeeAmount || 0), paymentStatus: paymentStatusLabel(req) });
        }
      });
    });
    return out;
  }, [comp, compId]);

  const total = rows.reduce((sum, row) => sum + (row.paymentStatus === 'paid' ? row.amount : 0), 0);
  const paidCount = rows.filter((row) => row.paymentStatus === 'paid').length;

  return (
    <main className="rev-page">
      <style>{INLINE_CSS}</style>
      <Link to="/pages/admin/manage-competition.html" className="btn-table-secondary" style={{ marginBottom: 24 }}>Back</Link>
      <div className="rev-header">
        <h1 className="rev-title" id="rev-title">{comp ? `${comp.name} Revenue` : 'Revenue'}</h1>
        <p className="rev-sub" id="rev-sub">Teams and players who paid entry fees.</p>
      </div>

      <div className="rev-grid">
        <div className="rev-card"><div className="rev-num" id="rev-total">{money(total)}</div><div className="rev-label">Total Collected</div></div>
        <div className="rev-card"><div className="rev-num" id="rev-paid">{paidCount}</div><div className="rev-label">Paid Entries</div></div>
        <div className="rev-card"><div className="rev-num" id="rev-fee">{comp ? (comp.entryFee || 'Free') : 'Free'}</div><div className="rev-label">Entry Fee</div></div>
      </div>

      <div className="table-container-card">
        <div className="table-header-between">
          <h2 className="table-title-md">Payments</h2>
        </div>
        <div className="table-scroll-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Team</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody id="rev-rows">
              {rows.length ? rows.map((row, i) => (
                <tr key={`${row.name}-${i}`}>
                  <td>{row.name}</td>
                  <td>{row.type}</td>
                  <td>{row.team}</td>
                  <td className="text-accent-bold">{money(row.amount)}</td>
                  <td><span className={`status-pill ${row.paymentStatus === 'paid' ? 'approved' : 'pending'}`}>{row.paymentStatus === 'paid' ? 'PAID' : 'NOT PAID'}</span></td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>No team or player payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


