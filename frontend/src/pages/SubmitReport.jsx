/**
 * NEXUS ESPORTS — Raise a dispute
 *
 * A player in a competition disputes a result, an opponent, a rule or the
 * organizer. The competition list is the player's real competitions, evidence
 * is uploaded to the server, and the backend decides whether the dispute window
 * is still open. Errors are shown as they come back — nothing is reported as
 * "submitted" unless the server saved it.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { DisputesAPI, MatchesAPI, UploadAPI } from '../services/api.js';
import { fetchAllTeams, fetchCompetitions } from '../services/competitions.js';
import { EmptyState, LoadingState, Notice, PageHeader } from '../components/ui.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/submit-report.css';

const CATEGORIES = [
  { id: 'match_result', label: 'Match result is wrong', target: 'opponent_team' },
  { id: 'cheating', label: 'Cheating or exploit', target: 'opponent_team' },
  { id: 'conduct', label: 'Unsportsmanlike conduct', target: 'opponent_team' },
  { id: 'rule_violation', label: 'Rule was not applied correctly', target: 'match_rule' },
  { id: 'organizer_conduct', label: 'Problem with the organizer', target: 'organizer' },
  { id: 'prize_not_received', label: 'Prize not received', target: 'organizer' },
  { id: 'other', label: 'Something else', target: 'match_rule' },
];
const MAX_FILES = 5;
const lower = (v) => String(v || '').toLowerCase();

export default function SubmitReport() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState([]);
  const [compId, setCompId] = useState(params.get('compId') || '');
  const [category, setCategory] = useState('match_result');
  const [target, setTarget] = useState(params.get('against') || '');
  const [matchId, setMatchId] = useState('');
  const [matches, setMatches] = useState([]);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [comps, teams] = await Promise.all([fetchCompetitions(), fetchAllTeams()]);
      const me = lower(session?.username);
      const myTeams = teams.filter((t) => t.members.some((m) => lower(m.username) === me) && !['rejected', 'disbanded'].includes(t.status));
      const byId = new Map((comps.data || []).map((c) => [c.id, c]));
      const entries = myTeams.map((team) => {
        const comp = byId.get(team.competitionId);
        return comp ? { comp, team, opponents: teams.filter((t) => t.competitionId === comp.id && t.id !== team.id && !['disbanded'].includes(t.status)) } : null;
      }).filter(Boolean);
      setMine(entries);
      if (!compId && entries.length) setCompId(entries[0].comp.id);
      setLoading(false);
    })();
  }, [session?.username]);

  useEffect(() => {
    setMatches([]);
    setMatchId('');
    if (!compId) return;
    MatchesAPI.getByCompetition(compId).then((res) => { if (res.ok && Array.isArray(res.data)) setMatches(res.data.filter((m) => m.status !== 'bye')); });
  }, [compId]);

  const entry = useMemo(() => mine.find((e) => e.comp.id === compId) || null, [mine, compId]);
  const cat = CATEGORIES.find((c) => c.id === category);
  const myTeamMatches = entry ? matches.filter((m) => [m.team1Id, m.team2Id].includes(entry.team.id)) : [];

  function onFiles(event) {
    const list = Array.from(event.target.files || []);
    event.target.value = '';
    const next = [...files, ...list].slice(0, MAX_FILES);
    const tooBig = next.find((f) => f.size > 5 * 1024 * 1024);
    if (tooBig) { showToast(`${tooBig.name} is larger than 5 MB.`, 'error'); return; }
    setFiles(next);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!entry) { setError('Choose a competition you play in.'); return; }
    const trimmed = reason.trim();
    if (trimmed.length < 10) { setError('Describe the problem in at least 10 characters.'); return; }
    const targetUserOrTeam = cat.target === 'opponent_team' ? target : cat.target === 'organizer' ? entry.comp.createdBy : (target || 'Competition rules');
    if (cat.target === 'opponent_team' && !targetUserOrTeam) { setError('Choose the team this dispute is about.'); return; }

    setSubmitting(true);
    const evidenceUrls = [];
    for (const file of files) {
      const up = await UploadAPI.upload(file);
      if (!up.ok) { setSubmitting(false); setError(`Could not upload ${file.name}: ${up.error}`); return; }
      evidenceUrls.push(up.data.url);
    }
    const res = await DisputesAPI.create({
      competitionId: entry.comp.id,
      teamId: entry.team.id,
      ...(matchId ? { matchId } : {}),
      targetType: cat.target,
      targetUserOrTeam,
      category: cat.id,
      reason: trimmed,
      evidenceUrls,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error || 'The dispute was not saved.'); return; }
    showToast('Dispute submitted. You can follow it on the Disputes page.', 'success');
    navigate('/pages/disputes.html');
  }

  if (loading) return <main className="main-content"><LoadingState label="Loading your competitions…" /></main>;

  return (
    <main className="main-content">
      <Link to="/pages/disputes.html" className="back-btn-alt">← Back to disputes</Link>
      <PageHeader title="Raise a dispute" subtitle="Disputes go to the organizer first; disputes about the organizer go straight to platform staff." />

      {mine.length === 0 ? (
        <EmptyState title="You are not in any competition" message="You can raise a dispute about a competition you play in." action={<Link className="btn-primary" to="/pages/competitions.html">Browse competitions</Link>} />
      ) : (
        <form className="ui-card" style={{ maxWidth: 720 }} onSubmit={submit} noValidate>
          <div className="ui-field">
            <label htmlFor="d-comp">Competition</label>
            <select id="d-comp" className="form-input" value={compId} onChange={(e) => { setCompId(e.target.value); setTarget(''); }}>
              {mine.map((e) => <option key={e.comp.id} value={e.comp.id}>{e.comp.name} — your team: {e.team.name}</option>)}
            </select>
            {entry && <span className="ui-field-help">Disputes stay open while the competition runs and for 24 hours after the organizer ends it.</span>}
          </div>
          <div className="ui-field">
            <label htmlFor="d-cat">What is the problem?</label>
            <select id="d-cat" className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {cat.target === 'opponent_team' && (
            <div className="ui-field">
              <label htmlFor="d-target">Which team?</label>
              <select id="d-target" className="form-input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose a team…</option>
                {(entry?.opponents || []).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          )}
          {cat.target === 'organizer' && entry && <Notice tone="info">This goes to platform staff, not to the organizer (@{entry.comp.createdBy}).</Notice>}
          <div className="ui-field">
            <label htmlFor="d-match">Match (optional)</label>
            <select id="d-match" className="form-input" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">Not about one match</option>
              {myTeamMatches.map((m) => <option key={m.id} value={m.id}>{m.round || 'Match'}: {m.team1Name} vs {m.team2Name}{m.score ? ` (${m.score})` : ''}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label htmlFor="d-reason">What happened?</label>
            <textarea id="d-reason" className="form-input" rows={5} maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe what happened, when, and what outcome you expect." />
            <span className="ui-field-help">{reason.trim().length} / 4000 characters, at least 10.</span>
          </div>
          <div className="ui-field">
            <label>Evidence (optional, up to {MAX_FILES} files)</label>
            <label className="btn-cancel" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
              Add files
              <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain" onChange={onFiles} style={{ display: 'none' }} />
            </label>
            {files.map((f, i) => (
              <div className="ui-row" key={`${f.name}-${i}`} style={{ padding: '8px 12px' }}>
                <div className="ui-row-main"><div className="ui-row-title" style={{ fontSize: 14 }}>{f.name}</div><div className="ui-row-meta">{Math.ceil(f.size / 1024)} KB</div></div>
                <button type="button" className="btn-table-danger" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="ui-dialog-actions">
            <Link className="btn-cancel" to="/pages/disputes.html">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit dispute'}</button>
          </div>
        </form>
      )}
    </main>
  );
}
