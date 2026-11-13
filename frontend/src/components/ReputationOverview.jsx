/**
 * NEXUS ESPORTS — organiser reputation overview
 *
 * Every figure comes from a stored record: level transitions, sanctions and
 * reports. A report is an allegation — only a substantiated finding counts.
 */
import ReputationBadge from './ReputationBadge.jsx';
import { LEVEL_META, formatINR, capitalise } from '../lib/reporting.js';
import '../styles/pages/reports.css';
import '../styles/pages/profile.css';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

const LEVEL_ORDER = ['blue', 'green', 'orange', 'red'];

/**
 * Organiser Reputation & History.
 *
 * Every figure comes from a stored record: level transitions, sanctions and
 * reports. A report against an organiser is an allegation — only a
 * substantiated finding is counted as a violation.
 */
export default function ReputationOverview({ overview }) {
  if (!overview) {
    return (
      <div className="profile-section panel-section-wrapper">
        <p className="empty-state-text" style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>
          Loading your organiser record…
        </p>
      </div>
    );
  }

  const meta = LEVEL_META[overview.level] || LEVEL_META.blue;
  const warnings = overview.warningSummary || { total: 0 };
  const reports = overview.reports || { total: 0, substantiated: 0, unsubstantiated: 0, discarded: 0, underReview: 0 };
  const levelCounts = overview.levelCounts || {};
  const levelHistory = overview.levelHistory || [];
  const warningTotal = Number(warnings.total) || 0;

  return (
    <div className="rep-dashboard">
      <section className="rep-panel" id="rep-current">
        <header className="rep-panel-head">
          <h3>Current Reputation</h3>
          <p>The level that applies to this organiser account right now.</p>
        </header>
        <div className="rep-current">
          <ReputationBadge level={overview.level} limit={overview.limit} />
          {overview.lifetimeBan && <span className="rep-alert">Lifetime organising ban</span>}
          {!overview.lifetimeBan && overview.bannedUntil && (
            <span className="rep-alert">Organising restricted until {formatDate(overview.bannedUntil)}</span>
          )}
        </div>
        <p className="rep-explain">{meta.description}</p>
        <dl className="rep-facts">
          <div><dt>Prize-pool limit</dt><dd>{formatINR(overview.limit)}</dd></div>
          <div><dt>Platform maximum</dt><dd>{formatINR(overview.globalMax)}</dd></div>
          <div><dt>At this level since</dt><dd>{overview.levelEnteredAt ? formatDate(overview.levelEnteredAt) : 'No recorded transition'}</dd></div>
        </dl>
      </section>

      <section className="rep-panel" id="rep-warnings">
        <header className="rep-panel-head">
          <h3>Warning Statistics</h3>
          <p>Warnings recorded by a Community Moderator.</p>
        </header>
        {warningTotal > 0 ? (
          <div className="rep-stat-row">
            <div>
              <span className="n">{warningTotal}</span>
              <span className="l">{warningTotal === 1 ? 'Total warning' : 'Total warnings'}</span>
            </div>
          </div>
        ) : (
          <p className="rep-empty">No warnings have been recorded on this account.</p>
        )}
      </section>

      <section className="rep-panel" id="rep-reports">
        <header className="rep-panel-head">
          <h3>Reports Filed Against You</h3>
          <p>Calculated from stored reports and their recorded findings.</p>
        </header>
        <div className="rep-stat-row rep-stat-row-wrap">
          <div><span className="n">{reports.total}</span><span className="l">Total</span></div>
          <div><span className="n">{reports.substantiated}</span><span className="l">Substantiated</span></div>
          <div><span className="n">{reports.unsubstantiated}</span><span className="l">Unsubstantiated</span></div>
          <div><span className="n">{reports.discarded}</span><span className="l">Discarded</span></div>
          <div><span className="n">{reports.underReview}</span><span className="l">Under review</span></div>
        </div>
        <p className="rep-footnote">A submitted report is an allegation. Only a substantiated finding counts as a violation.</p>
      </section>

      <section className="rep-panel" id="rep-levels">
        <header className="rep-panel-head">
          <h3>Reputation Level History</h3>
          <p>How many times this account has entered each reputation level.</p>
        </header>
        <div className="rep-level-grid">
          {LEVEL_ORDER.map((level) => {
            const levelMeta = LEVEL_META[level];
            return (
              <div className="rep-level-tile" key={level}>
                <span className="dot" style={{ background: levelMeta.color }} />
                <span className="rep-level-name" style={{ color: levelMeta.color }}>{levelMeta.label}</span>
                <strong>{levelCounts[level] ?? 0}</strong>
                <small>times entered</small>
              </div>
            );
          })}
        </div>
        <p className="rep-footnote">Counts come from recorded transitions; the initial level is not a transition.</p>
      </section>

      <section className="rep-panel" id="rep-transitions">
        <header className="rep-panel-head">
          <h3>Level Transition History</h3>
          <p>Every recorded change between reputation levels.</p>
        </header>
        {levelHistory.length ? (
          <ol className="rep-timeline">
            {levelHistory.map((entry) => (
              <li key={entry.id}>
                <span className="rep-timeline-dot" style={{ background: (LEVEL_META[entry.toLevel] || meta).color }} />
                <span className="rep-transition">
                  {capitalise(entry.fromLevel || 'blue')} <span className="rep-arrow">→</span> {capitalise(entry.toLevel)}
                </span>
                <time>{formatDate(entry.createdAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rep-empty">No reputation level changes have been recorded for this account yet.</p>
        )}
      </section>

      <p className="rep-privacy">Report descriptions, evidence and moderator-only notes are never shown in this section.</p>
    </div>
  );
}
