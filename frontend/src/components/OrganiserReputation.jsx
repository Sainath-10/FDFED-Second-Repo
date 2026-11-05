/**
 * NEXUS ESPORTS — organiser reputation (self-fetching)
 * Rendered in competition information so the organiser's level is visible
 * wherever the competition is shown.
 */
import { useEffect, useState } from 'react';
import { LocalReputationAPI as ReputationAPI } from '../services/local/reporting.js';
import ReputationBadge from './ReputationBadge.jsx';

export default function OrganiserReputation({ username, showLimit = true }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!username) return () => { alive = false; };
    ReputationAPI.profile(username)
      .then((res) => { if (alive && res.ok && res.data) setProfile(res.data); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [username]);

  if (!profile) return null;
  return <ReputationBadge level={profile.level} limit={profile.limit} showLimit={showLimit} />;
}
