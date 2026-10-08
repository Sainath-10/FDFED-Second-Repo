/**
 * NEXUS ESPORTS — Admin Revenue Transactions
 *
 * derives platform-fee
 * transactions from competitions, merges the backend `/revenue/transactions` feed,
 * applies status + time-period filters, and paginates (10 per page).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import '../styles/pages/admin/dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 10;

const money = (value) => `Rs.${(Number(value) || 0).toLocaleString('en-IN')}`;
const getLocalDateString = (d) => {
  const dt = !d || Number.isNaN(d.getTime()) ? new Date() : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const formatDate = (isoOrStr) => {
  if (!isoOrStr) return getLocalDateString(new Date());
  const d = new Date(isoOrStr);
  if (!Number.isNaN(d.getTime())) return getLocalDateString(d);
  return String(isoOrStr).split('T')[0];
};
const getDateObj = (isoOrStr) => {
  if (!isoOrStr) return new Date();
  const d = new Date(isoOrStr);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
function determineStatus(comp) {
  if (!comp) return 'CONFIRMED';
  if (comp.approvalStatus === 'rejected') return 'FAILED';
  if (comp.approvalStatus === 'pending') return 'PENDING';
  if (comp.organizerPaid === false) return 'PENDING';
  return 'CONFIRMED';
}
function isWithinDateRange(dateObj, rangeKey) {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return true;
  if (rangeKey === 'ALL') return true;
  if (rangeKey === 'TODAY') return getLocalDateString(dateObj) === getLocalDateString(new Date());
  const diffDays = (new Date() - dateObj) / (1000 * 60 * 60 * 24);
  if (rangeKey === '7DAYS') return diffDays >= 0 && diffDays <= 7;
  if (rangeKey === '30DAYS') return diffDays >= 0 && diffDays <= 30;
  if (rangeKey === 'QUARTER') return diffDays >= 0 && diffDays <= 90;
  return true;
}

const ALLOWED_CONFIG_ROLES = ['admin', 'revenue_admin', 'super_admin', 'super-admin', 'comp_admin', 'dispute_admin'];

export default function AdminRevenueTransactions() {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const comps = NexusData ? NexusData.loadCompetitions() : [];
    let updatedStorage = false;

    const derived = comps.map((comp, idx) => {
      const amt = typeof comp.platformFee === 'number' && comp.platformFee > 0
        ? comp.platformFee
        : (NexusData ? NexusData.calculatePlatformFee(comp.prize || 0) : 50);
      let rawDateStr = comp.createdAt || comp.created_at || comp.timestamp;
      if (!rawDateStr) {
        if (comp.createdBy && comp.createdBy !== 'system') {
          comp.createdAt = new Date().toISOString();
          rawDateStr = comp.createdAt;
          updatedStorage = true;
        } else {
          rawDateStr = '2026-01-01';
        }
      }
      return {
        id: comp.id || `tx_${idx}`,
        name: comp.name || 'Competition',
        organizer: comp.createdBy || comp.organizerId || 'Organizer',
        amount: Number(amt) || 50,
        entryFee: comp.entryFee || 'Free',
        dateStr: formatDate(rawDateStr),
        dateRaw: getDateObj(rawDateStr),
        status: determineStatus(comp),
      };
    });

    if (updatedStorage && NexusData && NexusData.saveCompetitions) NexusData.saveCompetitions(comps);

    let alive = true;
    setTransactions(derived);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/revenue/transactions?limit=100`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !Array.isArray(data.items) || data.items.length === 0) return;
        const apiTxList = data.items.map((tx, idx) => ({
          id: tx.id || `api_tx_${idx}`,
          name: tx.competitionName || 'Tournament',
          organizer: tx.organizerName || 'Nexus Admin',
          amount: Number(tx.platformFee || tx.grossAmount || 50),
          entryFee: `₹${tx.grossAmount || 50}`,
          dateStr: formatDate(tx.date || tx.createdAt),
          dateRaw: getDateObj(tx.date || tx.createdAt),
          status: String(tx.status || 'CONFIRMED').toUpperCase(),
        }));
        const existingNames = new Set(derived.map((t) => t.name.toLowerCase()));
        const merged = [...derived];
        apiTxList.forEach((apiTx) => { if (!existingNames.has(apiTx.name.toLowerCase())) merged.push(apiTx); });
        if (alive) setTransactions(merged);
      } catch (e) { /* offline */ }
    })();

    return () => { alive = false; };
  }, []);

  const filtered = useMemo(
    () => transactions.filter((item) => (statusFilter === 'ALL' || item.status === statusFilter) && isWithinDateRange(item.dateRaw, dateFilter)),
    [transactions, statusFilter, dateFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const totalConfirmed = filtered.filter((f) => f.status === 'CONFIRMED').reduce((sum, item) => sum + item.amount, 0);
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);

  const role = String((session && (session.role || session.adminType)) || '').toLowerCase();
  const canConfig = session && ALLOWED_CONFIG_ROLES.includes(role);

  function statusPill(status) {
    if (status === 'CONFIRMED') return <span className="status-pill approved" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', fontWeight: 700, padding: '4px 10px', borderRadius: 12 }}>CONFIRMED</span>;
    if (status === 'PENDING') return <span className="status-pill pending" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', fontWeight: 700, padding: '4px 10px', borderRadius: 12 }}>PENDING</span>;
    return <span className="status-pill rejected" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontWeight: 700, padding: '4px 10px', borderRadius: 12 }}>FAILED</span>;
  }

  return (
    <main className="admin-page">
      <div className="admin-header-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="admin-title-xl">Revenue Transactions</h1>
          <p className="admin-subtitle-muted">Organizer platform fee payments and financial transaction history.</p>
        </div>
        {canConfig && (
          <div id="admin-config-btn-wrap">
            <Link to="/pages/admin/revenue-config.html" className="btn-table-secondary" style={{ background: '#c6ff33', color: '#000', padding: '10px 18px', fontSize: 13, fontWeight: 800, borderRadius: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', boxShadow: '0 0 12px rgba(198,255,51,0.3)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
              Change Revenue Configuration
            </Link>
          </div>
        )}
      </div>

      <div className="dash-stats">
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn">Rs</div><div><div className="dash-stat-num" id="revenue-total">{money(totalConfirmed)}</div><div className="dash-stat-lbl">Total Paid</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-success" style={{ fontSize: 14, fontWeight: 800 }}>TX</div><div><div className="dash-stat-num" id="revenue-count">{filtered.length}</div><div className="dash-stat-lbl">Transactions</div></div></div>
      </div>

      <div className="table-container-card">
        <div className="table-header-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <h2 className="table-title-md" style={{ margin: 0 }}>Organizer Payments</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="status-filter" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Status:</label>
              <select id="status-filter" className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="ALL">All Statuses</option><option value="CONFIRMED">Confirmed</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="date-filter" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Time Period:</label>
              <select id="date-filter" className="filter-select" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}>
                <option value="ALL">All Time</option><option value="TODAY">Today</option><option value="7DAYS">Last 7 Days</option><option value="30DAYS">Last 30 Days</option><option value="QUARTER">This Quarter</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-scroll-wrap">
          <table className="admin-table">
            <thead><tr><th>Competition</th><th>Organizer</th><th>Paid Amount</th><th>Entry Fee</th><th>Date</th><th>Status</th></tr></thead>
            <tbody id="revenue-rows">
              {pageItems.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>No matching revenue transactions found.</td></tr>}
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{row.name}</td>
                  <td>{row.organizer}</td>
                  <td className="text-accent-bold" style={{ color: '#c6ff33', fontWeight: 700 }}>{money(row.amount)}</td>
                  <td>{row.entryFee}</td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{row.dateStr}</td>
                  <td>{statusPill(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div id="pagination-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 4px', marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: 12 }}>
          <div id="pagination-info" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{filtered.length === 0 ? 'Showing 0 transactions' : `Showing ${startIdx + 1}–${endIdx} of ${filtered.length} transactions`}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button id="btn-prev-page" className="btn-table-secondary" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}>← Prev</button>
            <span id="page-num-display" style={{ fontSize: 12, color: '#c6ff33', fontWeight: 700 }}>Page {safePage} of {totalPages}</span>
            <button id="btn-next-page" className="btn-table-secondary" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}>Next →</button>
          </div>
        </div>
      </div>
    </main>
  );
}


