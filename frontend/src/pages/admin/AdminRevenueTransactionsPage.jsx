import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/dashboard.css';

export default function AdminRevenueTransactionsPage() {
  const [session, setSession] = useState(NexusAuth.getSession());
  const [transactions, setTransactions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadAllTransactions();
  }, []);

  function money(value) {
    return 'Rs.' + (Number(value) || 0).toLocaleString('en-IN');
  }

  function getLocalDateString(d) {
    if (!d || isNaN(d.getTime())) d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDate(isoOrStr) {
    if (!isoOrStr) return getLocalDateString(new Date());
    try {
      const d = new Date(isoOrStr);
      if (!isNaN(d.getTime())) {
        return getLocalDateString(d);
      }
    } catch (e) {}
    return String(isoOrStr).split('T')[0];
  }

  function getDateObj(isoOrStr) {
    if (!isoOrStr) return new Date();
    const d = new Date(isoOrStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function determineStatus(comp) {
    if (!comp) return 'CONFIRMED';
    if (comp.approvalStatus === 'rejected') return 'FAILED';
    if (comp.approvalStatus === 'pending') return 'PENDING';
    if (comp.organizerPaid === false) return 'PENDING';
    return 'CONFIRMED';
  }

  async function loadAllTransactions() {
    const comps = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    
    let txList = comps.map((comp, idx) => {
      const amt = typeof comp.platformFee === 'number' && comp.platformFee > 0
        ? comp.platformFee
        : (NexusData.calculatePlatformFee ? NexusData.calculatePlatformFee(comp.prize || 0) : 50);

      let rawDateStr = comp.createdAt || comp.created_at || comp.timestamp || '2026-01-01';
      const dateObj = getDateObj(rawDateStr);
      const dateStr = formatDate(rawDateStr);

      return {
        id: comp.id || ('tx_' + idx),
        name: comp.name || 'Competition',
        organizer: comp.createdBy || comp.organizerId || 'Organizer',
        amount: Number(amt) || 50,
        entryFee: comp.entryFee || 'Free',
        dateStr: dateStr,
        dateRaw: dateObj,
        status: determineStatus(comp)
      };
    });

    try {
      const res = await fetch('http://localhost:3001/revenue/transactions?limit=100');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          const apiTxList = data.items.map((tx, idx) => ({
            id: tx.id || ('api_tx_' + idx),
            name: tx.competitionName || 'Tournament',
            organizer: tx.organizerName || 'Nexus Admin',
            amount: Number(tx.platformFee || tx.grossAmount || 50),
            entryFee: '₹' + (tx.grossAmount || 50),
            dateStr: formatDate(tx.date || tx.createdAt),
            dateRaw: getDateObj(tx.date || tx.createdAt),
            status: (tx.status || 'CONFIRMED').toUpperCase()
          }));

          const existingNames = new Set(txList.map(t => t.name.toLowerCase()));
          apiTxList.forEach(apiTx => {
            if (!existingNames.has(apiTx.name.toLowerCase())) {
              txList.push(apiTx);
            }
          });
        }
      }
    } catch (e) {}

    setTransactions(txList);
  }

  function isWithinDateRange(dateObj, rangeKey) {
    if (!dateObj || isNaN(dateObj.getTime())) return true;
    if (rangeKey === 'ALL') return true;

    if (rangeKey === 'TODAY') {
      const compDateStr = getLocalDateString(dateObj);
      const todayStr = getLocalDateString(new Date());
      return compDateStr === todayStr;
    }

    const now = new Date();
    const diffDays = (now - dateObj) / (1000 * 60 * 60 * 24);

    if (rangeKey === '7DAYS') {
      return diffDays >= 0 && diffDays <= 7;
    }
    if (rangeKey === '30DAYS') {
      return diffDays >= 0 && diffDays <= 30;
    }
    if (rangeKey === 'QUARTER') {
      return diffDays >= 0 && diffDays <= 90;
    }
    return true;
  }

  const role = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = role.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';

  // Filter items
  const filtered = transactions.filter(item => {
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchDate = isWithinDateRange(item.dateRaw, dateFilter);
    return matchStatus && matchDate;
  });

  const totalRevenue = filtered
    .filter(i => i.status === 'CONFIRMED')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="revenue">
      <main className="admin-page">
        <div className="admin-header-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="admin-title-xl">Revenue Transactions</h1>
            <p className="admin-subtitle-muted">Organizer platform fee payments and financial transaction history.</p>
          </div>
          <div id="admin-config-btn-wrap">
            <Link
              to="/admin/revenue-config"
              className="btn-table-secondary"
              style={{
                background: '#c6ff33',
                color: '#000',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                boxShadow: '0 0 12px rgba(198,255,51,0.3)',
                cursor: 'pointer'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Change Revenue Configuration
            </Link>
          </div>
        </div>

        <div className="dash-stats">
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-warn">Rs</div>
            <div>
              <div className="dash-stat-num" id="revenue-total">{money(totalRevenue)}</div>
              <div className="dash-stat-lbl">Total Paid</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-success" style={{ fontSize: '14px', fontWeight: 800 }}>TX</div>
            <div>
              <div className="dash-stat-num" id="revenue-count">{filtered.length}</div>
              <div className="dash-stat-lbl">Transactions</div>
            </div>
          </div>
        </div>

        <div className="table-container-card">
          <div className="table-header-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <h2 className="table-title-md" style={{ margin: 0 }}>Organizer Payments</h2>

            {/* Right-Aligned Filters Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Status:</label>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  style={{
                    backgroundColor: '#121214',
                    color: '#f4f4f5',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    borderRadius: '8px',
                    padding: '7px 32px 7px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Time Period:</label>
                <select
                  className="filter-select"
                  value={dateFilter}
                  onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }}
                  style={{
                    backgroundColor: '#121214',
                    color: '#f4f4f5',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    borderRadius: '8px',
                    padding: '7px 32px 7px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today</option>
                  <option value="7DAYS">Last 7 Days</option>
                  <option value="30DAYS">Last 30 Days</option>
                  <option value="QUARTER">This Quarter</option>
                </select>
              </div>
            </div>
          </div>

          <div className="table-scroll-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Competition</th>
                  <th>Organizer</th>
                  <th>Paid Amount</th>
                  <th>Entry Fee</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="revenue-rows">
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                      No matching revenue transactions found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600, color: '#fff' }}>{row.name}</td>
                      <td>{row.organizer}</td>
                      <td className="text-accent-bold" style={{ color: '#c6ff33', fontWeight: 700 }}>{money(row.amount)}</td>
                      <td>{row.entryFee}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{row.dateStr}</td>
                      <td>
                        {row.status === 'CONFIRMED' && (
                          <span className="status-pill approved" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
                            CONFIRMED
                          </span>
                        )}
                        {row.status === 'PENDING' && (
                          <span className="status-pill pending" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
                            PENDING
                          </span>
                        )}
                        {row.status === 'FAILED' && (
                          <span className="status-pill rejected" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
                            FAILED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div id="pagination-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 4px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: '12px' }}>
            <div id="pagination-info" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing {filtered.length} transactions
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn-table-secondary"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: '6px', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.5 : 1 }}
              >
                ← Prev
              </button>
              <span id="page-num-display" style={{ fontSize: '12px', color: '#c6ff33', fontWeight: 700 }}>
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-table-secondary"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: '6px', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.5 : 1 }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
