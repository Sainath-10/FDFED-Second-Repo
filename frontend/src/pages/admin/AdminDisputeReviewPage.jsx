import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/dispute-review.css';

export default function AdminDisputeReviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(NexusAuth.getSession());
  const compId = searchParams.get('id') || sessionStorage.getItem('last_admin_comp_id') || 'sum-champ-2026';
  
  const [adminNotes, setAdminNotes] = useState('');
  const [disputeStatus, setDisputeStatus] = useState('Under Review');
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (compId) {
      sessionStorage.setItem('last_admin_comp_id', compId);
    }
  }, [compId]);

  const role = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = role.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';

  function handleApprove() {
    setDisputeStatus('Resolved');
    setResolved(true);
    alert('Dispute approved. Match result updated.');
  }

  function handleReject() {
    if (window.confirm('Reject this dispute?')) {
      setDisputeStatus('Rejected');
      setResolved(true);
      alert('Dispute rejected. Original result stands.');
    }
  }

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="disputes">
      <main className="main-content">
        <Link to={`/admin/dashboard`} className="back-btn-alt">
          ← Back to Dashboard
        </Link>
        <h1 className="admin-title-lg">Dispute Review</h1>
        <p className="admin-subtitle-accent">Review and resolve match disputes</p>

        <div className="admin-comp-tabs">
          <Link to={`/admin/competition-detail?id=${encodeURIComponent(compId)}`} className="admin-tab">Overview</Link>
          <Link to={`/admin/manage-teams?id=${encodeURIComponent(compId)}`} className="admin-tab">Manage Teams</Link>
          <Link to={`/admin/manage-matches?id=${encodeURIComponent(compId)}`} className="admin-tab">Manage Matches</Link>
          <Link to={`/admin/match-results?id=${encodeURIComponent(compId)}`} className="admin-tab">Match Results</Link>
          <Link to={`/admin/view-standings?id=${encodeURIComponent(compId)}`} className="admin-tab">Standings</Link>
          <Link to={`/admin/dispute-review?id=${encodeURIComponent(compId)}`} className="admin-tab active">Disputes</Link>
          <Link to={`/admin/edit-competition?id=${encodeURIComponent(compId)}`} className="admin-tab">Edit</Link>
        </div>

        <div className="layout-wrapper">
          <div>
            <div className={`dispute-card ${resolved ? 'dispute-card-resolved' : 'dispute-card-urgent'}`}>
              <div className="dispute-header">
                <span className="dispute-id">#DISP-2026-0041</span>
                <span className={`status-pill ${resolved ? 'approved' : 'pending'}`}>{disputeStatus}</span>
              </div>
              <div className="dispute-title">Match Result Dispute — Group A Match 3</div>
              <div className="dispute-desc">
                Storm Riders alleges that a referee incorrectly recorded the round count. Team claims final score should be 16–11 in their favor, not 14–11 as recorded. Screenshots and demo file submitted as evidence.
              </div>
              <div className="dispute-meta">
                <span>Submitted by: Storm Riders</span>
                <span>Against: Inferno Squad</span>
                <span>Filed: Jul 12, 2026 · 21:03 IST</span>
              </div>

              <div className="evidence-section">
                <div className="evidence-label-sm">Evidence Submitted</div>
                <div className="evidence-btns-row">
                  <button type="button" className="btn-table-secondary" onClick={() => alert('Opening screenshot: screenshot_r16.png')}>📷 screenshot_r16.png</button>
                  <button type="button" className="btn-table-secondary" onClick={() => alert('Opening demo: match_demo.dem')}>🎮 match_demo.dem</button>
                </div>
              </div>

              {!resolved && (
                <>
                  <div className="admin-notes-section">
                    <div className="notes-label-sm">Admin Notes</div>
                    <textarea
                      className="form-textarea notes-textarea-sm"
                      placeholder="Add your review notes here…"
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                    />
                  </div>

                  <div className="dispute-actions dispute-actions-stack">
                    <button type="button" className="btn-table-primary" onClick={handleApprove}>Approve Dispute</button>
                    <button type="button" className="btn-table-danger" onClick={handleReject}>Reject Dispute</button>
                    <button type="button" className="btn-table-secondary" onClick={() => navigate(`/admin/match-results?id=${encodeURIComponent(compId)}`)}>Update Match Result</button>
                    <button type="button" className="btn-table-secondary" onClick={() => alert('Request sent to both teams for more information.')}>Request More Info</button>
                  </div>
                </>
              )}
            </div>

            {/* Resolved history */}
            <div className="resolved-history-section">
              <div className="resolved-label-sm">Resolved Disputes</div>
              <div className="dispute-card dispute-card-resolved">
                <div className="dispute-header">
                  <span className="dispute-id">#DISP-2026-0028</span>
                  <span className="status-pill approved">Resolved</span>
                </div>
                <div className="dispute-title">Server Disconnect — Group C Match 1</div>
                <div className="dispute-desc">Match replayed from Round 8 after server drop. Both teams agreed to resolution.</div>
                <div className="dispute-meta"><span>Resolved: Jun 30, 2026</span></div>
                <div className="dispute-actions">
                  <button type="button" className="btn-table-secondary" onClick={() => alert('Viewing history for DISP-2026-0028...')}>View History</button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar-sticky-stack">
            <div className="comp-sidebar-block">
              <h3>Match Info</h3>
              <div className="info-row"><span className="key">Match</span><span className="val">Group A · Match 3</span></div>
              <div className="info-row"><span className="key">Team A</span><span className="val">Storm Riders</span></div>
              <div className="info-row"><span className="key">Team B</span><span className="val">Inferno Squad</span></div>
              <div className="info-row"><span className="key">Recorded</span><span className="val">14 – 11</span></div>
              <div className="info-row"><span className="key">Claimed</span><span className="val stat-val-accent">16 – 11</span></div>
            </div>
            <div className="comp-sidebar-block">
              <h3>Admin Guidelines</h3>
              <div className="guidelines-stack">
                <p>✅ Review all submitted evidence before making a decision.</p>
                <p>✅ Both teams must be notified of the outcome.</p>
                <p>⚠️ Escalate to Super Admin if the matter is unresolvable.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
