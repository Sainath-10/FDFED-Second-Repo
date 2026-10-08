/**
 * NEXUS ESPORTS — Admin Competition Overview
 *
 *
 */
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import '../styles/pages/admin/competition-detail.css';

const formatPrizePool = (prize) => {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) return 'No Prize Pool';
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
};
function getStatusLabel(comp) {
  if (!comp) return 'Upcoming';
  if (comp.ended || comp.status === 'completed') return 'Completed';
  if (comp.status === 'ongoing' || comp.status === 'active') return 'Active & Live';
  return 'Registration Open';
}

export default function AdminCompetitionDetail() {
  const [params] = useSearchParams();
  const comp = useMemo(() => {
    const all = NexusData ? NexusData.loadCompetitions() : [];
    let id = params.get('id') || sessionStorage.getItem('last_admin_comp_id');
    let c = id && all.length ? all.find((x) => String(x.id) === String(id)) : null;
    if (!c && all.length) c = all[0];
    return c;
  }, [params]);

  useEffect(() => {
    if (comp) sessionStorage.setItem('last_admin_comp_id', comp.id);
  }, [comp]);

  const suffix = comp ? `?id=${encodeURIComponent(comp.id)}` : '';
  const loading = !comp;

  if (loading) {
    return (
      <main className="main-content">
        <Link to="/pages/admin/dashboard.html" className="back-btn-alt">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
          Back to Dashboard
        </Link>
        <div id="cd-loading">Competition not found.</div>
      </main>
    );
  }

  const status = getStatusLabel(comp);
  const hasPrize = comp.prizePool && comp.prizePool !== 'No Prize Pool' && comp.prizePool !== '₹0' && comp.prizePool !== '—';
  const prizePhrase = hasPrize ? `the prize pool of ${comp.prizePool}` : 'glory and championship honors';
  const description = comp.description || `The ${comp.name} is a competitive ${comp.format || 'Single Elimination'} tournament for ${comp.game}. Join teams from across the region to battle for ${prizePhrase}.`;

  const regDates = comp.registrationDates || {};
  const teamList = Array.isArray(comp.teams) ? comp.teams : [];
  const approvedTeams = teamList.filter((t) => !t.status || t.status === 'approved');

  let prizes;
  if (Array.isArray(comp.prizes) && comp.prizes.length > 0) {
    prizes = comp.prizes.map((p, idx) => ({ medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️', place: p.place || `${idx + 1}th Place`, amount: p.amount || '—' }));
  } else if (hasPrize) {
    prizes = [{ medal: '🥇', place: '1st Place', amount: comp.prizePool || '—' }];
  } else {
    prizes = [];
  }

  return (
    <main className="main-content">
      <Link to="/pages/admin/dashboard.html" className="back-btn-alt">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Dashboard
      </Link>

      <div id="cd-content">
        <div className="admin-header-row">
          <div>
            <h1 className="admin-title-lg" id="cd-title">{comp.name}</h1>
            <p className="admin-subtitle-accent" id="cd-subtitle">{`${comp.game || 'Game'} • ${status} • ${comp.dates || 'TBD'}`}</p>
          </div>
        </div>

        <div className="admin-comp-tabs">
          <Link id="tab-overview" to={`/pages/admin/competition-detail.html${suffix}`} className="admin-tab active">Overview</Link>
          <Link id="tab-teams" to={`/pages/admin/manage-teams.html${suffix}`} className="admin-tab">Teams</Link>
          <Link id="tab-matches" to={`/pages/admin/manage-matches.html${suffix}`} className="admin-tab">Matches</Link>
          <Link id="tab-results" to={`/pages/admin/match-results.html${suffix}`} className="admin-tab">Results</Link>
          <Link id="tab-standings" to={`/pages/admin/view-standings.html${suffix}`} className="admin-tab">Standings</Link>
        </div>

        <div className="cd-layout-wrapper">
          <div className="cd-main-stack">
            <div className="comp-info-block">
              <h2>About this Tournament</h2>
              <p id="cd-description">{description}</p>
            </div>

            <div className="comp-info-block">
              <h2>Schedule</h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="info-row"><span className="key">Registration Opens</span><span className="val" id="sched-reg-open">{regDates.open || 'Jul 1, 2026'}</span></div>
                <div className="info-row"><span className="key">Registration Closes</span><span className="val" id="sched-reg-close">{regDates.close || 'Aug 10, 2026'}</span></div>
                <div className="info-row"><span className="key">Competition Dates</span><span className="val" id="sched-dates">{comp.dates || 'TBD'}</span></div>
              </div>
            </div>

            <div className="comp-info-block">
              <h2>Competition Limits</h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="info-row"><span className="key">Max Teams</span><span className="val" id="overview-max-teams">{comp.maxTeams ? `${comp.maxTeams} teams` : '32 teams'}</span></div>
                <div className="info-row"><span className="key">Max Players per Team</span><span className="val" id="overview-max-players">{comp.maxPlayersPerTeam ? `${comp.maxPlayersPerTeam} players per team` : '5 players per team'}</span></div>
                <div className="info-row"><span className="key">Entry Fee</span><span className="val" id="overview-entry-fee">{comp.entryFee || 'Free'}</span></div>
                <div className="info-row"><span className="key">Location</span><span className="val" id="overview-location">{comp.location || 'Online'}</span></div>
              </div>
            </div>
          </div>

          <aside className="cd-sidebar-stack">
            <div className="comp-sidebar-block">
              <h3>Tournament Info</h3>
              <div className="info-row"><span className="key">Status</span><span className="val" id="info-status" style={{ color: 'var(--accent, #c6ff33)' }}>{status}</span></div>
              <div className="info-row"><span className="key">Game</span><span className="val" id="info-game">{comp.game || '—'}</span></div>
              <div className="info-row"><span className="key">Format</span><span className="val" id="info-format">{comp.format || (comp.type === 'league' ? 'Round Robin' : 'Single Elimination')}</span></div>
              <div className="info-row"><span className="key">Teams</span><span className="val" id="info-teams">{`${approvedTeams.length} / ${comp.maxTeams || 32}`}</span></div>
              <div className="info-row"><span className="key">Date</span><span className="val" id="info-date">{comp.dates || 'TBD'}</span></div>
              <div className="info-row"><span className="key">Prize Pool</span><span className="val" id="info-prize" style={{ color: 'var(--accent, #c6ff33)', fontSize: 16 }}>{formatPrizePool(comp.prizePool || comp.prize)}</span></div>
            </div>

            <div className="comp-sidebar-block" id="prize-breakdown-block">
              <h3>Prize Breakdown</h3>
              <div className="prize-breakdown" id="comp-prize-breakdown">
                {prizes.length === 0 && <p style={{ color: 'var(--text-muted, #9aa4b2)', fontSize: 14, margin: 0 }}>No prize breakdown available.</p>}
                {prizes.map((p, i) => (
                  <div className="prize-row" key={i}><span className="place">{`${p.medal} ${p.place}`}</span><span className="amount">{p.amount}</span></div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}


