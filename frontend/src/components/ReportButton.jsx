/**
 * NEXUS ESPORTS — Report button
 *
 * Small inline action placed beside eligible player / team-leader /
 * organiser names. It links to the context-aware report form; the backend is
 * still the authority for eligibility and the three-discard restriction.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LocalReportsAPI as ReportsAPI } from '../services/local/reporting.js';
import { subscribe } from '../services/local/storage.js';

export function reportHref({ compId, against, targetRole = 'player', matchId, teamId, source = 'page' }) {
  const params = new URLSearchParams();
  if (compId) params.set('compId', compId);
  if (against) params.set('against', against);
  if (targetRole) params.set('role', targetRole);
  if (matchId) params.set('matchId', matchId);
  if (teamId) params.set('teamId', teamId);
  if (source) params.set('source', source);
  return `/pages/report.html?${params.toString()}`;
}

export default function ReportButton({
  compId,
  against,
  targetRole = 'player',
  matchId,
  teamId,
  source,
  label = 'Report',
  className = 'report-btn',
}) {
  const [restricted, setRestricted] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!compId) {
      setChecking(false);
      return () => { alive = false; };
    }
    const check = () => {
      ReportsAPI.restrictions(compId)
        .then((res) => {
          if (!alive) return;
          if (res?.ok && res.data) setRestricted(!!res.data.restricted);
        })
        .catch(() => undefined)
        .finally(() => { if (alive) setChecking(false); });
    };
    check();
    const unsubscribe = subscribe(check);
    return () => { alive = false; unsubscribe(); };
  }, [compId]);

  if (restricted) {
    return (
      <span
        className="report-btn ghost"
        title="You reached the limit of 3 baseless reports in this competition."
        style={{ opacity: 0.5, cursor: 'not-allowed' }}
      >
        Reporting locked
      </span>
    );
  }

  return (
    <Link
      className={className}
      to={reportHref({ compId, against, targetRole, matchId, teamId, source })}
      title={checking ? 'Checking reporting eligibility…' : `Report @${against}`}
    >
      {label}
    </Link>
  );
}
