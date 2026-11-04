/**
 * NEXUS ESPORTS — My Payments.
 *
 * Every payment, escrow hold, refund and prize payout for the signed-in user,
 * plus their simulated payment emails and new-competition alert preference.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PaymentMailbox from '../components/PaymentMailbox.jsx';
import { MockBanner, Notice, TransactionTable } from '../components/PaymentUI.jsx';
import { paymentRequest, money } from '../services/payments.js';
import '../styles/pages/admin/dashboard.css';
import '../styles/pages/payments.css';

const PAID_IN = ['REGISTRATION', 'PLATFORM_FEE', 'PRIZE_POOL'];

export default function MyPayments() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    paymentRequest('/me').then((r) => { if (active) setItems(r); }).catch((err) => { if (active) { setError(err.message); setItems([]); } });
    return () => { active = false; };
  }, []);

  const list = items || [];
  const sum = (filter) => list.filter(filter).reduce((total, tx) => total + tx.amountMinor, 0);
  const paid = sum((tx) => PAID_IN.includes(tx.type) && tx.status !== 'FAILED' && tx.status !== 'PENDING');
  const escrowed = sum((tx) => tx.type === 'REGISTRATION' && tx.status === 'ESCROWED');
  const refunded = sum((tx) => tx.type === 'REFUND');
  const won = sum((tx) => tx.type === 'PAYOUT');

  return (
    <main className="admin-page pay-page">
      <div className="admin-header-block">
        <h1 className="admin-title-xl">My Payments</h1>
        <p className="admin-subtitle-muted">Registration fees, refunds and prize winnings. Entry fees are held in escrow and are refunded in full if an organizer cancels.</p>
      </div>
      <MockBanner />
      {error && <Notice tone="error">{error}</Notice>}

      <div className="dash-stats">
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-wrap" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14 }}>₹</div><div><div className="dash-stat-num">{money(paid)}</div><div className="dash-stat-lbl">Total paid</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-info" style={{ color: '#64c8ff', fontWeight: 800, fontSize: 13 }}>ES</div><div><div className="dash-stat-num">{money(escrowed)}</div><div className="dash-stat-lbl">Held in escrow</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#fbbf24', fontWeight: 800, fontSize: 13 }}>RF</div><div><div className="dash-stat-num">{money(refunded)}</div><div className="dash-stat-lbl">Refunded</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-success" style={{ color: '#4ade80', fontWeight: 800, fontSize: 13 }}>WIN</div><div><div className="dash-stat-num">{money(won)}</div><div className="dash-stat-lbl">Prize winnings</div></div></div>
      </div>

      <section className="table-container-card" aria-labelledby="my-tx">
        <div className="table-header-between">
          <h2 className="table-title-md" id="my-tx" style={{ margin: 0 }}>Transactions</h2>
          <Link to="/pages/competitions.html" className="pay-btn ghost sm">Browse competitions</Link>
        </div>
        {items === null ? <div className="pay-empty">Loading your payments…</div> : <TransactionTable items={list} showCompetition showPayer={false} empty="You have no payments yet. Registering a team for a paid competition will show up here." />}
      </section>

      <PaymentMailbox title="Payment emails" />
    </main>
  );
}
