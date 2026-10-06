import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/competition-detail.css';

export default function AdminCompDetailPage() {
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(NexusAuth.getSession());
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);

  const paramId = searchParams.get('id') || sessionStorage.getItem('last_admin_comp_id');

  useEffect(() => {
    const allComps = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    let found = null;
    if (paramId && allComps.length > 0) {
      found = allComps.find(c => String(c.id) === String(paramId));
    }
    if (!found && allComps.length > 0) {
      found = allComps[0];
    }
    if (found) {
      sessionStorage.setItem('last_admin_comp_id', found.id);
      setComp(found);
    }
    setLoading(false);
  }, [paramId]);

  function getStatusLabel(c) {
    if (!c) return 'Upcoming';
    if (c.ended || c.status === 'completed') return 'Completed';
    if (c.status === 'ongoing' || c.status === 'active') return 'Active & Live';
    return 'Registration Open';
  }

  const role = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = role.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';

  if (loading) {
    return (
      <Shell sidebarVariant={sidebarVariant} activePage="competitions">
        <main className="main-content">
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading competition details...</div>
        </main>
      </Shell>
    );
  }

  if (!comp) {
    return (
      <Shell sidebarVariant={sidebarVariant} activePage="competitions">
        <main className="main-content">
          <Link to="/admin/dashboard" className="back-btn-alt">← Back to Dashboard</Link>
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Competition not found.</div>
        </main>
      </Shell>
    );
  }

  const compId = comp.id;
  const status = getStatusLabel(comp);
  const hasPrize = comp.prizePool && comp.prizePool !== 'No Prize Pool' && comp.prizePool !== '₹0' && comp.prizePool !== '—';
  const prizePhrase = hasPrize ? `the prize pool of ${comp.prizePool}` : 'glory and championship honors';
  const regDates = comp.registrationDates || {};

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="competitions">
      <main className="main-content">
        <Link to="/admin/dashboard" className="back-btn-alt">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4"/>
          </svg>
          Back to Dashboard
        </Link>

        <div className="admin-header-row">
          <div>
            <h1 className="admin-title-lg" id="cd-title">{comp.name}</h1>
            <p className="admin-subtitle-accent" id="cd-subtitle">
              {comp.game || 'Game'} • {status} • {comp.dates || 'TBD'}
            </p>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="admin-comp-tabs">
          <Link to={`/admin/competition-detail?id=${encodeURIComponent(compId)}`} className="admin-tab active">Overview</Link>
          <Link to={`/admin/manage-teams?id=${encodeURIComponent(compId)}`} className="admin-tab">Teams</Link>
          <Link to={`/admin/manage-matches?id=${encodeURIComponent(compId)}`} className="admin-tab">Matches</Link>
          <Link to={`/admin/match-results?id=${encodeURIComponent(compId)}`} className="admin-tab">Results</Link>
          <Link to={`/admin/view-standings?id=${encodeURIComponent(compId)}`} className="admin-tab">Standings</Link>
        </div>

        <div className="cd-layout-wrapper">
          {/* Left Main Column */}
          <div className="cd-main-stack">
            <div className="comp-info-block">
              <h2>About this Tournament</h2>
              <p id="cd-description">
                {comp.description || `The ${comp.name} is a competitive ${comp.format || 'Single Elimination'} tournament for ${comp.game}. Join teams from across the region to battle for ${prizePhrase}.`}
              </p>
            </div>

            <div className="comp-info-block">
              <h2>Schedule</h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="info-row">
                  <span className="key">Registration Opens</span>
                  <span className="val" id="sched-reg-open">{regDates.open || 'Jul 1, 2026'}</span>
                </div>
                <div className="info-row">
                  <span className="key">Registration Closes</span>
                  <span className="val" id="sched-reg-close">{regDates.close || 'Aug 10, 2026'}</span>
                </div>
                <div className="info-row">
                  <span className="key">Competition Dates</span>
                  <span className="val" id="sched-dates">{comp.dates || 'TBD'}</span>
                </div>
              </div>
            </div>

            <div className="comp-info-block">
              <h2>Competition Limits</h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="info-row">
                  <span className="key">Max Teams</span>
                  <span className="val" id="overview-max-teams">{comp.maxTeams ? `${comp.maxTeams} teams` : '32 teams'}</span>
                </div>
                <div className="info-row">
                  <span className="key">Max Players per Team</span>
                  <span className="val" id="overview-max-players">{comp.maxPlayersPerTeam ? `${comp.maxPlayersPerTeam} players per team` : '5 players per team'}</span>
                </div>
                <div className="info-row">
                  <span className="key">Entry Fee</span>
                  <span className="val" id="overview-entry-fee">{comp.entryFee || 'Free'}</span>
                </div>
                <div className="info-row">
                  <span className="key">Location</span>
                  <span className="val" id="overview-location">{comp.location || 'Online · Asia'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column */}
          <aside className="cd-sidebar-stack">
            <div className="comp-sidebar-block">
              <h3>Tournament Info</h3>
              <div className="info-row">
                <span className="key">Status</span>
                <span className="val" id="info-status" style={{ color: 'var(--accent, #c6ff33)' }}>{status}</span>
              </div>
              <div className="info-row">
                <span className="key">Game</span>
                <span className="val" id="info-game">{comp.game || '—'}</span>
              </div>
              <div className="info-row">
                <span className="key">Format</span>
                <span className="val" id="info-format">{comp.format || 'Single Elimination'}</span>
              </div>
              <div className="info-row">
                <span className="key">Teams</span>
                <span className="val" id="info-teams">{Array.isArray(comp.teams) ? comp.teams.length : 0}</span>
              </div>
              <div className="info-row">
                <span className="key">Date</span>
                <span className="val" id="info-date">{comp.dates || '—'}</span>
              </div>
              <div className="info-row">
                <span className="key">Prize Pool</span>
                <span className="val" id="info-prize" style={{ color: 'var(--accent, #c6ff33)', fontSize: '16px' }}>{comp.prizePool || '—'}</span>
              </div>
            </div>

            <div className="comp-sidebar-block" id="prize-breakdown-block">
              <h3>Prize Breakdown</h3>
              <div className="prize-breakdown" id="comp-prize-breakdown">
                {comp.prizeBreakdown && Array.isArray(comp.prizeBreakdown) && comp.prizeBreakdown.length > 0 ? (
                  comp.prizeBreakdown.map((pb, idx) => (
                    <div key={idx} className="info-row">
                      <span className="key">{pb.place || `Rank ${idx + 1}`}</span>
                      <span className="val" style={{ color: '#c6ff33' }}>{pb.amount || '—'}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted, #9aa4b2)', fontSize: '14px' }}>No prize breakdown available.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </Shell>
  );
}
