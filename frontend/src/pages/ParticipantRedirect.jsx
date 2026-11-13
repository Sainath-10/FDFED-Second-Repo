import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Old participant-view links now open the player's team page, which resolves
 * the viewer's own team in the competition from the backend.
 */
export default function ParticipantRedirect() {
  const [params] = useSearchParams();
  const compId = params.get('id') || params.get('compId');
  return <Navigate replace to={compId ? `/pages/team/team-roster.html?compId=${encodeURIComponent(compId)}` : '/pages/my-activity.html'} />;
}

/** The old per-competition report form now opens the shared dispute form. */
export function DisputeFormRedirect() {
  const [params] = useSearchParams();
  const compId = params.get('id') || params.get('compId');
  return <Navigate replace to={compId ? `/pages/submit-report.html?compId=${encodeURIComponent(compId)}` : '/pages/submit-report.html'} />;
}

/** The admin competition page and the organizer competition center are one page. */
export function CompetitionCenterRedirect() {
  const [params] = useSearchParams();
  const id = params.get('id');
  return <Navigate replace to={id ? `/pages/competition-detail.html?id=${encodeURIComponent(id)}` : '/pages/admin/dashboard.html'} />;
}
