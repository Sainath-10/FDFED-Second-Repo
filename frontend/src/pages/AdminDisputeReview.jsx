/**
 * NEXUS ESPORTS — Admin Dispute Review
 *
 *
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import '../styles/pages/admin/dispute-review.css';

export default function AdminDisputeReview() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  return (
    <main className="main-content">
      <Link to="/pages/admin/dashboard.html" className="back-btn-alt">← Summer Championship 2026</Link>
      <h1 className="admin-title-lg">Dispute Review</h1>
      <p className="admin-subtitle-accent">Review and resolve match disputes</p>

      <div className="admin-comp-tabs">
        <Link to="/pages/admin/competition-detail.html" className="admin-tab">Overview</Link>
        <Link to="/pages/admin/manage-teams.html" className="admin-tab">Manage Teams</Link>
        <Link to="/pages/admin/manage-matches.html" className="admin-tab">Manage Matches</Link>
        <Link to="/pages/admin/match-results.html" className="admin-tab">Match Results</Link>
        <Link to="/pages/admin/view-standings.html" className="admin-tab">Standings</Link>
        <Link to="/pages/admin/dispute-review.html" className="admin-tab active">Disputes</Link>
        <Link to="/pages/admin/edit-competition.html" className="admin-tab">Edit</Link>
      </div>

      <div className="layout-wrapper">
        <div>
          <div className="dispute-card dispute-card-urgent">
            <div className="dispute-header"><span className="dispute-id">#DISP-2026-0041</span><span className="status-pill pending">Under Review</span></div>
            <div className="dispute-title">Match Result Dispute — Group A Match 3</div>
            <div className="dispute-desc">Storm Riders alleges that a referee incorrectly recorded the round count. Team claims final score should be 16–11 in their favor, not 14–11 as recorded. Screenshots and demo file submitted as evidence.</div>
            <div className="dispute-meta"><span>Submitted by: Storm Riders</span><span>Against: Inferno Squad</span><span>Filed: Jul 12, 2026 · 21:03 IST</span></div>

            <div className="evidence-section">
              <div className="evidence-label-sm">Evidence Submitted</div>
              <div className="evidence-btns-row">
                <button className="btn-table-secondary" onClick={() => showToast('Opening screenshot...')}>📷 screenshot_r16.png</button>
                <button className="btn-table-secondary" onClick={() => showToast('Opening demo...')}>🎮 match_demo.dem</button>
              </div>
            </div>

            <div className="admin-notes-section">
              <div className="notes-label-sm">Admin Notes</div>
              <textarea className="form-textarea notes-textarea-sm" placeholder="Add your review notes here…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="dispute-actions dispute-actions-stack">
              <button className="btn-table-primary" onClick={() => showToast('Dispute approved. Match result updated.')}>Approve Dispute</button>
              <button className="btn-table-danger" onClick={() => { if (window.confirm('Reject this dispute?')) showToast('Dispute rejected. Original result stands.', 'error'); }}>Reject Dispute</button>
              <button className="btn-table-secondary" onClick={() => navigate('/pages/admin/match-results.html')}>Update Match Result</button>
              <button className="btn-table-secondary" onClick={() => showToast('Request sent to both teams for more information.')}>Request More Info</button>
            </div>
          </div>

          <div className="resolved-history-section">
            <div className="resolved-label-sm">Resolved Disputes</div>
            <div className="dispute-card dispute-card-resolved">
              <div className="dispute-header"><span className="dispute-id">#DISP-2026-0028</span><span className="status-pill approved">Resolved</span></div>
              <div className="dispute-title">Server Disconnect — Group C Match 1</div>
              <div className="dispute-desc">Match replayed from Round 8 after server drop. Both teams agreed to resolution.</div>
              <div className="dispute-meta"><span>Resolved: Jun 30, 2026</span></div>
              <div className="dispute-actions"><button className="btn-table-secondary" onClick={() => showToast('Viewing history...')}>View History</button></div>
            </div>
          </div>
        </div>

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
  );
}


