/**
 * NEXUS ESPORTS — Create Team
 *
 * the team
 * name/tag inputs, logo picker (the avatar stored on the team is the logo SVG
 * markup, exactly as the `innerHTML`), the invite link (built from the
 * active team context), copy-to-clipboard, the per-team checkout modal, and the
 * 1.5s redirect to my-activity on success.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/create-team.css';

const LOGOS = [
  { id: 'shield', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' },
  { id: 'trophy', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>' },
  { id: 'gamepad', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4"></path><path d="M8 10v4"></path><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line></svg>' },
  { id: 'bolt', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>' },
  { id: 'star', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' },
  { id: 'diamond', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 12L2 9z"></path><path d="M11 3 8 9l3 12"></path><path d="M13 3l3 6-3 12"></path><path d="M2.2 9h19.6"></path></svg>' },
];

const UPLOAD_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';

export default function CreateTeam() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [activeLogo, setActiveLogo] = useState('shield');
  const [checkout, setCheckout] = useState(null); // { comp, teamName, feeAmount }

  function getCompIdFromPage() {
    const fromQuery = params.get('id') || params.get('compId');
    if (fromQuery) return fromQuery;
    if (NexusTeamWorkflow && typeof NexusTeamWorkflow.getActiveTeamContext === 'function') {
      const context = NexusTeamWorkflow.getActiveTeamContext();
      if (context && context.compId) return context.compId;
    }
    return null;
  }

  function buildInviteLink(compId, teamId) {
    const base = window.location.href.split('?')[0].replace('create-team.html', 'join-teams.html');
    const p = new URLSearchParams();
    if (compId) p.set('id', compId);
    if (teamId) p.set('teamId', teamId);
    const query = p.toString();
    return query ? `${base}?${query}` : base;
  }

  const context = NexusTeamWorkflow && typeof NexusTeamWorkflow.getActiveTeamContext === 'function'
    ? NexusTeamWorkflow.getActiveTeamContext()
    : null;
  const [inviteLink, setInviteLink] = useState(() => buildInviteLink(getCompIdFromPage(), context && context.teamId ? context.teamId : ''));

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink).then(() => showToast('Invite link copied to clipboard!'));
  }

  function proceedCreateTeam(compId, teamName, teamTag, logoSvg) {
    const result = NexusTeamWorkflow.createTeam({ compId, name: teamName, tag: teamTag, avatar: logoSvg });
    if (!result.ok) { showToast(result.error || 'Failed to create team.', 'error'); return; }
    showToast(`Team "${teamName}" registered successfully!`);
    if (result.team && result.team.id) setInviteLink(buildInviteLink(compId, result.team.id));
    setTimeout(() => navigate('/pages/my-activity.html'), 1500);
  }

  function createTeam() {
    const compId = getCompIdFromPage();
    if (!compId) { showToast('Tournament context missing. Open this from a competition page.', 'error'); return; }
    const teamName = name.trim();
    const teamTag = tag.trim();
    if (!teamName || !teamTag) { showToast('Please fill in both Team Name and Team Tag!', 'error'); return; }

    const logoSvg = (LOGOS.find((l) => l.id === activeLogo) || LOGOS[0]).svg;

    if (!NexusTeamWorkflow || typeof NexusTeamWorkflow.createTeam !== 'function') {
      showToast('Team service is unavailable.', 'error');
      return;
    }

    const comp = NexusData ? NexusData.getCompetitionById(compId) : null;
    const entryFeeAmount = comp ? (comp.entryFeeAmount || 0) : 0;
    const feeType = comp ? (comp.feeType || 'free') : 'free';

    if (comp && feeType === 'per_team' && entryFeeAmount > 0) {
      setCheckout({ comp, teamName, feeAmount: entryFeeAmount });
    } else {
      proceedCreateTeam(compId, teamName, teamTag, logoSvg);
    }
  }

  return (
    <main className="create-team-page">
      <Link to="/pages/competitions.html" className="back-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 8H4M4 8L8 12M4 8L8 4" />
        </svg>
        Back to Competitions
      </Link>

      <div className="header-center">
        <h1 className="page-title-neon">Create Your Team</h1>
        <p className="page-subtitle-alt">Build your squad and dominate the tournament.</p>
      </div>

      <div className="create-team-container">
        <div className="design-card">
          <label className="design-label">Team Name</label>
          <div className="design-input-wrapper">
            <input type="text" id="team-name" placeholder="Enter your team name" className="design-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="design-card">
          <label className="design-label">Team Tag</label>
          <div className="design-input-wrapper">
            <input type="text" id="team-tag" placeholder="Enter your team tag (e.g. NAVI)" className="design-input" maxLength={5} value={tag} onChange={(e) => setTag(e.target.value)} />
          </div>
        </div>

        <div className="design-card">
          <label className="design-label">Team Logo</label>
          <div className="logo-grid">
            {LOGOS.map((l) => (
              <div key={l.id} className={`logo-option${activeLogo === l.id ? ' active' : ''}`} data-logo={l.id} onClick={() => setActiveLogo(l.id)} dangerouslySetInnerHTML={{ __html: l.svg }} />
            ))}
            <div className="logo-option upload-btn">
              <div className="upload-content">
                <span dangerouslySetInnerHTML={{ __html: UPLOAD_SVG }} />
                <span>UPLOAD</span>
              </div>
            </div>
          </div>
        </div>

        <div className="design-card">
          <label className="design-label">Share Invite Link</label>
          <div className="invite-link-wrapper">
            <input type="text" id="invite-link" value={inviteLink} readOnly className="invite-input" />
            <button className="btn-copy-link" onClick={copyInviteLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <div className="footer-actions">
          <button className="btn-action discard" onClick={() => window.history.back()}>DISCARD</button>
          <button className="btn-action create" onClick={createTeam}>CREATE TEAM</button>
        </div>
      </div>

      {checkout && (
        <div id="team-checkout-modal" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f172a', border: '1px solid #c6ff33', borderRadius: 16, width: 'min(90vw,460px)', padding: 32, boxShadow: '0 20px 60px #000a', color: '#f1f5f9' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 20, color: '#f1f5f9' }}>🛡️ Team Registration Payment</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>Team Registration Fee for "{checkout.comp.name}".</p>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#cbd5e1' }}>
                <span>Team Name:</span>
                <strong>{checkout.teamName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#cbd5e1' }}>
                <span>Participation Fee Model:</span>
                <span style={{ color: '#c6ff33', fontWeight: 600 }}>Per Team (Team Lead Pays)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#f1f5f9', borderTop: '1px dashed rgba(198,255,51,0.3)', paddingTop: 10, marginTop: 2 }}>
                <strong>Total Registration Fee:</strong>
                <strong style={{ color: '#c6ff33', fontSize: 20 }}>₹{checkout.feeAmount.toLocaleString('en-IN')}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setCheckout(null)} style={{ flex: 1, padding: 12, background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button
                onClick={() => {
                  const compId = getCompIdFromPage();
                  const logoSvg = (LOGOS.find((l) => l.id === activeLogo) || LOGOS[0]).svg;
                  setCheckout(null);
                  proceedCreateTeam(compId, checkout.teamName, tag.trim(), logoSvg);
                }}
                style={{ flex: 2, padding: 12, background: '#c6ff33', border: 'none', color: '#000', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                ✔ Pay ₹{checkout.feeAmount.toLocaleString('en-IN')} &amp; Register Team
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


