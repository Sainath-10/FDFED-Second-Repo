import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusAPI } from '../services/api';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/disputes.css';

const DEFAULT_DISPUTES = [
  {
    id: 'DISP-2026-0041',
    status: 'investigating',
    title: 'Match Result Dispute — CS2 QF',
    desc: 'Inferno Squad claims Storm Riders used an exploit on Dust2 that resulted in an unfair round win in Round 18. Video evidence submitted.',
    time: 'Jul 12, 2026',
    matchName: 'World Championship 2026',
    teams: 'Storm Riders vs Inferno Squad'
  },
  {
    id: 'DISP-2026-0038',
    status: 'pending',
    title: 'Late Forfeit Claim — Valorant Group Stage',
    desc: 'Apex Predators claims their opponent Team Nova failed to show within the 15-minute window, requesting a forfeit win for Round 2, Group B.',
    time: 'Jul 10, 2026',
    matchName: 'Pro League Season 5',
    teams: 'Apex Predators vs Team Nova'
  },
  {
    id: 'DISP-2026-0031',
    status: 'resolved',
    title: 'Server Disconnect — Rocket League',
    desc: 'NRG experienced server disconnects during overtime. The match was replayed from the 4:30 mark. Both teams agreed to the resolution.',
    time: 'Jun 28, 2026',
    matchName: 'Rocket Championship Series',
    teams: 'NRG vs G2',
    resolvedDate: 'Jul 2, 2026'
  },
  {
    id: 'DISP-2026-0022',
    status: 'resolved',
    isDismissed: true,
    title: 'Cheating Allegation — LoL Spring Finals',
    desc: 'Cloud9 alleged scripting by T1 during Game 2. After review of replay data and anti-cheat logs, the allegation was found to be unsubstantiated.',
    time: 'Jun 15, 2026',
    matchName: 'Spring Split Finals',
    teams: 'Cloud9 vs T1',
    resolvedDate: 'Jun 18, 2026'
  }
];

