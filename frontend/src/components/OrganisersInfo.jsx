/**
 * NEXUS ESPORTS — organisers of one competition.
 *
 * Lists every organiser stored on the competition (creator and co-organisers)
 * with their current reputation badge and an individual Report Organiser
 * action. Selecting a username opens the recorded reputation history; private
 * notes, report descriptions and evidence are never included.
 */
import { useEffect, useState } from 'react';
import { LocalReputationAPI as ReputationAPI } from '../services/local/reporting.js';
import { LEVEL_META, formatINR, capitalise } from '../lib/reporting.js';
import ReputationBadge from './ReputationBadge.jsx';
import ReportButton from './ReportButton.jsx';

const LEVEL_ORDER = ['blue', 'green', 'orange', 'red'];

const formatDay = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function OrganiserRow({ competitionId, username, currentUsername, onOpen }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    ReputationAPI.publicOverview(username)
      .then((res) => { if (alive && res.ok && res.data) setProfile(res.data); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [username]);

  const isSelf = String(currentUsername || '').toLowerCase() === username.toLowerCase();

  return (
    <li className="organiser-row">
      <button
        type="button"
        className="organiser-username"
        onClick={() => onOpen(username)}
        title={'View reputation history for @' + username}
      >
        @{username}
      </button>
      {profile
        ? <ReputationBadge level={profile.level} limit={profile.limit} />
        : <span className="organiser-badge-placeholder">Reputation unavailable</span>}
      {!isSelf && (
        <ReportButton
          compId={competitionId}
          against={username}
          targetRole="organiser"
          source="organisers-info"
          label="Report Organiser"
          className="organiser-report-btn"
        />
      )}
    </li>
  );
}

export default function OrganisersInfo({ competitionId, organisers = [], currentUsername = '' }) {
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) return undefined;
    let alive = true;
    setLoading(true);
    setDetail(null);
    ReputationAPI.publicOverview(selected)
      .then((res) => { if (alive) setDetail(res.ok && res.data ? res.data : null); })
      .catch(() => { if (alive) setDetail(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selected]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSelected(''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (!organisers.length) {
    return <p className="organisers-empty">No organiser is recorded for this competition.</p>;
  }

  return (
    <>
      <ul className="organisers-list">
        {organisers.map((username) => (
          <OrganiserRow
            key={username}
            competitionId={competitionId}
            username={username}
            currentUsername={currentUsername}
            onOpen={setSelected}
          />
        ))}
      </ul>

      {selected && (
        <div
          className="organiser-modal-backdrop"
          onClick={(event) => { if (event.target === event.currentTarget) setSelected(''); }}
        >
          <div className="organiser-modal" role="dialog" aria-modal="true" aria-label={'Reputation history for @' + selected}>
            <button type="button" className="organiser-modal-close" onClick={() => setSelected('')} aria-label="Close">✕</button>
            <h3>@{selected}</h3>
            {loading && <p className="organiser-modal-muted">Loading reputation history…</p>}
            {!loading && !detail && <p className="organiser-modal-muted">Reputation history is unavailable for this account.</p>}
            {!loading && detail && (
              <>
                <div className="organiser-modal-summary">
                  <ReputationBadge level={detail.level} limit={detail.limit} />
                  <span className="organiser-modal-limit">Prize-pool limit {formatINR(detail.limit)}</span>
                </div>
                <h4>Times entered each level</h4>
                <div className="organiser-modal-levels">
                  {LEVEL_ORDER.map((level) => (
                    <div className="tile" key={level}>
                      <span style={{ color: LEVEL_META[level].color }}>{LEVEL_META[level].label}</span>
                      <strong>{(detail.levelCounts || {})[level] ?? 0}</strong>
                      <small>times</small>
                    </div>
                  ))}
                </div>
                <h4>Level transitions</h4>
                {Array.isArray(detail.transitions) && detail.transitions.length ? (
                  <ol className="organiser-modal-transitions">
                    {detail.transitions.map((entry) => (
                      <li key={entry.id}>
                        <span>{capitalise(entry.fromLevel || 'blue')} → {capitalise(entry.toLevel)}</span>
                        <time>{formatDay(entry.createdAt)}</time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="organiser-modal-muted">No reputation level transitions have been recorded.</p>
                )}
              </>
            )}
            <p className="organiser-modal-note">
              Private moderator notes, report descriptions and evidence are never shown here.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
