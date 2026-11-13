/**
 * NEXUS ESPORTS — Dispute review
 *
 * One dispute from the backend (?id=…) with the staff actions.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DisputesAPI } from '../../services/api.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/ui.jsx';
import { StaffDisputeCard } from './AdminDisputes.jsx';

export default function AdminDisputeReview() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const [dispute, setDispute] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) { setError('Open a dispute from the disputes console.'); return; }
    const res = await DisputesAPI.getById(id);
    if (res.ok) { setDispute(res.data); setError(''); } else setError(res.error || 'That dispute could not be loaded.');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  return (
    <main className="main-content">
      <Link to="/pages/admin/disputes.html" className="back-btn-alt">← Back to disputes</Link>
      <PageHeader title="Dispute review" />
      {error && <ErrorState message={error} onRetry={id ? load : undefined} />}
      {!error && !dispute && <LoadingState label="Loading dispute…" />}
      {dispute && <StaffDisputeCard dispute={dispute} onChanged={load} showLink={false} />}
    </main>
  );
}
