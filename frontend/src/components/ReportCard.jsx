/**
 * NEXUS ESPORTS — report card
 * Shared presentation for the organiser and Community Moderator queues.
 */
import { Link } from 'react-router-dom';
import {
  PRIORITY_META,
  STATUS_LABEL,
  capitalise,
  formatDate,
  reportCode,
} from '../lib/reporting.js';

const DECISION_STATUS = {
  active: { label: 'Active', color: '#86efac' },
  uplifted: { label: 'Uplifted', color: '#fb923c' },
  reverted: { label: 'Uplifted', color: '#fb923c' },
  superseded: { label: 'Superseded', color: '#94a3b8' },
};

export default function ReportCard({ report, actions = null, detailHref = null, direction = null, statusLabel = null }) {
  const priority = PRIORITY_META[report.priority] || PRIORITY_META.medium;
  // Every decision version is kept; the organiser and the moderator both see
  // the original decision, an uplift reason and any corrected decision.
  const history = Array.isArray(report.decisionHistory) ? report.decisionHistory : [];
  return (
    <article className="report-card">
      <div className="report-card-top">
        <span className="report-code">{reportCode(report)}</span>
        <span
          className="report-pill"
          style={{ color: priority.color, background: priority.bg, border: `1px solid ${priority.border}` }}
        >
          {priority.label}
        </span>
        <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>
          {capitalise(report.reasonCode)}
        </span>
        <span className="report-pill" style={{ color: '#cbd5e1', border: '1px solid #334155' }}>
          {statusLabel || STATUS_LABEL[report.status] || capitalise(report.status)}
        </span>
        {direction && (
          <span
            className="report-pill"
            style={direction === 'filed-against'
              ? { color: '#fb923c', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)' }
              : { color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.4)' }}
          >
            {direction === 'filed-against' ? 'Filed against you' : 'Filed by you'}
          </span>
        )}
      </div>

      <p className="report-people">
        @{report.reporterUsername} → @{report.reportedUsername}
        {report.reportedRole && (
          <span style={{ color: '#94a3b8', fontWeight: 500 }}> · {capitalise(report.reportedRole)}</span>
        )}
      </p>

      <div className="report-meta">
        {report.competitionName && <span>🏆 {report.competitionName}</span>}
        <span>🕒 {formatDate(report.createdAt)}</span>
        <span>Filed by: {report.reporterPriorSubstantiated ?? 0} prior substantiated</span>
        <span>Accused: {report.accusedPriorSubstantiated ?? 0} prior substantiated</span>
      </div>

      <p className="report-desc">{report.description}</p>

      {history.length > 0 && (
        <details className="report-history">
          <summary>Decision history ({history.length})</summary>
          {history.map((decision) => {
            const meta = DECISION_STATUS[decision.status] || DECISION_STATUS.superseded;
            return (
              <div className="report-history-row" key={decision.version}>
                <span className="report-history-version">v{decision.version}</span>
                <span>{capitalise(decision.finding)} · {capitalise(decision.action)}</span>
                <span className="report-pill" style={{ color: meta.color, border: `1px solid ${meta.color}55` }}>{meta.label}</span>
                <span>@{decision.decidedBy || 'system'}</span>
                <span>{formatDate(decision.decidedAt)}</span>
                {decision.upliftReason && <span className="report-history-note">Uplifted: {decision.upliftReason}</span>}
              </div>
            );
          })}
        </details>
      )}

      <div className="report-actions">
        {actions}
        {detailHref && (
          <Link className="report-btn report-detail-link" to={detailHref}>
            Open details
          </Link>
        )}
        {report.status === 'resolved' && report.finding && (
          <span className="report-pill" style={{ color: '#86efac', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)' }}>
            {capitalise(report.finding)} · {capitalise(report.action)}
          </span>
        )}
        {report.status === 'discarded' && report.discardReason && (
          <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>
            Discarded: {capitalise(report.discardReason)}
          </span>
        )}
      </div>
    </article>
  );
}
