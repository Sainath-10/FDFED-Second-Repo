/**
 * NEXUS ESPORTS — Submit Report
 *
 * report form + evidence file
 * list, building the dispute record (stored on the competition and the shared
 * dispute store, with evidence metadata), the API Disputes.create call, and the
 * ended-competition lock.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import NexusAPI from '../services/api.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/submit-report.css';

const REPORT_TYPES = ['Match Result Dispute', 'Cheating / Exploit', 'Late Forfeit / No-show', 'Unsportsmanlike Conduct', 'Technical Issue', 'Other'];
const COMPETITIONS = ['World Championship 2026', 'Pro League Season 5', 'Regional Cup 2026'];

export default function SubmitReport() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const compIdParam = params.get('compId');

  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [competition, setCompetition] = useState(COMPETITIONS[0]);
  const [matchRound, setMatchRound] = useState('');
  const [against, setAgainst] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!compIdParam || !NexusData) return;
    const comp = NexusData.getCompetitionById(compIdParam);
    if (comp && NexusData.isCompEnded && NexusData.isCompEnded(comp)) {
      NexusData.enforceNotEnded(comp, '#report-form button[type="submit"],.btn-primary,.btn-submit');
      setEnded(true);
    }
    return () => {
      const b = document.getElementById('_ended_banner_');
      if (b) b.remove();
      document.body.style.marginTop = '';
    };
  }, [compIdParam]);

  function submit(event) {
    event.preventDefault();
    const disputeId = `DISP-${Date.now().toString().slice(-8)}`;
    const typeText = String(reportType || '').toLowerCase();
    const targetType = typeText.includes('organizer') ? 'organizer' : (typeText.includes('rule') ? 'match_rule' : 'opponent_team');
    const isAdminTarget = targetType === 'organizer';

    const reporter = (session && session.username) || 'Player';
    const role = String((session && session.role) || '').toLowerCase();
    const isOrg = role === 'organizer' || role === 'admin' || role === 'super-admin' || role === 'super_admin';

    let compId = compIdParam;
    let comp = compId && NexusData ? NexusData.getCompetitionById(compId) : null;
    if (!comp && NexusData) {
      const all = NexusData.loadCompetitions();
      comp = all.find((c) => c.name.toLowerCase().includes(competition.toLowerCase())) || all[0];
      if (comp) compId = comp.id;
    }

    const organizers = NexusData && typeof NexusData.getCompetitionOrganizers === 'function' && comp
      ? NexusData.getCompetitionOrganizers(comp)
      : (comp && Array.isArray(comp.organizers) && comp.organizers.length > 0
        ? comp.organizers
        : (comp && comp.createdBy ? [comp.createdBy] : ['organizer']));

    const newDisputeObj = {
      id: disputeId,
      cardId: `disp-${Date.now()}`,
      title: `${reportType} — ${against}`,
      desc: description,
      detail: description,
      description,
      reason: reportType,
      round: matchRound,
      submitter: reporter,
      reporter,
      reportedBy: reporter,
      filedBy: reporter,
      against,
      targetType,
      targetUserOrTeam: against,
      organizers,
      time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      filedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      matchName: comp ? comp.name : competition,
      competition: comp ? comp.name : competition,
      competitionId: compId || '1',
      compId: compId || '1',
      status: isAdminTarget ? 'open_admin' : 'open_organizer',
      escalated: false,
      superAdminState: '',
      escalationReason: '',
      organizerWarnings: 0,
      evidenceUrls: [],
      evidence: files.length,
    };

    const evidence = files.map((f) => ({ name: f.name, size: f.size, type: f.type, isImage: f.type.startsWith('image/'), dataUrl: null }));

    const imagePromises = evidence.map((ev, i) => {
      if (!ev.isImage) return Promise.resolve();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => { evidence[i].dataUrl = e.target.result; resolve(); };
        reader.readAsDataURL(files[i]);
      });
    });

    Promise.all(imagePromises).then(() => {
      try {
        const existing = JSON.parse(localStorage.getItem('nexus.disputes.evidence') || '{}');
        existing[disputeId] = { files: evidence, submittedAt: new Date().toISOString() };
        localStorage.setItem('nexus.disputes.evidence', JSON.stringify(existing));

        if (comp && NexusData) {
          if (!Array.isArray(comp.disputes)) comp.disputes = [];
          comp.disputes.unshift(newDisputeObj);
          NexusData.updateCompetition(comp);
        }
        const disputes = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
        disputes.unshift(newDisputeObj);
        localStorage.setItem('nexus.disputes', JSON.stringify(disputes));
      } catch (err) { /* ignore */ }

      if (NexusAPI && NexusAPI.Disputes) {
        const reason = `${reportType} (${matchRound}): ${description || 'No additional details provided.'}`;
        NexusAPI.Disputes.create({ competitionId: compId || '1', teamId: against || 'team-1', targetType, targetUserOrTeam: against || 'Opponent', reason, evidenceUrls: [] }).catch(() => {});
      }

      showToast('Dispute submitted', 'success');
      setTimeout(() => navigate('/pages/my-activity.html'), 1500);
    });
  }

  function onFiles(event) {
    setFiles(Array.from(event.target.files || []));
  }

  return (
    <main className="main-content">
      <Link to="/pages/my-activity.html" className="back-btn-alt">← Back</Link>
      <h1 className="page-title">Submit Report</h1>
      <p className="page-subtitle">Report a match issue, cheating, or rule violation.</p>

      <div className="layout-wrapper">
        <div className="form-card">
          <form id="report-form" className="form-stack" onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Report Type</label>
              <select className="form-select" value={reportType} onChange={(e) => setReportType(e.target.value)} disabled={ended}>
                {REPORT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label">Competition</label>
                <select className="form-select" value={competition} onChange={(e) => setCompetition(e.target.value)} disabled={ended}>
                  {COMPETITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Match / Round</label>
                <input className="form-input" type="text" placeholder="e.g. QF Match 1, Round 18" value={matchRound} onChange={(e) => setMatchRound(e.target.value)} disabled={ended} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reporting Against (Team/Player)</label>
              <input className="form-input" type="text" placeholder="Team name or player username" value={against} onChange={(e) => setAgainst(e.target.value)} disabled={ended} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea form-textarea-lg" placeholder="Describe the issue in detail. Include timestamps, round numbers, and any relevant context. The more detail, the faster admins can act." required value={description} onChange={(e) => setDescription(e.target.value)} disabled={ended} />
            </div>
            <div className="form-group">
              <label className="form-label">Evidence</label>
              <div className="evidence-upload" onClick={() => document.getElementById('evidence-files')?.click()}>
                <div className="upload-icon">📎</div>
                <div className="upload-text-wrapper">
                  <span className="upload-accent">Upload evidence</span> — screenshots, video clips, demo files<br />
                  <span className="upload-note">Max 100MB per file · PNG, JPG, MP4, DEM accepted</span>
                </div>
                <input type="file" id="evidence-files" multiple accept="image/*,video/*,.dem" style={{ display: 'none' }} onChange={onFiles} disabled={ended} />
              </div>
              <div id="file-list" className="file-list-stack">
                {files.map((f) => {
                  const isImage = f.type.startsWith('image/');
                  const ext = f.name.split('.').pop().toUpperCase();
                  return (
                    <div className="file-item" key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {isImage ? (
                        <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 48, height: 36, background: 'rgba(198,255,51,0.08)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{ext}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(f.size / 1024).toFixed(0)} KB{isImage ? ' · Image' : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="submit" className="btn-primary form-submit-btn" disabled={ended}>Submit Report</button>
          </form>
        </div>

        <div className="sidebar-stack">
          <div className="comp-sidebar-block">
            <h3>Report Guidelines</h3>
            <div className="guidelines-stack">
              <p>✅ Reports are sent directly to the Tournament Organizer &amp; Co-Organizers.</p>
              <p>✅ Provide timestamped evidence where possible.</p>
              <p>✅ Organizers typically review and resolve within 12–24 hours.</p>
              <p>⚡ If unresolved, dispute can be escalated to Super Admin.</p>
              <p>❌ False reports may result in penalties.</p>
            </div>
          </div>
          <div className="comp-sidebar-block">
            <h3>My Recent Reports</h3>
            <div className="empty-state-text">No recent reports on file.</div>
          </div>
        </div>
      </div>
    </main>
  );
}


