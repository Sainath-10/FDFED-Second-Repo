import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import { NexusTeamWorkflow } from '../services/teamService';
import { NexusAuth } from '../services/authService';
import '../styles/pages/create-team.css';

export default function CreateTeamPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const compIdFromUrl = searchParams.get('id') || searchParams.get('compId');
  const activeCtx = NexusTeamWorkflow.getActiveTeamContext();
  const compId = compIdFromUrl || activeCtx?.compId || '';

  const [teamName, setTeamName] = useState('');
  const [teamTag, setTeamTag] = useState('');
  const [selectedLogo, setSelectedLogo] = useState('shield');
  const [customLogoSvg, setCustomLogoSvg] = useState(null);
  const [checkoutModal, setCheckoutModal] = useState(null);

  // Auth check
  useEffect(() => {
    const isAuthed = NexusAuth && typeof NexusAuth.isLoggedIn === 'function'
      ? NexusAuth.isLoggedIn()
      : (NexusAuth && typeof NexusAuth.getSession === 'function' ? !!NexusAuth.getSession() : false);

    if (!isAuthed) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const comp = compId ? NexusData.getCompetitionById(compId) : null;

  // Build invite link
  const buildInviteLink = (cId, tId) => {
    const origin = window.location.origin;
    const params = new URLSearchParams();
    if (cId) params.set('id', cId);
    if (tId) params.set('teamId', tId);
    const query = params.toString();
    return `${origin}/join-teams${query ? `?${query}` : ''}`;
  };

  const currentInviteLink = buildInviteLink(compId, activeCtx?.teamId || '');

  const copyInviteLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentInviteLink).then(() => {
        showToast('Invite link copied to clipboard!');
      });
    } else {
      prompt('Copy invite link:', currentInviteLink);
    }
  };

  const handleCustomUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomLogoSvg(ev.target.result);
      setSelectedLogo('custom');
      showToast('Custom logo uploaded!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const logos = [
    {
      id: 'shield',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      icon: '🛡️'
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
      ),
      icon: '🏆'
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
      ),
      icon: '🎮'
    },
    {
      id: 'bolt',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      icon: '⚡'
    },
    {
      id: 'star',
      svg: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      icon: '⭐'
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
      ),
      icon: '💎'
    }
  ];

  const handleCreateTeam = () => {
    if (!compId) {
      showToast('Tournament context missing. Open this from a competition page.', 'error');
      return;
    }

    const trimmedName = teamName.trim();
    const trimmedTag = teamTag.trim();

    if (!trimmedName || !trimmedTag) {
      showToast('Please fill in both Team Name and Team Tag!', 'error');
      return;
    }

    const activeItem = logos.find(l => l.id === selectedLogo);
    const avatar = selectedLogo === 'custom' && customLogoSvg ? customLogoSvg : (activeItem?.icon || '🛡️');

    const entryFeeAmount = comp ? (comp.entryFeeAmount || 0) : 0;
    const feeType = comp ? (comp.feeType || 'free') : 'free';

    if (comp && feeType === 'per_team' && entryFeeAmount > 0) {
      setCheckoutModal({
        compId,
        name: trimmedName,
        tag: trimmedTag,
        avatar,
        feeAmount: entryFeeAmount,
      });
    } else {
      proceedCreate(compId, trimmedName, trimmedTag, avatar);
    }
  };

  const proceedCreate = (cId, name, tag, avatar) => {
    const result = NexusTeamWorkflow.createTeam({
      compId: cId,
      name,
      tag,
      avatar,
    });

    if (!result.ok) {
      showToast(result.error || 'Failed to create team.', 'error');
      return;
    }

    setCheckoutModal(null);
    showToast(`Team "${name}" registered successfully!`, 'success');
    setTimeout(() => {
      navigate('/my-activity');
    }, 1500);
  };

  return (
    <Shell activeItem="competitions">
      <main className="create-team-page">
        <Link to={compId ? `/comp-info?id=${compId}` : '/competitions'} className="back-btn">
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
          {/* Card 1: Team Name */}
          <div className="design-card">
            <label className="design-label">Team Name</label>
            <div className="design-input-wrapper">
              <input
                type="text"
                id="team-name"
                placeholder="Enter your team name"
                className="design-input"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
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
                placeholder="Enter your team tag (e.g. NAVI)"
                className="design-input"
                maxLength={5}
                value={teamTag}
                onChange={(e) => setTeamTag(e.target.value)}
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
              <label className={`logo-option upload-btn ${selectedLogo === 'custom' ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                <div className="upload-content">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>UPLOAD</span>
                </div>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCustomUpload} />
              </label>
            </div>
          </div>

          {/* Card 4: Share Invite Link */}
          <div className="design-card">
            <label className="design-label">Share Invite Link</label>
            <div className="invite-link-wrapper">
              <input
                type="text"
                id="invite-link"
                value={currentInviteLink}
                readOnly
                className="invite-input"
              />
              <button className="btn-copy-link" onClick={copyInviteLink}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="footer-actions">
            <button className="btn-action discard" onClick={() => navigate(-1)}>DISCARD</button>
            <button className="btn-action create" onClick={handleCreateTeam}>CREATE TEAM</button>
          </div>
        </div>
      </main>

      {/* Team Checkout Modal */}
      {checkoutModal && (
        <div
          id="team-checkout-modal"
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => {
            if (e.target.id === 'team-checkout-modal') setCheckoutModal(null);
          }}
        >
          <div style={{ background: '#0f172a', border: '1px solid #c6ff33', borderRadius: '16px', width: 'min(90vw, 460px)', padding: '32px', boxShadow: '0 20px 60px #000a', color: '#f1f5f9' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: '#f1f5f9' }}>🛡️ Team Registration Payment</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94a3b8' }}>
              Team Registration Fee for "{comp?.name || 'Competition'}".
            </p>

            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#cbd5e1' }}>
                <span>Team Name:</span>
                <strong>{checkoutModal.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#cbd5e1' }}>
                <span>Participation Fee Model:</span>
                <span style={{ color: '#c6ff33', fontWeight: 600 }}>Per Team (Team Lead Pays)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#f1f5f9', borderTop: '1px dashed rgba(198,255,51,0.3)', paddingTop: '10px', marginTop: '2px' }}>
                <strong>Total Registration Fee:</strong>
                <strong style={{ color: '#c6ff33', fontSize: '20px' }}>₹{checkoutModal.feeAmount.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                id="cancel-team-checkout-btn"
                onClick={() => setCheckoutModal(null)}
                style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-team-checkout-btn"
                onClick={() => proceedCreate(checkoutModal.compId, checkoutModal.name, checkoutModal.tag, checkoutModal.avatar)}
                style={{ flex: 2, padding: '12px', background: '#c6ff33', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
              >
                ✔ Pay ₹{checkoutModal.feeAmount.toLocaleString('en-IN')} &amp; Register Team
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
