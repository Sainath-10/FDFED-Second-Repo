import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusData } from '../services/competitionService';
import '../styles/pages/admin/dashboard.css';
import '../styles/pages/organizer-revenue.css';

function money(value) {
  return 'Rs.' + (Number(value) || 0).toLocaleString('en-IN');
}

function paymentStatusLabel(item) {
  return ((item && item.paymentStatus === 'paid') || Number(item && item.feePaid || 0) > 0) ? 'paid' : 'not_paid';
}

export default function OrganizerRevenuePage() {
  const [searchParams] = useSearchParams();
  const [comp, setComp] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const compId = searchParams.get('id') || sessionStorage.getItem('last_comp_id');
    const compData = compId ? NexusData.getCompetitionById(compId) : null;
    setComp(compData);

    const generatedRows = [];
    if (compData && Array.isArray(compData.teams)) {
      compData.teams.forEach(team => {
        if ((compData.feeType || 'free') === 'per_team') {
          generatedRows.push({
            name: team.name || 'Team',
            type: 'Team',
            team: team.name || '-',
            amount: Number(team.feePaid || compData.entryFeeAmount || 0),
            paymentStatus: paymentStatusLabel(team)
          });
        }
        const joinRequests = team.joinRequests || [];
        const memberNames = new Set((team.members || []).map(member => String(member.username || '').toLowerCase()));
        (team.members || []).forEach(member => {
          if ((compData.feeType || 'free') === 'per_player') {
            const requestPayment = joinRequests.find(req => String(req.username || '').toLowerCase() === String(member.username || '').toLowerCase());
            const paymentSource = requestPayment || member;
            generatedRows.push({
              name: member.username || member.displayName || 'Player',
              type: 'Player',
              team: team.name || '-',
              amount: Number(paymentSource.feePaid || compData.entryFeeAmount || 0),
              paymentStatus: paymentStatusLabel(paymentSource)
            });
          }
        });
        joinRequests.forEach(req => {
          if ((compData.feeType || 'free') === 'per_player' && !memberNames.has(String(req.username || '').toLowerCase())) {
            generatedRows.push({
              name: req.username || req.displayName || 'Player',
              type: 'Player',
              team: team.name || '-',
              amount: Number(req.feePaid || compData.entryFeeAmount || 0),
              paymentStatus: paymentStatusLabel(req)
            });
          }
        });
      });
    }
    setRows(generatedRows);
  }, [searchParams]);

  const total = rows.reduce((sum, row) => sum + (row.paymentStatus === 'paid' ? row.amount : 0), 0);
  const paidCount = rows.filter(row => row.paymentStatus === 'paid').length;
  const compId = comp ? comp.id : (searchParams.get('id') || '');

  return (
    <Shell activeTab="activity">
      <main className="rev-page">
          <Link
            to={compId ? `/competition-detail?id=${encodeURIComponent(compId)}` : '/competitions'}
            id="rev-back-btn"
            className="btn-table-secondary"
            style={{ marginBottom: '24px', display: 'inline-block' }}
          >
            Back
          </Link>
          <div className="rev-header">
            <h1 className="rev-title" id="rev-title">
              {comp ? `${comp.name} Revenue` : 'Revenue'}
            </h1>
            <p className="rev-sub" id="rev-sub">Teams and players who paid entry fees.</p>
          </div>

          <div className="rev-grid">
            <div className="rev-card">
              <div className="rev-num" id="rev-total">{money(total)}</div>
              <div className="rev-label">Total Collected</div>
            </div>
            <div className="rev-card">
              <div className="rev-num" id="rev-paid">{paidCount}</div>
              <div className="rev-label">Paid Entries</div>
            </div>
            <div className="rev-card">
              <div className="rev-num" id="rev-fee">{comp ? (comp.entryFee || 'Free') : 'Free'}</div>
              <div className="rev-label">Entry Fee</div>
            </div>
          </div>

          <div className="table-container-card">
            <div className="table-header-between">
              <h2 className="table-title-md">Payments</h2>
            </div>
            <div className="table-scroll-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Team</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="rev-rows">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                        No team or player payments yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.name}</td>
                        <td>{row.type}</td>
                        <td>{row.team}</td>
                        <td className="text-accent-bold">{money(row.amount)}</td>
                        <td>
                          <span className={`status-pill ${row.paymentStatus === 'paid' ? 'approved' : 'pending'}`}>
                            {row.paymentStatus === 'paid' ? 'PAID' : 'NOT PAID'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
    </Shell>
  );
}
