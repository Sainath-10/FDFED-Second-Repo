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

export default function ReportCard({ report, actions = null, detailHref = null }) {
  const priority = PRIORITY_META[report.priority] || PRIORITY_META.medium;
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
          {STATUS_LABEL[report.status] || capitalise(report.status)}
        </span>
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

      <div className="report-actions">
        {actions}
        {detailHref && (
          <Link className="report-btn" to={detailHref}>
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
