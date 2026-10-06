import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import { NexusTeamWorkflow } from '../services/teamService';
import { NexusAuth } from '../services/authService';
import '../styles/pages/create-competition.css';

export default function CreateCompetitionPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const session = NexusAuth.getSession();

  // Auth guard
  useEffect(() => {
    if (!NexusAuth.isLoggedIn()) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Form states
  const [compName, setCompName] = useState('');
  const [compGame, setCompGame] = useState('');
  const [compFormat, setCompFormat] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [coOrganizers, setCoOrganizers] = useState([]); // array of strings

  const [bannerPreview, setBannerPreview] = useState('/assets/8764f3a5ce7a0eb0275743600c60fb0c727893c8.png');
  const [userUploadedBanner, setUserUploadedBanner] = useState(false);

  const [regOpen, setRegOpen] = useState('');
  const [regClose, setRegClose] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxTeams, setMaxTeams] = useState(16);
  const [maxPlayers, setMaxPlayers] = useState(5);

  const [feeType, setFeeType] = useState('free');
  const [entryFee, setEntryFee] = useState('');

  const [prize1, setPrize1] = useState('');
  const [prize2, setPrize2] = useState('');
  const [prize3, setPrize3] = useState('');

  const [errors, setErrors] = useState({});
  const [checkoutModal, setCheckoutModal] = useState(null);

  // Super Admin platform settings
  const [superAdminLimits, setSuperAdminLimits] = useState({ allowKnockout: true, allowRoundRobin: true, maxTeams: 256 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nexus.superadmin.dashboard.state');
      if (raw) {
        const s = JSON.parse(raw);
        setSuperAdminLimits({
          allowKnockout: s['cfg-format-knockouts'] !== false,
          allowRoundRobin: s['cfg-format-roundrobin'] !== false,
          maxTeams: parseInt(s['cfg-max-teams']) || 256,
        });
      }
    } catch (e) {}
  }, []);

  const getDefaultBanner = (gameName) => {
    const g = String(gameName || '').toLowerCase();
    if (g.includes('valorant')) return '/assets/8764f3a5ce7a0eb0275743600c60fb0c727893c8.png';
    if (g.includes('counter-strike') || g.includes('cs2') || g.includes('cs:go') || g.includes('csgo')) {
      return '/assets/c4f97eccde97e10ac89b61ec5fb36fdce0ab2477.png';
    }
    if (g.includes('league of legends') || g.includes('lol')) {
      return '/assets/95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png';
    }
    if (g.includes('apex')) return '/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';
    return '/assets/b890c61489a080992ad7e99adabb1145e6d59606.png';
  };

  const handleGameChange = (e) => {
    const selected = e.target.value;
    setCompGame(selected);
    if (!userUploadedBanner) {
      setBannerPreview(getDefaultBanner(selected));
    }
    clearError('comp-game');
  };

  const handleBannerUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBannerPreview(ev.target.result);
      setUserUploadedBanner(true);
    };
    reader.readAsDataURL(file);
  };

  // Co-organizers handlers
  const addCoOrganizerRow = () => {
    setCoOrganizers([...coOrganizers, '']);
  };

  const updateCoOrganizer = (index, value) => {
    const updated = [...coOrganizers];
    updated[index] = value;
    setCoOrganizers(updated);
  };

  const removeCoOrganizer = (index) => {
    const updated = coOrganizers.filter((_, i) => i !== index);
    setCoOrganizers(updated);
  };

  // Calculation helpers
  const p1 = parseInt(prize1) || 0;
  const p2 = parseInt(prize2) || 0;
  const p3 = parseInt(prize3) || 0;
  const totalPrize = p1 + p2 + p3;

  const platformFee = NexusData.calculatePlatformFee(totalPrize);

  const clearError = (field) => {
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const validateDates = (rOpenStr, rCloseStr, sDateStr, eDateStr) => {
    const dErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toDate = (s) => (s ? new Date(s + 'T00:00:00') : null);
    const rOpen = toDate(rOpenStr);
    const rClose = toDate(rCloseStr);
    const sDate = toDate(sDateStr);
    const eDate = toDate(eDateStr);

    if (!rOpenStr) {
      dErrors['reg-open'] = 'Registration Open date is required.';
    } else if (rOpen < today) {
      dErrors['reg-open'] = 'Registration Open date cannot be in the past.';
    }

    if (!rCloseStr) {
      dErrors['reg-close'] = 'Registration Close date is required.';
    } else if (rOpen && rClose && rClose <= rOpen) {
      dErrors['reg-close'] = 'Registration Close date must be strictly after Registration Open date.';
    } else if (rClose < today) {
      dErrors['reg-close'] = 'Registration Close date cannot be in the past.';
    }

    if (!sDateStr) {
      dErrors['start-date'] = 'Tournament Start Date is required.';
    } else if (rClose && sDate && sDate < rClose) {
      dErrors['start-date'] = 'Tournament Start Date must be on or after Registration Close date.';
    } else if (sDate < today) {
      dErrors['start-date'] = 'Tournament Start Date cannot be in the past.';
    }

    if (!eDateStr) {
      dErrors['end-date'] = 'Tournament End Date is required.';
    } else if (sDate && eDate && eDate <= sDate) {
      dErrors['end-date'] = 'Tournament End Date must be strictly after Tournament Start Date.';
    } else if (eDate < today) {
      dErrors['end-date'] = 'Tournament End Date cannot be in the past.';
    }

    return dErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!compName.trim()) {
      newErrors['comp-name'] = 'Please enter the valid name';
    } else if (compName.trim().length < 3) {
      newErrors['comp-name'] = 'Please enter the valid name (at least 3 characters)';
    } else if (compName.trim().length > 100) {
      newErrors['comp-name'] = 'Tournament name cannot exceed 100 characters.';
    }

    if (!compGame) {
      newErrors['comp-game'] = 'Please select a game.';
    }

    if (!compFormat) {
      newErrors['comp-format'] = 'Please select a tournament format.';
    }

    if (!compDesc.trim()) {
      newErrors['comp-desc'] = 'Tournament description is required.';
    } else if (compDesc.trim().length < 10) {
      newErrors['comp-desc'] = 'Description must be at least 10 characters long.';
    }

    const dateErrors = validateDates(regOpen, regClose, startDate, endDate);
    Object.assign(newErrors, dateErrors);

    const mt = parseInt(maxTeams);
    if (isNaN(mt) || mt < 2) {
      newErrors['max-teams'] = 'Max Teams must be at least 2 teams.';
    } else if (mt > superAdminLimits.maxTeams) {
      newErrors['max-teams'] = `Max Teams cannot exceed ${superAdminLimits.maxTeams} teams.`;
    }

    const mp = parseInt(maxPlayers);
    if (isNaN(mp) || mp < 1) {
      newErrors['max-players'] = 'Max Players per Team must be at least 1 player.';
    } else if (mp > 20) {
      newErrors['max-players'] = 'Max Players per Team cannot exceed 20 players.';
    }

    if (feeType !== 'free') {
      const parsedFee = parseFloat(entryFee);
      if (isNaN(parsedFee) || parsedFee < 0) {
        newErrors['entry-fee'] = 'Entry fee cannot be negative.';
      }
    }

    if (p1 < 0) newErrors['prize-1'] = 'Prize cannot be negative.';
    if (p2 < 0) newErrors['prize-2'] = 'Prize cannot be negative.';
    if (p3 < 0) newErrors['prize-3'] = 'Prize cannot be negative.';
    if (p2 > 0 && p2 > p1) newErrors['prize-2'] = '1st place prize must be ≥ 2nd place prize.';
    if (p3 > 0 && p3 > p2 && p2 > 0) newErrors['prize-3'] = '2nd place prize must be ≥ 3rd place prize.';

    // Validate Co-organizers
    const cleanCoOrgs = [];
    coOrganizers.forEach((raw, i) => {
      const val = raw.trim().replace(/^@/, '');
      if (val) {
        if (session && val.toLowerCase() === (session.username || '').toLowerCase()) {
          newErrors[`coorg-${i}`] = `You (@${session.username}) are already the primary creator/owner.`;
        } else if (cleanCoOrgs.map(s => s.toLowerCase()).includes(val.toLowerCase())) {
          newErrors[`coorg-${i}`] = `@${val} is added multiple times.`;
        } else {
          cleanCoOrgs.push(val);
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast('Please fix all highlighted errors to publish tournament.', 'error');
      return;
    }

    // Open Organizer Checkout Modal
    setCheckoutModal({
      cleanCoOrgs,
      totalPrize,
      platformFee,
    });
  };

  const handleConfirmCheckout = () => {
    if (!checkoutModal) return;
    const { cleanCoOrgs, totalPrize, platformFee } = checkoutModal;

    const prizeThreshold = 50000;
    const isHighStakes = totalPrize > prizeThreshold;
    const approvalStatus = isHighStakes ? 'pending' : 'approved';
    const type = compFormat.toLowerCase().includes('robin') ? 'league' : 'tournament';

    const entryFeeAmount = feeType !== 'free' ? (parseFloat(entryFee) || 0) : 0;
    let formattedEntryFee = 'Free';
    if (feeType === 'per_team') formattedEntryFee = `₹${entryFeeAmount.toLocaleString('en-IN')} / Team`;
    else if (feeType === 'per_player') formattedEntryFee = `₹${entryFeeAmount.toLocaleString('en-IN')} / Player`;

    const newComp = {
      id: NexusData.generateId(compName),
      name: compName.trim(),
      game: compGame,
      type: type,
      format: compFormat,
      description: compDesc.trim(),
      startDate: startDate ? new Date(startDate + 'T00:00:00').toISOString() : '',
      endDate: endDate ? new Date(endDate + 'T00:00:00').toISOString() : '',
      createdAt: new Date().toISOString(),
      dates: startDate ? `${startDate} to ${endDate}` : 'TBD',
      registrationDates: {
        open: regOpen,
        close: regClose,
      },
      maxTeams: parseInt(maxTeams) || 16,
      maxPlayersPerTeam: parseInt(maxPlayers) || 5,
      prizePool: totalPrize > 0 ? `₹${totalPrize.toLocaleString('en-IN')}` : 'No Prize Pool',
      prize: totalPrize,
      platformFee: platformFee,
      feeType: feeType,
      entryFeeAmount: entryFeeAmount,
      entryFee: formattedEntryFee,
      organizerPaid: true,
      prizes: [
        { place: '1st Place', amount: `₹${p1.toLocaleString('en-IN')}` },
        { place: '2nd Place', amount: `₹${p2.toLocaleString('en-IN')}` },
        { place: '3rd Place', amount: `₹${p3.toLocaleString('en-IN')}` },
      ],
      status: 'upcoming',
      img: bannerPreview,
      participants: 0,
      teams: [],
      matches: [],
      standings: [],
      disputes: [],
      organizerId: session?.username || 'organizer',
      createdBy: session?.username || 'organizer',
      organizers: [session?.username || 'organizer'],
      pendingCoOrganizers: Array.from(new Set(cleanCoOrgs)),
      approvalStatus: approvalStatus,
      badge: isHighStakes ? 'Pending' : 'New',
      badgeClass: isHighStakes ? 'live' : 'hot',
      season: 'Season 1',
      totalMatches: 0,
      matchesCompleted: 0,
    };

    NexusData.addCompetition(newComp);

    // Send co-organizer invitation notifications
    cleanCoOrgs.forEach(coOrgUsername => {
      if (!coOrgUsername) return;
      const notifEntry = {
        toUsername: coOrgUsername,
        type: 'co-organizer-invite',
        status: 'pending',
        title: '🏆 Co-Organizer Invitation',
        body: `@${session?.username} invited you to be a co-organizer for tournament "${newComp.name}".`,
        createdAt: new Date().toISOString(),
        read: false,
        meta: {
          compId: newComp.id,
          compName: newComp.name,
          invitedBy: session?.username,
        },
      };
      NexusTeamWorkflow.pushNotification(notifEntry);
    });

    setCheckoutModal(null);
    if (isHighStakes) {
      showToast(`Tournament submitted! Requires Admin approval because prize pool (₹${totalPrize.toLocaleString('en-IN')}) exceeds ₹50,000.`, 'warning');
    } else {
      showToast('Tournament Created & Published! Co-organizers invited.', 'success');
    }

    setTimeout(() => {
      navigate('/my-activity');
    }, 1500);
  };

  const revenueConfig = NexusData.getRevenueConfig();
  const feeRuleText = `${revenueConfig.percentage}% Prize Pool Fee (Min. ₹${revenueConfig.minCost})`;

  return (
    <Shell activeItem="competitions">
      <main className="create-comp-page">
        <Link to="/competitions" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4" />
          </svg>
          Back to Competitions
        </Link>

        <h1 className="page-title">Create Competition</h1>
        <p className="page-subtitle">Set up a new tournament for your community.</p>

        <div className="create-layout">
          {/* Main Form */}
          <div className="form-card">
            <form id="create-comp-form" onSubmit={handleSubmit} noValidate>
              {/* Basic Info */}
              <div className="form-section-title">Basic Information</div>

              <div className="form-group">
                <label className="form-label" htmlFor="comp-name">Competition Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  className="form-input"
                  type="text"
                  id="comp-name"
                  placeholder="e.g. Summer Showdown 2026"
                  value={compName}
                  onChange={(e) => { setCompName(e.target.value); clearError('comp-name'); }}
                  style={errors['comp-name'] ? { borderColor: '#ef4444' } : {}}
                  required
                />
                {errors['comp-name'] && (
                  <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                    ⚠ {errors['comp-name']}
                  </p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="comp-game">Game <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    className="form-select"
                    id="comp-game"
                    value={compGame}
                    onChange={handleGameChange}
                    style={errors['comp-game'] ? { borderColor: '#ef4444' } : {}}
                    required
                  >
                    <option value="">Select game…</option>
                    <option>Counter-Strike 2</option>
                    <option>League of Legends</option>
                    <option>Dota 2</option>
                    <option>Fortnite</option>
                    <option>Valorant</option>
                    <option>Rocket League</option>
                  </select>
                  {errors['comp-game'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['comp-game']}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="comp-format">Format <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    className="form-select"
                    id="comp-format"
                    value={compFormat}
                    onChange={(e) => { setCompFormat(e.target.value); clearError('comp-format'); }}
                    style={errors['comp-format'] ? { borderColor: '#ef4444' } : {}}
                    required
                  >
                    <option value="">Select format…</option>
                    {superAdminLimits.allowKnockout && <option>Single Elimination</option>}
                    {superAdminLimits.allowRoundRobin && <option>Round Robin</option>}
                  </select>
                  {errors['comp-format'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['comp-format']}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="comp-desc">Description <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  className="form-textarea"
                  id="comp-desc"
                  placeholder="Describe your tournament — rules, schedule, eligibility requirements… (at least 10 characters)"
                  value={compDesc}
                  onChange={(e) => { setCompDesc(e.target.value); clearError('comp-desc'); }}
                  style={errors['comp-desc'] ? { borderColor: '#ef4444' } : {}}
                  required
                />
                {errors['comp-desc'] && (
                  <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                    ⚠ {errors['comp-desc']}
                  </p>
                )}
              </div>

              {/* Co-Organizers */}
              <div className="form-section-title">Tournament Co-Organizers</div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Co-Organizers (Assign Multiple)</label>
                  <button
                    type="button"
                    className="btn-table-secondary"
                    id="btn-add-coorganizer"
                    onClick={addCoOrganizerRow}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(198,255,51,0.3)', color: '#c6ff33', cursor: 'pointer', background: 'transparent' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Co-Organizer
                  </button>
                </div>

                <div id="co-organizers-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {coOrganizers.map((coVal, idx) => (
                    <div key={idx} className="co-organizer-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>
                          @
                        </span>
                        <input
                          type="text"
                          className="form-input co-organizer-input"
                          placeholder="e.g. co_organizer_username or ID"
                          value={coVal}
                          onChange={(e) => {
                            updateCoOrganizer(idx, e.target.value);
                            clearError(`coorg-${idx}`);
                          }}
                          style={{ paddingLeft: '28px', width: '100%', ...(errors[`coorg-${idx}`] ? { borderColor: '#ef4444' } : {}) }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-table-danger"
                        onClick={() => removeCoOrganizer(idx)}
                        style={{ padding: '10px 14px', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        title="Remove co-organizer"
                      >
                        ✕
                      </button>
                      {errors[`coorg-${idx}`] && (
                        <p style={{ color: '#ef4444', fontSize: '11px', margin: 0 }}>{errors[`coorg-${idx}`]}</p>
                      )}
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Click <strong>+ Add Co-Organizer</strong> to assign organizers. Co-organizers can manage brackets, approve teams, and resolve disputes for this tournament.
                </p>
              </div>

              {/* Banner Upload */}
              <div className="form-section-title">Tournament Banner</div>
              <label className="upload-area" style={{ cursor: 'pointer' }}>
                <div className="upload-icon">🖼️</div>
                <div className="upload-text">
                  <span>Click to upload custom banner</span> or drag &amp; drop<br />
                  Automatic game-tailored banner will be used if left empty
                </div>
                <input
                  type="file"
                  id="banner-file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleBannerUpload}
                />
              </label>
              {bannerPreview && (
                <img
                  id="banner-preview"
                  src={bannerPreview}
                  alt="Banner preview"
                  style={{ width: '100%', borderRadius: '10px', marginTop: '12px', maxHeight: '180px', objectFit: 'cover' }}
                />
              )}

              {/* Dates & Capacity */}
              <div className="form-section-title">Dates &amp; Capacity</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-open">Registration Opens <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    className="form-input"
                    type="date"
                    id="reg-open"
                    value={regOpen}
                    onChange={(e) => { setRegOpen(e.target.value); clearError('reg-open'); }}
                    style={errors['reg-open'] ? { borderColor: '#ef4444' } : {}}
                    required
                  />
                  {errors['reg-open'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['reg-open']}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-close">Registration Closes <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    className="form-input"
                    type="date"
                    id="reg-close"
                    value={regClose}
                    onChange={(e) => { setRegClose(e.target.value); clearError('reg-close'); }}
                    style={errors['reg-close'] ? { borderColor: '#ef4444' } : {}}
                    required
                  />
                  {errors['reg-close'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['reg-close']}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="start-date">Tournament Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    className="form-input"
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); clearError('start-date'); }}
                    style={errors['start-date'] ? { borderColor: '#ef4444' } : {}}
                    required
                  />
                  {errors['start-date'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['start-date']}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="end-date">Tournament End Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    className="form-input"
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); clearError('end-date'); }}
                    style={errors['end-date'] ? { borderColor: '#ef4444' } : {}}
                    required
                  />
                  {errors['end-date'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['end-date']}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="max-teams">Max Teams (2–{superAdminLimits.maxTeams}) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    id="max-teams"
                    placeholder="e.g. 16"
                    min="2"
                    max={superAdminLimits.maxTeams}
                    value={maxTeams}
                    onChange={(e) => { setMaxTeams(e.target.value); clearError('max-teams'); }}
                    style={errors['max-teams'] ? { borderColor: '#ef4444' } : {}}
                    required
                  />
                  {errors['max-teams'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['max-teams']}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="max-players">Max Players per Team (1–20) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    id="max-players"
                    placeholder="e.g. 5"
                    min="1"
                    max="20"
                    value={maxPlayers}
                    onChange={(e) => { setMaxPlayers(e.target.value); clearError('max-players'); }}
                    style={errors['max-players'] ? { borderColor: '#ef4444' } : {}}
                    required
                  />
                  {errors['max-players'] && (
                    <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                      ⚠ {errors['max-players']}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="fee-type">Participation Fee Model <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    className="form-select"
                    id="fee-type"
                    value={feeType}
                    onChange={(e) => setFeeType(e.target.value)}
                  >
                    <option value="free">Free (No Entry Fee)</option>
                    <option value="per_team">Charged Per Team (Team Lead Pays)</option>
                    <option value="per_player">Charged Per Player (Each Player Pays)</option>
                  </select>
                </div>
                {feeType !== 'free' && (
                  <div className="form-group" id="entry-fee-group">
                    <label className="form-label" htmlFor="entry-fee">Entry Fee Amount (₹) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      className="form-input"
                      type="number"
                      id="entry-fee"
                      placeholder="e.g. 100"
                      min="0"
                      value={entryFee}
                      onChange={(e) => { setEntryFee(e.target.value); clearError('entry-fee'); }}
                      style={errors['entry-fee'] ? { borderColor: '#ef4444' } : {}}
                    />
                    {errors['entry-fee'] && (
                      <p className="field-error-msg" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '5px' }}>
                        ⚠ {errors['entry-fee']}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Prize Pool */}
              <div className="form-section-title">Prize Pool Distribution (₹)</div>

              <div className="prize-tiers">
                <div className="prize-tier">
                  <div className="prize-rank">🥇</div>
                  <div className="prize-label">1st Place</div>
                  <input
                    className="prize-input"
                    type="number"
                    id="prize-1"
                    placeholder="0"
                    min="0"
                    value={prize1}
                    onChange={(e) => { setPrize1(e.target.value); clearError('prize-1'); }}
                  />
                  {errors['prize-1'] && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{errors['prize-1']}</p>}
                </div>
                <div className="prize-tier">
                  <div className="prize-rank">🥈</div>
                  <div className="prize-label">2nd Place</div>
                  <input
                    className="prize-input"
                    type="number"
                    id="prize-2"
                    placeholder="0"
                    min="0"
                    value={prize2}
                    onChange={(e) => { setPrize2(e.target.value); clearError('prize-2'); }}
                  />
                  {errors['prize-2'] && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{errors['prize-2']}</p>}
                </div>
                <div className="prize-tier">
                  <div className="prize-rank">🥉</div>
                  <div className="prize-label">3rd Place</div>
                  <input
                    className="prize-input"
                    type="number"
                    id="prize-3"
                    placeholder="0"
                    min="0"
                    value={prize3}
                    onChange={(e) => { setPrize3(e.target.value); clearError('prize-3'); }}
                  />
                  {errors['prize-3'] && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{errors['prize-3']}</p>}
                </div>
              </div>

              {/* Prize total display & Platform Fee Calculation Box */}
              <div
                id="prize-total-row"
                style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderRadius: '10px', background: 'rgba(198,255,51,0.06)', border: '1px solid rgba(198,255,51,0.2)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>TOTAL PRIZE POOL</span>
                  <span id="prize-total-display" style={{ fontSize: '18px', fontWeight: 800, color: '#c6ff33' }}>
                    ₹{totalPrize.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed rgba(251,146,60,0.3)', paddingTop: '10px', marginTop: '2px' }}>
                  <span style={{ fontSize: '13px', color: '#fb923c', fontWeight: 700 }}>PLATFORM FEE DUE BY ORGANIZER</span>
                  <span id="total-due-display" style={{ fontSize: '22px', fontWeight: 900, color: '#fb923c' }}>
                    ₹{platformFee.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '32px' }}>
                <button type="submit" className="btn-submit">Publish Competition</button>
              </div>
            </form>
          </div>

          {/* Summary Sidebar */}
          <div className="summary-card">
            <h3>Summary</h3>

            <div className="summary-row"><span className="k">Name</span> <span className="v" id="s-name">{compName || '—'}</span></div>
            <div className="summary-row"><span className="k">Game</span> <span className="v" id="s-game">{compGame || '—'}</span></div>
            <div className="summary-row"><span className="k">Format</span> <span className="v" id="s-format">{compFormat || '—'}</span></div>
            <div className="summary-row"><span className="k">Teams</span> <span className="v" id="s-teams">{maxTeams} Teams / {maxPlayers} Players</span></div>
            <div className="summary-row"><span className="k">Reg. Opens</span> <span className="v" id="s-reg">{regOpen || '—'}</span></div>

            <div style={{ marginTop: '24px' }}>
              <h3>Next Steps</h3>
              <div className="steps-list">
                <div className="step-item">
                  <div className="step-num done">✓</div><span className="step-text">Fill in competition details</span>
                </div>
                <div className="step-item">
                  <div className="step-num">2</div><span className="step-text">Publish your competition</span>
                </div>
                <div className="step-item">
                  <div className="step-num">3</div><span className="step-text">Share with your community</span>
                </div>
                <div className="step-item">
                  <div className="step-num">4</div><span className="step-text">Manage registrations &amp; schedule matches</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Organizer Checkout Modal */}
      {checkoutModal && (
        <div
          id="org-checkout-modal"
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => {
            if (e.target.id === 'org-checkout-modal') setCheckoutModal(null);
          }}
        >
          <div style={{ background: '#0f172a', border: '1px solid #fb923c', borderRadius: '16px', width: 'min(90vw, 480px)', padding: '32px', boxShadow: '0 20px 60px #000a', color: '#f1f5f9' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: '#f1f5f9' }}>💳 Organizer Platform Fee Checkout</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94a3b8' }}>
              Review platform fee payment for "{compName}".
            </p>

            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#cbd5e1' }}>
                <span>Tournament Prize Pool:</span>
                <strong style={{ color: '#c6ff33' }}>₹{checkoutModal.totalPrize.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                <span>Fee Calculation:</span>
                <strong style={{ color: '#f1f5f9' }}>{feeRuleText}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                <span>Participation Fee Model:</span>
                <strong style={{ color: '#f1f5f9' }}>
                  {feeType === 'free' ? 'Free' : feeType === 'per_team' ? `₹${entryFee} / Team` : `₹${entryFee} / Player`}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#f1f5f9', borderTop: '2px dashed #fb923c', paddingTop: '10px', marginTop: '2px' }}>
                <strong>Platform Fee Due by Organizer:</strong>
                <strong style={{ color: '#fb923c', fontSize: '22px' }}>₹{checkoutModal.platformFee.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                id="cancel-checkout-btn"
                onClick={() => setCheckoutModal(null)}
                style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-checkout-btn"
                onClick={handleConfirmCheckout}
                style={{ flex: 2, padding: '12px', background: '#fb923c', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
              >
                ✔ Pay Platform Fee (₹{checkoutModal.platformFee.toLocaleString('en-IN')})
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
