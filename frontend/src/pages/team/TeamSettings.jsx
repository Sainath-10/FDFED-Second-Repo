/**
 * NEXUS ESPORTS — Team Settings
 *
 * name/tag (+ logo
 * picker), join-policy selector, save-changes validation and the disband flow.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import NexusTeamWorkflow from '../../services/teamWorkflow.js';
import NexusData from '../../services/data.js';
import TeamTabs from '../../components/TeamTabs.jsx';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/team/team-settings.css';

const LOGOS = [
  { id: 'shield', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' },
  { id: 'trophy', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>' },
  { id: 'gamepad', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4"></path><path d="M8 10v4"></path><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line></svg>' },
  { id: 'bolt', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>' },
  { id: 'star', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' },
  { id: 'diamond', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 12L2 9z"></path><path d="M11 3 8 9l3 12"></path><path d="M13 3l3 6-3 12"></path><path d="M2.2 9h19.6"></path></svg>' },
];

const UPLOAD_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';

export default function TeamSettings() {
  const navigate = useNavigate();
  const { ctx, refresh } = useTeamContext();
  const [name, setName] = useState(() => (ctx && ctx.team ? ctx.team.name || '' : ''));
  const [tag, setTag] = useState(() => (ctx && ctx.team ? ctx.team.tag || '' : ''));
  const [logo, setLogo] = useState('shield');
  const [policy, setPolicy] = useState('open');

  if (!ctx || !ctx.comp || !ctx.team) {
    return <main className="main-content"><h1 className="page-title">Team Settings</h1></main>;
  }

  const { comp, team, session, context } = ctx;
  const requests = NexusTeamWorkflow.getJoinRequests(comp.id, team.id) || [];
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const canManage = !!(session && (session.username || '').toLowerCase() === (team.createdBy || '').toLowerCase());
  const isEnded = !!(comp.ended || comp.status === 'completed');

  function setJoinPolicy(next) {
    setPolicy(next);
    showToast(`Join policy set to: ${next === 'open' ? 'Open (Anyone can request)' : 'Invite Only'}`);
  }

  function saveChanges() {
    if (!name.trim() || !tag.trim()) { showToast('Please fill in both Team Name and Team Tag!', 'error'); return; }
    showToast(`Team settings for "${name.trim()}" updated successfully!`);
  }

  function disbandTeam() {
    if (!window.confirm(`Are you sure you want to disband "${team.name || 'this team'}"? This cannot be undone.`)) return;
    const comps = (NexusData && NexusData.loadCompetitions) ? NexusData.loadCompetitions() || [] : [];
    const found = comps.find((c) => String(c.id) === String(comp.id));
    if (found && Array.isArray(found.teams)) {
      found.teams = found.teams.filter((t) => String(t.id) !== String(team.id));
      if (NexusData.updateCompetition) NexusData.updateCompetition(found);
    }
    try { localStorage.removeItem('nexus.team.context'); } catch (e) { /* ignore */ }
    showToast('Team disbanded successfully.', 'error');
    setTimeout(() => { navigate('/pages/competitions.html'); }, 1200);
  }

  return (
    <main className="main-content">
      <h1 className="page-title">{team.name || 'Team Settings'}</h1>
      <p className="page-subtitle">Team settings and management options</p>

      <TeamTabs active="settings" context={context} canManage={canManage} isEnded={isEnded} joinRequestCount={pendingRequests} />

      <div className="settings-container-centered">
        <div className="design-card">
          <label className="design-label">Team Name</label>
          <div className="design-input-wrapper">
            <input type="text" id="team-name" value={name} className="design-input" onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="design-card">
          <label className="design-label">Team Tag</label>
          <div className="design-input-wrapper">
            <input type="text" id="team-tag" value={tag} className="design-input" maxLength={5} onChange={(e) => setTag(e.target.value)} />
          </div>
        </div>

        <div className="design-card">
          <label className="design-label">Team Logo</label>
          <div className="logo-grid">
            {LOGOS.map((l) => (
              <div
                key={l.id}
                className={`logo-option${logo === l.id ? ' active' : ''}`}
                data-logo={l.id}
                onClick={() => setLogo(l.id)}
                dangerouslySetInnerHTML={{ __html: l.svg }}
              />
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
          <label className="design-label">Join Requests</label>
          <div className="join-policy-selector">
            <button type="button" className={`policy-option${policy === 'open' ? ' active' : ''}`} id="policy-open" onClick={() => setJoinPolicy('open')}>OPEN (ANYONE CAN REQUEST)</button>
            <button type="button" className={`policy-option${policy === 'invite' ? ' active' : ''}`} id="policy-invite" onClick={() => setJoinPolicy('invite')}>INVITE ONLY</button>
          </div>
        </div>

        <div className="footer-actions">
          <button className="btn-action create" onClick={saveChanges}>SAVE CHANGES</button>
        </div>

        <div className="design-card danger-card-red-border">
          <label className="design-label" style={{ color: '#f87171' }}>⚠ Danger Zone</label>
          <p className="danger-desc-v2">Disbanding this team is permanent and cannot be undone. All members will be removed from the competition registry immediately.</p>
          <button className="btn-action btn-disband-v2" onClick={disbandTeam}>DISBAND TEAM PERMANENTLY</button>
        </div>
      </div>
    </main>
  );
}


