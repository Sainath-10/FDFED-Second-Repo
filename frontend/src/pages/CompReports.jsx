/**
 * NEXUS ESPORTS — Reports & Disputes
 *
 * the report form (competition
 * prefilled), building the dispute record and persisting it to the shared dispute
 * store, then redirecting back to comp-info.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/comp-participant.css';

const REPORT_TYPES = [
  { value: '', label: 'Select type' },
  { value: 'score', label: 'Incorrect Score Submission' },
  { value: 'cheating', label: 'Cheating / Hacking' },
  { value: 'disconnect', label: 'Server Disconnect' },
  { value: 'conduct', label: 'Unsportsmanlike Conduct' },
  { value: 'other', label: 'Other' },
];

export default function CompReports() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const compId = params.get('id') || null;
  const comp = (compId && NexusData) ? (NexusData.getCompetitionById(compId) || {}) : {};

  const [type, setType] = useState('');
  const [desc, setDesc] = useState('');
  const [against, setAgainst] = useState('');

  function submit() {
    if (!type || !desc.trim() || !against.trim()) {
      showToast('Please fill in all mandatory fields (Type, Description, UserName).', 'error');
      return;
    }

    const reporterName = (session && (session.displayName || session.username)) || 'Guest User';
    const userRole = String((session && session.role) || '').toLowerCase();
    const isOrg = !!(session && (userRole === 'organizer' || userRole === 'admin' || userRole === 'super-admin' || (comp && comp.createdBy === session.username)));

    const compName = comp.name || 'Competition';
    const normalizedAgainst = against.toLowerCase();
    const isTeamTarget = Array.isArray(comp.teams) && comp.teams.some((team) => {
      const teamName = String(team.name || '').toLowerCase();
      const teamId = String(team.id || '').toLowerCase();
      return teamName === normalizedAgainst || teamId === normalizedAgainst;
    });
    const targetType = isTeamTarget ? 'opponent_team' : 'player';
    const timestamp = `${new Date().toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} IST`;

    const newDispute = {
      id: `DISP-${Date.now()}`,
      cardId: `disp-${Date.now()}`,
      disputeId: `#DISP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      competition: compName,
      title: `${type.charAt(0).toUpperCase()}${type.slice(1)} Dispute — ${compName}`,
      reason: `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      description: desc,
      reportedBy: reporterName,
      filedBy: reporterName,
      against,
      targetType,
      targetUserOrTeam: against,
      filedAt: timestamp,
      createdAt: new Date().toISOString(),
      status: isTeamTarget ? 'open_organizer' : (isOrg ? 'escalated_to_admin' : 'open_organizer'),
      escalated: !isTeamTarget && isOrg,
      superAdminState: !isTeamTarget && isOrg ? 'pending' : '',
      escalationReason: '',
      organizerWarnings: 0,
      compId: compId,
      competitionId: compId,
      type,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (NexusData && typeof NexusData.addDispute === 'function') {
        const result = NexusData.addDispute(newDispute);
        if (result && result.ok === false) { showToast(result.error || 'Dispute blocked.', 'error'); return; }
      } else {
        const existing = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
        existing.unshift(newDispute);
        localStorage.setItem('nexus.disputes', JSON.stringify(existing));
      }
    } catch (e) {
      console.error('Failed to save dispute:', e);
    }

    showToast('Dispute submitted', 'success');
    setTimeout(() => navigate(`/pages/comp-info.html?id=${compId || ''}`), 1500);
  }

  return (
    <main className="part-main">
      <div className="sub-page-header-plain">
        <div>
          <h1 className="part-subpage-title">Reports &amp; Disputes</h1>
          <p className="part-subpage-subtitle">Submit a report related to this competition. Fields marked with <span style={{ color: 'var(--accent)' }}>*</span> are mandatory.</p>
        </div>
        <Link className="btn-back-plain" id="btn-back" to={`/pages/comp-info.html?id=${compId || ''}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
          Back
        </Link>
      </div>

      <div className="part-section">
        <div className="part-panel-header" style={{ marginBottom: 8 }}>
          <div className="part-panel-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <span>Submit a Report</span>
          </div>
        </div>

        <div className="report-form-grid">
          <div className="report-form-row-2">
            <div className="report-form-group">
              <label className="report-label">COMPETITION</label>
              <input type="text" className="report-input" id="report-match" readOnly value={comp.name || 'Competition'} style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed', borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="report-form-group">
              <label className="report-label">REPORT TYPE <span style={{ color: 'var(--accent)' }}>*</span></label>
              <select className="report-select" id="report-type" value={type} onChange={(e) => setType(e.target.value)}>
                {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="report-form-group">
            <label className="report-label">REPORT DESCRIPTION <span style={{ color: 'var(--accent)' }}>*</span></label>
            <textarea className="report-textarea" id="report-desc" rows="4" placeholder="Describe the issue in detail..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>

          <div className="report-form-row-2">
            <div className="report-form-group">
              <label className="report-label">UserName <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input type="text" className="report-input" id="report-userid" placeholder="Enter username to report" value={against} onChange={(e) => setAgainst(e.target.value)} />
            </div>
            <div className="report-form-group">
              <label className="report-label">EVIDENCE UPLOAD <span className="report-optional">(OPTIONAL)</span></label>
              <button className="report-upload-btn" onClick={() => document.getElementById('report-evidence')?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
                Upload screenshots or clips
              </button>
              <input type="file" id="report-evidence" accept="image/*,video/*" style={{ display: 'none' }} multiple />
            </div>
          </div>

          <div>
            <button className="report-submit-btn" id="btn-submit-report" onClick={submit}>Submit Report</button>
          </div>
        </div>
      </div>
    </main>
  );
}


