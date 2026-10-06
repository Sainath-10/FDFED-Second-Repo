import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusData } from '../services/competitionService';
import { NexusAPI } from '../services/api';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/submit-report.css';

export default function SubmitReportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const urlCompId = searchParams.get('compId') || searchParams.get('id');

  const [competitions, setCompetitions] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [reportType, setReportType] = useState('Match Result Dispute');
  const [matchRound, setMatchRound] = useState('');
  const [reportingAgainst, setReportingAgainst] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const all = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    setCompetitions(all);

    let current = null;
    if (urlCompId) {
      current = all.find(c => c.id === urlCompId);
      if (current) setSelectedCompId(current.id);
    } else if (all.length > 0) {
      current = all[0];
      setSelectedCompId(all[0].id);
    }

    if (current && NexusData.isCompEnded && NexusData.isCompEnded(current)) {
      setIsEnded(true);
      showToast('This competition has ended. Reports can no longer be submitted.', 'warning');
    }
  }, [urlCompId]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);

    const previews = [];
    selectedFiles.forEach(f => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => {
          previews.push({ name: f.name, size: f.size, isImage: true, dataUrl: ev.target.result });
          if (previews.length === selectedFiles.length) {
            setFilePreviews([...previews]);
          }
        };
        reader.readAsDataURL(f);
      } else {
        const ext = f.name.split('.').pop().toUpperCase();
        previews.push({ name: f.name, size: f.size, isImage: false, ext });
        if (previews.length === selectedFiles.length) {
          setFilePreviews([...previews]);
        }
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEnded) {
      showToast('Competition has ended. Reports cannot be submitted.', 'error');
      return;
    }

    if (description.trim().length < 10) {
      showToast('Please provide a description of at least 10 characters.', 'error');
      return;
    }

    const disputeId = 'DISP-' + Date.now().toString().slice(-8);
    const typeText = String(reportType || '').toLowerCase();
    const targetType = typeText.includes('organizer')
      ? 'organizer'
      : (typeText.includes('rule') ? 'match_rule' : 'opponent_team');
    const isAdminTarget = targetType === 'organizer';

    let reporter = 'Player';
    try {
      const sess = JSON.parse(localStorage.getItem('nexus.auth.session') || '{}');
      if (sess.username) reporter = sess.username;
    } catch (err) {}

    const comp = competitions.find(c => c.id === selectedCompId) || (competitions.length > 0 ? competitions[0] : null);
    const organizers = comp && Array.isArray(comp.organizers) && comp.organizers.length > 0
      ? comp.organizers
      : (comp && comp.createdBy ? [comp.createdBy] : ['organizer']);

    const newDisputeObj = {
      id: disputeId,
      cardId: 'disp-' + Date.now(),
      title: `${reportType} — ${reportingAgainst || 'Opponent'}`,
      desc: description.trim(),
      detail: description.trim(),
      description: description.trim(),
      reason: reportType,
      round: matchRound || 'Match',
      submitter: reporter,
      reporter,
      reportedBy: reporter,
      filedBy: reporter,
      against: reportingAgainst || 'Opponent',
      targetType,
      targetUserOrTeam: reportingAgainst || 'Opponent',
      organizers,
      time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      filedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      matchName: comp ? comp.name : 'Competition',
      competition: comp ? comp.name : 'Competition',
      competitionId: comp ? comp.id : (selectedCompId || '1'),
      compId: comp ? comp.id : (selectedCompId || '1'),
      status: isAdminTarget ? 'open_admin' : 'open_organizer',
      escalated: false,
      superAdminState: '',
      escalationReason: '',
      organizerWarnings: 0,
      evidenceUrls: [],
      evidence: files.length
    };

    try {
      const existingEv = JSON.parse(localStorage.getItem('nexus.disputes.evidence') || '{}');
      existingEv[disputeId] = {
        files: filePreviews.map(p => ({ name: p.name, size: p.size, isImage: p.isImage, dataUrl: p.dataUrl || null })),
        submittedAt: new Date().toISOString()
      };
      localStorage.setItem('nexus.disputes.evidence', JSON.stringify(existingEv));

      if (comp && NexusData.updateCompetition) {
        if (!Array.isArray(comp.disputes)) comp.disputes = [];
        comp.disputes.unshift(newDisputeObj);
        NexusData.updateCompetition(comp);
      }

      const disputes = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
      disputes.unshift(newDisputeObj);
      localStorage.setItem('nexus.disputes', JSON.stringify(disputes));
    } catch (err) {}

    if (NexusAPI && NexusAPI.Disputes) {
      NexusAPI.Disputes.create({
        competitionId: comp ? comp.id : '1',
        teamId: reportingAgainst || 'team-1',
        targetType,
        targetUserOrTeam: reportingAgainst || 'Opponent',
        reason: `${reportType} (${matchRound || 'Match'}): ${description.trim()}`,
        evidenceUrls: []
      }).catch(() => {});
    }

    showToast('Dispute submitted successfully', 'success');
    setTimeout(() => {
      navigate('/my-activity');
    }, 1200);
  };

  return (
    <Shell activeTab="activity">
      <main className="main-content">
          <Link to="/my-activity" className="back-btn-alt">
            ← Back
          </Link>
          <h1 className="page-title">Submit Report</h1>
          <p className="page-subtitle">Report a match issue, cheating, or rule violation.</p>

          <div className="layout-wrapper">
            <div className="form-card">
              <form id="report-form" className="form-stack" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Report Type</label>
                  <select
                    className="form-select"
                    value={reportType}
                    disabled={isEnded}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option>Match Result Dispute</option>
                    <option>Cheating / Exploit</option>
                    <option>Late Forfeit / No-show</option>
                    <option>Unsportsmanlike Conduct</option>
                    <option>Technical Issue</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="form-grid-2col">
                  <div className="form-group">
                    <label className="form-label">Competition</label>
                    <select
                      className="form-select"
                      value={selectedCompId}
                      disabled={isEnded}
                      onChange={(e) => setSelectedCompId(e.target.value)}
                    >
                      {competitions.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Match / Round</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. QF Match 1, Round 18"
                      value={matchRound}
                      disabled={isEnded}
                      onChange={(e) => setMatchRound(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reporting Against (Team/Player)</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Team name or player username"
                    value={reportingAgainst}
                    disabled={isEnded}
                    onChange={(e) => setReportingAgainst(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea form-textarea-lg"
                    placeholder="Describe the issue in detail. Include timestamps, round numbers, and any relevant context. The more detail, the faster admins can act."
                    value={description}
                    disabled={isEnded}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Evidence</label>
                  <label
                    className="evidence-upload"
                    style={{ cursor: isEnded ? 'not-allowed' : 'pointer' }}
                  >
                    <div className="upload-icon">📎</div>
                    <div className="upload-text-wrapper">
                      <span className="upload-accent">Upload evidence</span> — screenshots, video clips, demo files<br />
                      <span className="upload-note">Max 100MB per file · PNG, JPG, MP4, DEM accepted</span>
                    </div>
                    <input
                      type="file"
                      id="evidence-files"
                      multiple
                      accept="image/*,video/*,.dem"
                      style={{ display: 'none' }}
                      disabled={isEnded}
                      onChange={handleFileChange}
                    />
                  </label>
                  <div id="file-list" className="file-list-stack">
                    {filePreviews.map((f, idx) => (
                      <div
                        key={idx}
                        className="file-item"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        {f.isImage ? (
                          <img
                            src={f.dataUrl}
                            alt={f.name}
                            style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '48px',
                              height: '36px',
                              background: 'rgba(198,255,51,0.08)',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              color: 'var(--accent)',
                              fontWeight: 700,
                              flexShrink: 0
                            }}
                          >
                            {f.ext || 'FILE'}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {f.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {(f.size / 1024).toFixed(0)} KB {f.isImage ? '· Image' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary form-submit-btn"
                  disabled={isEnded}
                  style={isEnded ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                >
                  Submit Report
                </button>
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
    </Shell>
  );
}
