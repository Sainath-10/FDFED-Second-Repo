import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import TeamTabs from '../../components/Navigation/TeamTabs';
import { useToast } from '../../components/Common/Toast';
import { NexusTeamWorkflow } from '../../services/teamService';
import { NexusData } from '../../services/competitionService';
import '../../styles/pages/team/team-settings.css';

export default function TeamSettingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [pageContext, setPageContext] = useState(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [selectedLogo, setSelectedLogo] = useState('shield');
  const [joinPolicy, setJoinPolicy] = useState('open');

  useEffect(() => {
    const ctx = NexusTeamWorkflow.resolveTeamContext();
    if (!ctx || !ctx.comp || !ctx.team) {
      showToast('Team context not found.', 'error');
      navigate('/competitions', { replace: true });
      return;
    }
    setPageContext(ctx);
    setName(ctx.team.name || '');
    setTag(ctx.team.tag || '');
    setJoinPolicy(ctx.team.joinPolicy || 'open');
  }, [searchParams, navigate, showToast]);

  if (!pageContext || !pageContext.comp || !pageContext.team) {
    return (
      <Shell activeItem="activity">
        <main className="main-content" style={{ padding: '40px' }}>
          <h2>Loading...</h2>
        </main>
      </Shell>
    );
  }

  const { comp, team } = pageContext;

  const handlePolicyChange = (policy) => {
    setJoinPolicy(policy);
    const label = policy === 'open' ? 'Open (Anyone can request)' : 'Invite Only';
    showToast(`Join policy set to: ${label}`);
  };

  const handleSaveChanges = () => {
    const trimmedName = name.trim();
    const trimmedTag = tag.trim();

    if (!trimmedName || !trimmedTag) {
      showToast('Please fill in both Team Name and Team Tag!', 'error');
      return;
    }

    // Update in competition
    const comps = NexusData.loadCompetitions() || [];
    const targetComp = comps.find(c => String(c.id) === String(comp.id));
    if (targetComp && Array.isArray(targetComp.teams)) {
      const tIdx = targetComp.teams.findIndex(t => String(t.id) === String(team.id));
      if (tIdx >= 0) {
        targetComp.teams[tIdx] = {
          ...targetComp.teams[tIdx],
          name: trimmedName,
          tag: trimmedTag,
          joinPolicy,
        };
        NexusData.updateCompetition(targetComp);
      }
    }

    showToast(`Team settings for "${trimmedName}" updated successfully!`);
  };

  const handleDisbandTeam = () => {
    if (!window.confirm(`Are you sure you want to disband "${team.name}"? This cannot be undone.`)) {
      return;
    }

    const comps = NexusData.loadCompetitions() || [];
    const targetComp = comps.find(c => String(c.id) === String(comp.id));
    if (targetComp && Array.isArray(targetComp.teams)) {
      targetComp.teams = targetComp.teams.filter(t => String(t.id) !== String(team.id));
      NexusData.updateCompetition(targetComp);
    }

    try {
      localStorage.removeItem('nexus.team.context');
      localStorage.removeItem('nexus.team.activeContext');
    } catch (e) {}

    showToast('Team disbanded successfully.', 'error');
    setTimeout(() => {
      navigate('/competitions');
    }, 1200);
  };

  const logos = [
    {
      id: 'shield',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    },
    {
      id: 'trophy',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
        </svg>
      )
    },
    {
      id: 'gamepad',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 12h4" />
          <path d="M8 10v4" />
          <line x1="15" y1="13" x2="15.01" y2="13" />
          <line x1="18" y1="11" x2="18.01" y2="11" />
        </svg>
      )
    },
    {
      id: 'bolt',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )
    },
    {
      id: 'star',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    },
    {
      id: 'diamond',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3h12l4 6-10 12L2 9z" />
          <path d="M11 3 8 9l3 12" />
          <path d="M13 3l3 6-3 12" />
          <path d="M2.2 9h19.6" />
        </svg>
      )
    }
  ];

  return (
    <Shell activeItem="activity">
      <main className="main-content">
        <h1 className="page-title">{team.name}</h1>
        <p className="page-subtitle">Team settings and management options</p>

        <TeamTabs activeTab="settings" />

        <div className="settings-container-centered">
          {/* Card 1: Team Name */}
          <div className="design-card">
            <label className="design-label">Team Name</label>
            <div className="design-input-wrapper">
              <input
                type="text"
                id="team-name"
                className="design-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Card 2: Team Tag */}
          <div className="design-card">
            <label className="design-label">Team Tag</label>
            <div className="design-input-wrapper">
              <input
                type="text"
                id="team-tag"
                className="design-input"
                maxLength={5}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>
          </div>

          {/* Card 3: Team Logo */}
          <div className="design-card">
            <label className="design-label">Team Logo</label>
            <div className="logo-grid">
              {logos.map((l) => (
                <div
                  key={l.id}
                  className={`logo-option ${selectedLogo === l.id ? 'active' : ''}`}
                  onClick={() => setSelectedLogo(l.id)}
                >
                  {l.svg}
                </div>
              ))}
              <div className="logo-option upload-btn">
                <div className="upload-content">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>UPLOAD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Join Requests */}
          <div className="design-card">
            <label className="design-label">Join Requests</label>
            <div className="join-policy-selector">
              <button
                type="button"
                className={`policy-option ${joinPolicy === 'open' ? 'active' : ''}`}
                id="policy-open"
                onClick={() => handlePolicyChange('open')}
              >
                OPEN (ANYONE CAN REQUEST)
              </button>
              <button
                type="button"
                className={`policy-option ${joinPolicy === 'invite' ? 'active' : ''}`}
                id="policy-invite"
                onClick={() => handlePolicyChange('invite')}
              >
                INVITE ONLY
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="footer-actions">
            <button className="btn-action create" onClick={handleSaveChanges}>
              SAVE CHANGES
            </button>
          </div>

          {/* Danger Zone */}
          <div className="design-card danger-card-red-border">
            <label className="design-label" style={{ color: '#f87171' }}>⚠ Danger Zone</label>
            <p className="danger-desc-v2">
              Disbanding this team is permanent and cannot be undone. All members will be removed from the competition registry immediately.
            </p>
            <button className="btn-action btn-disband-v2" onClick={handleDisbandTeam}>
              DISBAND TEAM PERMANENTLY
            </button>
          </div>
        </div>
      </main>
    </Shell>
  );
}
