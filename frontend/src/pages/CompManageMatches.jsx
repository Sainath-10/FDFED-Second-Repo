/**
 * NEXUS ESPORTS — Manage Matches
 *
 * schedule a new
 * match (team dropdowns excluding each other, date/time, type-aware round list),
 * the paginated scheduled-matches table with ENTER RESULT links, and the
 * ended-competition lock.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import { MatchesAPI } from '../services/api.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/subpage.css';

const PAGE_SIZE = 5;
const ROUND_OPTIONS = {
  league: ['Group Stage', 'Eliminations', 'Quarterfinals', 'Semifinals', 'Finals'],
  tournament: ['Eliminations', 'Quarterfinals', 'Semifinals', 'Finals'],
};
const STATUS_MAP = { scheduled: ['Scheduled', 'sm-scheduled'], live: ['Live Now', 'sm-live'], completed: ['Completed', 'sm-completed'] };

function getCompType(c) {
  const raw = String(c.type || c.format || '').toLowerCase();
  if (raw.includes('league') || raw.includes('round-robin') || raw.includes('round robin')) return 'league';
  return 'tournament';
}

export default function CompManageMatches() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';

  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [backendMatches, setBackendMatches] = useState([]);
  const [backendLoaded, setBackendLoaded] = useState(false);
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const comp = useMemo(() => {
    if (!id || !NexusData) return null;
    const found = NexusData.getCompetitionById(id);
    return found || { id, name: 'New Competition', game: '—', type: 'league', status: 'upcoming', teams: [], matches: [], maxTeams: 16, format: '—', season: '—', totalMatches: 0, matchesCompleted: 0 };
  }, [id, version]);

  // §8/§11 — the organizer table reflects the authoritative match service.
  useEffect(() => {
    let cancelled = false;
    if (!id) return undefined;
    MatchesAPI.getByCompetition(id)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && Array.isArray(res.data)) {
          setBackendMatches(res.data);
          setBackendLoaded(true);
          setApiError('');
        } else if (res.error && !/backend|network|Failed to fetch|is the backend/i.test(String(res.error))) {
          setApiError(res.error);
        }
      })
      .catch(() => { /* keep local fallback */ });
    return () => { cancelled = true; };
  }, [id, version]);

  useEffect(() => {
    if (comp && NexusData.enforceNotEnded) {
      NexusData.enforceNotEnded(comp, '#btn-schedule-match,#btn-add-match,button[type="submit"],.btn-schedule,.btn-result,.btn-enter-result');
    }
    return () => {
      const b = document.getElementById('_ended_banner_');
      if (b) b.remove();
      document.body.style.marginTop = '';
    };
  }, [comp]);

  const [round, setRound] = useState(ROUND_OPTIONS.tournament[0]);

  if (!comp) return <main className="sub-main"><h1 className="sub-page-title">Manage Matches</h1></main>;

  const approvedTeams = (comp.teams || []).filter((t) => t.status === 'approved');
  const roundOptions = ROUND_OPTIONS[getCompType(comp)] || ROUND_OPTIONS.tournament;
  const effectiveRound = roundOptions.includes(round) ? round : roundOptions[0];

  const apiMatches = backendMatches.map((m) => {
    const [score1 = '—', score2 = '—'] = String(m.score || '').split(/\s*[-:]\s*/);
    const scheduled = m.scheduledAt ? new Date(m.scheduledAt) : null;
    const valid = scheduled && !Number.isNaN(scheduled.getTime());
    return {
      id: m.id,
      team1: m.team1Name || 'TBD',
      team2: m.team2Name || 'TBD',
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      round: m.round || '—',
      status: m.status === 'ongoing' ? 'live' : (m.status || 'scheduled'),
      score1,
      score2,
      date: valid ? scheduled.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      time: valid ? scheduled.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
    };
  });
  const matches = backendLoaded ? apiMatches : (comp.matches || []);
  const filtered = matches.filter((m) => {
    const ms = filter === 'all' || m.status === filter;
    const mq = !searchQ || String(m.team1 || '').toLowerCase().includes(searchQ) || String(m.team2 || '').toLowerCase().includes(searchQ) || String(m.id || '').toLowerCase().includes(searchQ);
    return ms && mq;
  });
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  async function scheduleMatch(event) {
    event.preventDefault();
    if (busy) return;
    if (!team1 || !team2 || team1 === team2) { showToast('Please select two different teams.', 'error'); return; }
    const teamOne = approvedTeams.find((t) => t.name === team1);
    const teamTwo = approvedTeams.find((t) => t.name === team2);
    const scheduledAt = date ? new Date(`${date}T${time || '00:00'}:00`).toISOString() : undefined;

    setBusy(true);
    // §11 — the backend validates the competition window and team overlaps.
    const res = await MatchesAPI.create(
      comp.dbId || comp.id,
      teamOne?.dbId || teamOne?.id,
      teamTwo?.dbId || teamTwo?.id,
      team1,
      team2,
      scheduledAt,
      effectiveRound,
    );
    setBusy(false);

    if (res.ok) {
      showToast('Match scheduled.');
      setTeam1(''); setTeam2(''); setDate(''); setTime('');
      setVersion((v) => v + 1);
      return;
    }
    if (res.error && !/backend|network|Failed to fetch|is the backend/i.test(String(res.error))) {
      showToast(res.error, 'error');
      return;
    }

    // Offline fallback preserves the existing local behaviour.
    const fresh = NexusData.getCompetitionById(id);
    const target = fresh || comp;
    if (!Array.isArray(target.matches)) target.matches = [];
    target.matches.unshift({
      id: `M${Date.now().toString().slice(-6)}`,
      team1,
      team2,
      round: effectiveRound,
      status: 'scheduled',
      date: date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      time: time || '—',
    });
    target.totalMatches = target.matches.length;
    NexusData.updateCompetition(target);
    setTeam1(''); setTeam2(''); setDate(''); setTime('');
    setVersion((v) => v + 1);
  }

  async function generateFixtures() {
    if (busy) return;
    setBusy(true);
    const compKey = comp.dbId || comp.id;
    let res = await MatchesAPI.generateSchedule(compKey, {});
    if (!res.ok && /confirmOverlap/i.test(String(res.error || ''))) {
      const confirmed = window.confirm('Existing scheduled matches will be replaced. Completed/verified results are always preserved. Continue?');
      if (!confirmed) { setBusy(false); return; }
      res = await MatchesAPI.generateSchedule(compKey, { confirmOverlap: true });
    }
    setBusy(false);
    if (res.ok) {
      showToast(`Generated ${res.data?.created ?? 0} fixture(s).`);
      setVersion((v) => v + 1);
    } else if (res.error && !/backend|network|Failed to fetch|is the backend/i.test(String(res.error))) {
      showToast(res.error, 'error');
    }
  }

  const teamOptions = (exclude) => approvedTeams
    .filter((t) => t.status === 'approved' && t.status !== 'banned')
    .filter((t) => !exclude || String(t.name || '').toLowerCase() !== String(exclude || '').toLowerCase());

  return (
    <main className="sub-main">
      <div className="sub-page-header">
        <div className="sub-header-content">
          <h1 className="sub-page-title">Manage Matches</h1>
          <p className="sub-page-subtitle">Schedule and manage scheduled matches for this competition</p>
        </div>
        <Link className="btn-back" id="btn-back-to-comp" to={`/pages/competition-detail.html?id=${id}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="comp-banner comp-banner-lg" id="comp-banner">
        <div className="banner-img-placeholder banner-img-lg">🎮</div>
        <div className="banner-info">
          <span className="banner-status-tag">{comp.status === 'ongoing' ? 'ACTIVE COMPETITION' : String(comp.status).toUpperCase()}</span>
          <h2 className="banner-title banner-title-lg">{comp.name}</h2>
          <div className="banner-meta">
            <span className="banner-tag">🎮 {comp.game}</span>
            <span className="banner-tag">🔄 {comp.format}</span>
          </div>
        </div>
        <div className="banner-stats">
          <div><span className="banner-stat-label">TEAMS</span><span className="banner-stat-val">{approvedTeams.length}</span></div>
          <div><span className="banner-stat-label">MATCHES</span><span className="banner-stat-val">{matches.length}</span></div>
        </div>
      </div>

      {apiError && (
        <div role="alert" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          {apiError}
        </div>
      )}

      <div className="matches-body">
        <div className="sub-panel">
          <div className="panel-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><line x1="8" y1="5" x2="8" y2="8" /><line x1="10" y1="10" x2="8" y2="8" /></svg>
              Schedule New Match
            </span>
            <button type="button" className="btn-xs" id="btn-generate-fixtures" onClick={generateFixtures} disabled={busy} title="Generate fixtures from the configured tournament format">
              {busy ? 'Working…' : 'Auto-generate fixtures'}
            </button>
          </div>
          <form id="schedule-form" className="schedule-form" onSubmit={scheduleMatch}>
            <div className="form-row-2">
              <div className="form-group">
                <label>TEAM 1</label>
                <select id="sf-team1" value={team1} onChange={(e) => setTeam1(e.target.value)}>
                  <option value="">Select Team</option>
                  {teamOptions(team2).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>TEAM 2</label>
                <select id="sf-team2" value={team2} onChange={(e) => setTeam2(e.target.value)}>
                  <option value="">Select Team</option>
                  {teamOptions(team1).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row-2">
              <div className="form-group"><label>MATCH DATE</label><input type="date" id="sf-date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="form-group"><label>MATCH TIME</label><input type="time" id="sf-time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>
            <div className="form-group">
              <label>ROUND</label>
              <select id="sf-round" value={effectiveRound} onChange={(e) => setRound(e.target.value)}>
                {roundOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-schedule" disabled={busy}>{busy ? 'SCHEDULING…' : 'SCHEDULE MATCH'}</button>
          </form>
        </div>

        <div className="sub-panel">
          <div className="panel-section-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="2" width="14" height="13" rx="2" /><line x1="1" y1="6" x2="15" y2="6" /></svg>
            Scheduled Matches
          </div>
          <div className="matches-toolbar">
            <div className="search-box-wrapper">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round"><circle cx="9" cy="9" r="6" /><line x1="14" y1="14" x2="18" y2="18" /></svg>
              <input type="text" className="sub-search sub-search-sm" id="matches-search" placeholder="Search matches..." value={searchQ} onChange={(e) => { setSearchQ(e.target.value.toLowerCase().trim()); setPage(1); }} />
            </div>
            <select className="sub-select sub-select-sm" id="matches-status-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
              <option value="all">Status: All</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
            <button className="icon-btn" title="Sort">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="4" y1="8" x2="12" y2="8" /><line x1="6" y1="12" x2="10" y2="12" /></svg>
            </button>
          </div>
          <div className="scheduled-matches-table">
            <div className="sm-header">
              <span className="sm-col-id">MATCH ID</span><span className="sm-col-teams">TEAMS</span><span className="sm-col-round">ROUND</span>
              <span className="sm-col-date">DATE &amp; TIME</span><span className="sm-col-status">STATUS</span>
            </div>
            <div id="matches-rows">
              {slice.length === 0 ? (
                <div className="empty-state">No matches found. Schedule one!</div>
              ) : (
                slice.map((m) => {
                  const [label, cls] = STATUS_MAP[m.status] || ['—', ''];
                  const isLive = m.status === 'live';
                  const scoreHtml = m.status === 'completed' ? `${m.score1}–${m.score2}` : 'vs';
                  return (
                    <div className="sm-row" key={m.id}>
                      <span className="sm-col-id match-id-link">#{m.id}</span>
                      <span className="sm-col-teams">{m.team1} <span className="vs-sep">{scoreHtml}</span> {m.team2}</span>
                      <span className="sm-col-round">{m.round}</span>
                      <span className="sm-col-date">
                        <span>{m.date}</span>
                        <span className={`match-time ${isLive ? 'time-live' : ''}`}>{isLive ? 'In Progress' : m.time}</span>
                      </span>
                      <span className="sm-col-status">
                        <span className={`sm-status-badge ${cls}`}>{label}</span>
                        {m.status !== 'completed' && (
                          <Link to={`/pages/comp-match-results.html?id=${comp.id}&matchId=${encodeURIComponent(m.id)}`} className="btn-xs btn-enter" data-match-id={m.id}>ENTER RESULT</Link>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="sub-pagination" id="matches-pagination">
            <span className="pg-info">Showing {Math.min(start + 1, total)}–{Math.min(start + PAGE_SIZE, total)} of {total} matches</span>
            <div className="pg-btns">
              <button className="pg-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
              <button className="pg-btn" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


