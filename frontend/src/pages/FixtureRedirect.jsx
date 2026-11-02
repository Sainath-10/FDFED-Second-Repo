import { Navigate, useLocation, useSearchParams } from 'react-router-dom';

// Preserve old bookmarks while keeping one fixture workflow.
export default function FixtureRedirect() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const next = new URLSearchParams(params);
  const tab = pathname.includes('standings') ? 'standings' : pathname.includes('organizers') ? 'organizers' : pathname.includes('dispute') ? 'disputes' : 'fixtures';
  next.set('tab', tab);
  return <Navigate replace to={`/pages/competition-detail.html?${next}`} />;
}