export default function DisputesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeFilter, setActiveFilter] = useState('all');
  const [disputesList, setDisputesList] = useState([]);
  const [modalEvidence, setModalEvidence] = useState(null);

  useEffect(() => {
    let loadedDynamic = [];
    try {
      const stored = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
      if (Array.isArray(stored)) {
        loadedDynamic = stored.map(d => ({
          id: d.id,
          status: d.status === 'resolved' ? 'resolved' : (d.status === 'open_admin' || d.status === 'escalated_to_admin' ? 'pending' : 'investigating'),
          title: d.title || d.reason || 'Dispute',
          desc: d.desc || d.description || d.reason || '',
          time: d.time || (d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Recent'),
          matchName: d.matchName || d.competition || 'Competition',
          teams: d.against ? `Against ${d.against}` : (d.targetUserOrTeam || 'Opponent'),
          evidenceUrls: d.evidenceUrls || []
        }));
      }
    } catch (e) {}

    setDisputesList([...loadedDynamic, ...DEFAULT_DISPUTES]);

    if (NexusAPI && NexusAPI.Disputes) {
      NexusAPI.Disputes.getAll().then(res => {
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          const apiItems = res.data.map(d => ({
            id: d.id,
            status: d.status || 'pending',
            title: d.reason || 'Dispute',
            desc: d.reason || '',
            time: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Recent',
            matchName: d.competitionId || 'N/A',
            teams: d.targetUserOrTeam || 'Opponent'
          }));
          setDisputesList([...apiItems, ...DEFAULT_DISPUTES]);
        }
      }).catch(() => {});
    }
  }, []);

  const handleShowDetails = (dispId) => {
    let allEvidence = {};
    try {
      allEvidence = JSON.parse(localStorage.getItem('nexus.disputes.evidence') || '{}');
    } catch (e) {}

    const entry = allEvidence[dispId];
    if (entry && Array.isArray(entry.files) && entry.files.length > 0) {
      setModalEvidence(entry.files);
    } else {
      showToast('No uploaded evidence files attached to this dispute.', 'error');
    }
  };

  const filteredDisputes = disputesList.filter(d => {
    if (activeFilter === 'all') return true;
    return d.status === activeFilter;
  });

  return (
    <Shell activeTab="competitions">
      <main className="main-content">
          <div className="page-header-row">
            <div>
              <h1 className="page-title">Disputes</h1>
              <p className="page-subtitle">Manage and track match disputes and escalations.</p>
            </div>
            <button
              type="button"
              className="btn-primary header-btn"
              onClick={() => showToast('Opening Super Admin Escalation...')}
            >
              Report to Super Admin
            </button>
          </div>

          {/* Filter tabs */}
          <div className="tabs-row">
            <button
              type="button"
              className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-tab ${activeFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveFilter('pending')}
            >
              Pending
            </button>
            <button
              type="button"
              className={`filter-tab ${activeFilter === 'investigating' ? 'active' : ''}`}
              onClick={() => setActiveFilter('investigating')}
            >
              Investigating
            </button>
            <button
              type="button"
              className={`filter-tab ${activeFilter === 'resolved' ? 'active' : ''}`}
              onClick={() => setActiveFilter('resolved')}
            >
              Resolved
            </button>
          </div>

          {/* Dispute cards */}
          <div id="disputes-list">
            {filteredDisputes.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No disputes found.</div>
            ) : (
              filteredDisputes.map((d, idx) => {
                const isResolved = d.status === 'resolved';
                const isInvestigating = d.status === 'investigating';
                const pillLabel = isResolved
                  ? (d.isDismissed ? 'Dismissed' : 'Resolved')
                  : (isInvestigating ? 'Investigating' : 'Pending Review');
                const pillClass = isResolved
                  ? (d.isDismissed ? 'rejected' : 'approved')
                  : 'pending';

                return (
                  <div key={d.id + idx} className="dispute-card" data-status={d.status}>
                    <div className="dispute-header">
                      <span className="dispute-id">#{d.id}</span>
                      <span className={`status-pill ${pillClass}`}>{pillLabel}</span>
                    </div>
                    <div className="dispute-title">{d.title}</div>
                    <div className="dispute-desc">{d.desc}</div>
                    <div className="dispute-meta">
                      <span>📅 Filed: {d.time}</span>
                      <span>🏆 Competition: {d.matchName}</span>
                      {d.teams && <span>👥 {d.teams}</span>}
                      {d.resolvedDate && <span>✅ {d.isDismissed ? 'Dismissed' : 'Resolved'}: {d.resolvedDate}</span>}
                    </div>
                    <div className="dispute-actions">
                      <button
                        type="button"
                        className="btn-table-secondary"
                        onClick={() => handleShowDetails(d.id)}
                      >
                        View Details
                      </button>
                      {!isResolved && (
                        <button
                          type="button"
                          className="btn-table-danger"
                          onClick={() => {
                            showToast('Escalating to Super Admin...');
                          }}
                        >
                          Escalate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>

      {/* Evidence Viewer Modal */}
      {modalEvidence && (
        <div
          id="evidence-modal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => e.target.id === 'evidence-modal' && setModalEvidence(null)}
        >
          <div
            style={{
              background: 'var(--bg-card, #1a1a1a)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '520px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--text-white)', margin: 0, fontSize: '16px' }}>Evidence Files</h3>
              <button
                type="button"
                onClick={() => setModalEvidence(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            {modalEvidence.map((f, idx) => (
              <div
                key={idx}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                {f.isImage && f.dataUrl ? (
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    style={{ width: '64px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: '64px',
                      height: '48px',
                      background: 'rgba(198,255,51,0.08)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                  >
                    FILE
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-white)' }}>{f.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {(f.size / 1024).toFixed(0)} KB {f.isImage ? '· Image' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
