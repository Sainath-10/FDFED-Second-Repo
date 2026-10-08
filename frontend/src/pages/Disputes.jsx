/**
 * NEXUS ESPORTS — Disputes
 *
 * the filter tabs, the four static demo
 * dispute cards, the dynamic disputes (API first, else the admin dispute store)
 * prepended above them, and the evidence viewer modal.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NexusAPI from '../services/api.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/disputes.css';

const DISPUTE_STORE_KEY = 'nexus_admin_disputes';

const STATIC_DISPUTES = [
  {
    id: '#DISP-2026-0041', status: 'investigating', pill: 'pending', pillLabel: 'Investigating',
    title: 'Match Result Dispute — CS2 QF',
    desc: 'Inferno Squad claims Storm Riders used an exploit on Dust2 that resulted in an unfair round win in Round 18. Video evidence submitted.',
    meta: ['📅 Filed: Jul 12, 2026', '🏆 Competition: World Championship 2026', '👥 Match: Storm Riders vs Inferno Squad'],
    escalateTo: 'dispute-escalation.html',
    extraBtn: { label: 'Escalate', cls: 'btn-table-danger' },
  },
  {
    id: '#DISP-2026-0038', status: 'pending', pill: 'pending', pillLabel: 'Pending Review',
    title: 'Late Forfeit Claim — Valorant Group Stage',
    desc: 'Apex Predators claims their opponent Team Nova failed to show within the 15-minute window, requesting a forfeit win for Round 2, Group B.',
    meta: ['📅 Filed: Jul 10, 2026', '🏆 Competition: Pro League Season 5', '👥 Match: Apex Predators vs Team Nova'],
    extraBtn: { label: 'Review', cls: 'btn-table-primary' },
  },
  {
    id: '#DISP-2026-0031', status: 'resolved', pill: 'approved', pillLabel: 'Resolved',
    title: 'Server Disconnect — Rocket League',
    desc: 'NRG experienced server disconnects during overtime. The match was replayed from the 4:30 mark. Both teams agreed to the resolution.',
    meta: ['📅 Filed: Jun 28, 2026', '🏆 Competition: Rocket Championship Series', '👥 Match: NRG vs G2', '✅ Resolved: Jul 2, 2026'],
  },
  {
    id: '#DISP-2026-0022', status: 'resolved', pill: 'rejected', pillLabel: 'Dismissed',
    title: 'Cheating Allegation — LoL Spring Finals',
    desc: 'Cloud9 alleged scripting by T1 during Game 2. After review of replay data and anti-cheat logs, the allegation was found to be unsubstantiated.',
    meta: ['📅 Filed: Jun 15, 2026', '🏆 Competition: Spring Split Finals', '👥 Match: Cloud9 vs T1', '❌ Dismissed: Jun 18, 2026'],
  },
];

function mapApiDispute(d) {
  return {
    id: d.id,
    title: d.reason || 'Dispute',
    desc: d.reason || '',
    description: d.reason || '',
    status: d.status || 'pending',
    time: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
    matchName: d.competitionId || 'N/A',
    reporter: d.reportedBy || 'Player',
    submitter: d.reportedBy || 'Player',
    organizers: Array.isArray(d.organizers) ? d.organizers : [],
    targetUserOrTeam: d.targetUserOrTeam,
  };
}

function getStatusUi(status) {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'resolved') return { className: 'approved', label: 'Resolved', filter: 'resolved' };
  if (value === 'under_review' || value === 'investigating') return { className: 'pending', label: 'Investigating', filter: 'investigating' };
  if (value === 'escalated' || value === 'escalated_to_admin' || value === 'open_admin') return { className: 'pending', label: 'Escalated', filter: 'escalated' };
  return { className: 'pending', label: 'Pending Review', filter: value };
}

export default function Disputes() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [dynamic, setDynamic] = useState([]);
  const [modal, setModal] = useState(null);

  async function loadDisputesForPage() {
    if (NexusAPI && NexusAPI.Disputes) {
      try {
        const result = await NexusAPI.Disputes.getAll();
        if (result.ok && Array.isArray(result.data) && result.data.length > 0) return result.data.map(mapApiDispute);
      } catch (e) { /* ignore */ }
    }
    try { return JSON.parse(localStorage.getItem(DISPUTE_STORE_KEY) || '[]'); } catch (e) { return []; }
  }

  useEffect(() => {
    let alive = true;
    loadDisputesForPage().then((d) => { if (alive) setDynamic(d); });
    return () => { alive = false; };
  }, []);

  function showEvidence(disputeId) {
    let allEvidence = {};
    try { allEvidence = JSON.parse(localStorage.getItem('nexus.disputes.evidence') || '{}'); } catch (e) { /* ignore */ }
    const entries = disputeId && allEvidence[disputeId] ? [allEvidence[disputeId]] : Object.values(allEvidence);
    if (!entries.length || !entries.some((e) => e.files && e.files.length)) {
      showToast('No evidence files attached to this dispute.', 'error');
      return;
    }
    setModal(entries.flatMap((entry) => entry.files || []));
  }

  const visibleStatic = STATIC_DISPUTES.filter((d) => filter === 'all' || d.status === filter);
  const visibleDynamic = dynamic.filter((d) => filter === 'all' || getStatusUi(d.status).filter === filter);

  return (
    <>
      <main className="main-content">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Disputes</h1>
            <p className="page-subtitle">Manage and track match disputes and escalations.</p>
          </div>
          <Link to="/pages/dispute-escalation.html" className="btn-primary header-btn">Report to Dispute Admin</Link>
        </div>

        <div className="tabs-row">
          {[['all', 'All'], ['pending', 'Pending'], ['investigating', 'Investigating'], ['resolved', 'Resolved']].map(([key, label]) => (
            <button key={key} className={`filter-tab ${filter === key ? 'active' : ''}`} data-filter={key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>

        <div id="disputes-list">
          {visibleDynamic.map((d) => {
            const statusUi = getStatusUi(d.status);
            const notEscalatable = d.status === 'resolved' || d.status === 'escalated' || d.status === 'escalated_to_admin';
            return (
              <div className="dispute-card" data-status={statusUi.filter} key={d.id}>
                <div className="dispute-header">
                  <span className="dispute-id">#{d.id}</span>
                  <span className={`status-pill ${statusUi.className}`}>{statusUi.label}</span>
                </div>
                <div className="dispute-title">{d.title}</div>
                <div className="dispute-desc">{d.desc || d.description || ''}</div>
                <div className="dispute-meta">
                  <span>📅 Filed: {d.time || 'Recent'}</span>
                  <span>🏆 Competition: {d.matchName || 'N/A'}</span>
                  <span>👥 Reporter: {d.reporter || d.submitter || 'Player'}</span>
                  <span>🛡️ Routed to: {Array.isArray(d.organizers) && d.organizers.length > 0 ? d.organizers.join(', ') : 'Event Organizers'}</span>
                </div>
                <div className="dispute-actions">
                  <button className="btn-table-secondary" onClick={() => showEvidence(String(d.id))}>View Details</button>
                  {!notEscalatable && (
                    <button className="btn-table-danger" onClick={() => navigate(`/pages/dispute-escalation.html?id=${d.id}`)}>Escalate</button>
                  )}
                  {d.status === 'escalated' || d.status === 'escalated_to_admin' ? <span style={{ color: 'var(--accent)', fontSize: 12 }}>Escalated to Dispute Admin</span> : null}
                </div>
              </div>
            );
          })}

          {visibleStatic.map((d) => (
            <div className="dispute-card" data-status={d.status} key={d.id}>
              <div className="dispute-header">
                <span className="dispute-id">{d.id}</span>
                <span className={`status-pill ${d.pill}`}>{d.pillLabel}</span>
              </div>
              <div className="dispute-title">{d.title}</div>
              <div className="dispute-desc">{d.desc}</div>
              <div className="dispute-meta">
                {d.meta.map((m) => <span key={m}>{m}</span>)}
              </div>
              <div className="dispute-actions">
                <button className="btn-table-secondary" onClick={() => showEvidence(d.id.replace('#', ''))}>View Details</button>
                {d.extraBtn && d.escalateTo && (
                  <button className={d.extraBtn.cls} onClick={() => navigate(`/pages/${d.escalateTo}`)}>{d.extraBtn.label}</button>
                )}
                {d.extraBtn && !d.escalateTo && (
                  <button className={d.extraBtn.cls} onClick={() => showToast('Reviewing dispute...')}>{d.extraBtn.label}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {modal && (
        <div id="evidence-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ background: 'var(--bg-card,#1a1a1a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, maxWidth: 520, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: 'var(--text-white)', margin: 0, fontSize: 16 }}>Evidence Files</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            {modal.map((f, i) => (
              f.isImage && f.dataUrl ? (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <img src={f.dataUrl} alt={f.name} style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-white)' }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(f.size / 1024).toFixed(0)} KB · Image</div>
                  </div>
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 64, height: 48, background: 'rgba(198,255,51,0.08)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{(f.name || '').split('.').pop().toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-white)' }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(f.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </>
  );
}


