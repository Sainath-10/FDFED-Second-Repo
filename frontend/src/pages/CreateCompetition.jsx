/**
 * NEXUS ESPORTS — Create Competition
 *
 * the full form with
 * live summary, co-organizer rows, banner upload/preview, the strict QA validation
 * rules, Super-Admin platform limits, the platform-fee checkout modal, and the
 * co-organizer invitation notifications.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/create-competition.css';

const GAMES = ['Counter-Strike 2', 'League of Legends', 'Dota 2', 'Fortnite', 'Valorant', 'Rocket League'];
const DEFAULT_BANNERS = [
  [['valorant'], '8764f3a5ce7a0eb0275743600c60fb0c727893c8.png'],
  [['counter-strike', 'cs2', 'cs:go', 'csgo'], 'c4f97eccde97e10ac89b61ec5fb36fdce0ab2477.png'],
  [['league of legends', 'lol'], '95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png'],
  [['apex'], 'f03e2b11537e425d8544ee3ca732bf73af5137c0.png'],
];
function getDefaultBanner(gameName) {
  const g = String(gameName || '').toLowerCase();
  for (const [keys, file] of DEFAULT_BANNERS) if (keys.some((k) => g.includes(k))) return assetUrl(file);
  return assetUrl('b890c61489a080992ad7e99adabb1145e6d59606.png');
}

function validateDates(regOpen, regClose, startDate, endDate) {
  const errors = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);
  const rOpen = toDate(regOpen);
  const rClose = toDate(regClose);
  const sDate = toDate(startDate);
  const eDate = toDate(endDate);

  if (!regOpen) errors['reg-open'] = 'Registration Open date is required.';
  else if (rOpen < today) errors['reg-open'] = 'Registration Open date cannot be in the past.';

  if (!regClose) errors['reg-close'] = 'Registration Close date is required.';
  else if (rOpen && rClose && rClose <= rOpen) errors['reg-close'] = 'Registration Close date must be strictly after Registration Open date.';
  else if (rClose < today) errors['reg-close'] = 'Registration Close date cannot be in the past.';

  if (!startDate) errors['start-date'] = 'Tournament Start Date is required.';
  else if (rClose && sDate && sDate < rClose) errors['start-date'] = 'Tournament Start Date must be on or after Registration Close date.';
  else if (sDate < today) errors['start-date'] = 'Tournament Start Date cannot be in the past.';

  if (!endDate) errors['end-date'] = 'Tournament End Date is required.';
  else if (sDate && eDate && eDate <= sDate) errors['end-date'] = 'Tournament End Date must be strictly after Tournament Start Date.';
  else if (eDate < today) errors['end-date'] = 'Tournament End Date cannot be in the past.';

  return Object.keys(errors).length > 0 ? errors : null;
}

export default function CreateCompetition() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [format, setFormat] = useState('');
  const [description, setDescription] = useState('');
  const [regOpen, setRegOpen] = useState('');
  const [regClose, setRegClose] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxTeams, setMaxTeams] = useState('16');
  const [maxPlayers, setMaxPlayers] = useState('5');
  const [feeType, setFeeType] = useState('free');
  const [entryFee, setEntryFee] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [coOrgs, setCoOrgs] = useState([]);
  const [bannerSrc, setBannerSrc] = useState('');
  const [userUploadedBanner, setUserUploadedBanner] = useState(false);
  const [errors, setErrors] = useState({});
  const [checkout, setCheckout] = useState(null);

 // Super-Admin platform settings (format availability + max-teams limit).
  const platform = useMemo(() => {
    try {
      const raw = localStorage.getItem('nexus.superadmin.dashboard.state');
      if (!raw) return { allowKnockout: true, allowRoundRobin: true, maxTeams: 256 };
      const s = JSON.parse(raw);
      return {
        allowKnockout: s['cfg-format-knockouts'] !== false,
        allowRoundRobin: s['cfg-format-roundrobin'] !== false,
        maxTeams: parseInt(s['cfg-max-teams'], 10) || 256,
      };
    } catch (e) {
      return { allowKnockout: true, allowRoundRobin: true, maxTeams: 256 };
    }
  }, []);

  const n1 = parseInt(p1, 10) || 0;
  const n2 = parseInt(p2, 10) || 0;
  const n3 = parseInt(p3, 10) || 0;
  const totalPrize = n1 + n2 + n3;
  const platformFee = (NexusData && NexusData.calculatePlatformFee) ? NexusData.calculatePlatformFee(totalPrize)
    : (totalPrize <= 0 ? 0 : (totalPrize <= 700 ? 50 : Math.round(totalPrize * 0.07)));

  const effectiveBanner = bannerSrc || getDefaultBanner(game);

  function fieldProps(id) {
    return {
      style: errors[id] ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px rgba(239,68,68,0.4)' } : undefined,
    };
  }
  function FieldError({ id }) {
    if (!errors[id]) return null;
    return <p className="field-error-msg" style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginTop: 5 }}><span>⚠</span> <span>{errors[id]}</span></p>;
  }

  function previewBanner(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setBannerSrc(ev.target.result); setUserUploadedBanner(true); };
    reader.readAsDataURL(file);
  }

  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!session) { showToast('Session expired. Please login again.', 'error'); return; }

    if (!name) next['comp-name'] = 'Please enter the valid name';
    else if (name.length < 3) next['comp-name'] = 'Please enter the valid name (at least 3 characters)';
    else if (name.length > 100) next['comp-name'] = 'Tournament name cannot exceed 100 characters.';

    if (!game) next['comp-game'] = 'Please select a game.';
    if (!format) next['comp-format'] = 'Please select a tournament format.';

    if (!description) next['comp-desc'] = 'Tournament description is required.';
    else if (description.length < 10) next['comp-desc'] = 'Description must be at least 10 characters long.';

    const dateErrors = validateDates(regOpen, regClose, startDate, endDate);
    if (dateErrors) Object.assign(next, dateErrors);

    const mt = parseInt(maxTeams, 10);
    if (Number.isNaN(mt) || mt < 2) next['max-teams'] = 'Max Teams must be at least 2 teams.';
    else if (mt > 256) next['max-teams'] = 'Max Teams cannot exceed 256 teams.';

    const mp = parseInt(maxPlayers, 10);
    if (Number.isNaN(mp) || mp < 1) next['max-players'] = 'Max Players per Team must be at least 1 player.';
    else if (mp > 20) next['max-players'] = 'Max Players per Team cannot exceed 20 players.';

    const entryFeeRaw = String(entryFee).trim();
    const entryFeeNum = entryFeeRaw !== '' ? parseFloat(entryFeeRaw) : 0;
    if (entryFeeRaw !== '' && (Number.isNaN(entryFeeNum) || entryFeeNum < 0)) next['entry-fee'] = 'Entry fee cannot be negative.';

    if (n1 < 0) next['prize-1'] = 'Prize cannot be negative.';
    if (n2 < 0) next['prize-2'] = 'Prize cannot be negative.';
    if (n3 < 0) next['prize-3'] = 'Prize cannot be negative.';
    if (n2 > 0 && n2 > n1) next['prize-2'] = '1st place prize must be ≥ 2nd place prize.';
    if (n3 > 0 && n3 > n2 && n2 > 0) next['prize-3'] = '2nd place prize must be ≥ 3rd place prize.';

 // Co-organizers
    const cleanCoOrgs = [];
    let coOrgError = false;
    coOrgs.forEach((val) => {
      const v = String(val || '').trim().replace(/^@/, '');
      if (!v) return;
      if (v.toLowerCase() === String(session.username || '').toLowerCase()) {
        showToast(`You (@${session.username}) are already the primary creator/owner.`, 'error');
        coOrgError = true;
      } else if (cleanCoOrgs.map((s) => s.toLowerCase()).includes(v.toLowerCase())) {
        showToast(`Co-organizer @${v} is added multiple times.`, 'error');
        coOrgError = true;
      } else {
        cleanCoOrgs.push(v);
      }
    });
    if (coOrgError) next['co-organizers'] = 'Fix the co-organizer entries.';

    setErrors(next);
    if (Object.keys(next).length > 0) {
      showToast('Please fix all highlighted errors to auto-approve tournament.', 'error');
      return;
    }

    const type = format.toLowerCase().includes('robin') ? 'league' : 'tournament';
    const bannerImg = userUploadedBanner && bannerSrc ? bannerSrc : getDefaultBanner(game);
    const prizePoolStr = `₹${totalPrize.toLocaleString('en-IN')}`;
    const entryFeeAmount = feeType !== 'free' ? (parseFloat(entryFee) || 0) : 0;
    let formattedEntryFee = 'Free';
    if (feeType === 'per_team') formattedEntryFee = `₹${entryFeeAmount.toLocaleString('en-IN')} / Team`;
    else if (feeType === 'per_player') formattedEntryFee = `₹${entryFeeAmount.toLocaleString('en-IN')} / Player`;

    const isHighStakes = totalPrize > 50000;

    const newComp = {
      id: NexusData.generateId(name),
      name,
      game,
      type,
      format,
      description,
      startDate: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : '',
      endDate: endDate ? new Date(`${endDate}T00:00:00`).toISOString() : '',
      createdAt: new Date().toISOString(),
      dates: startDate ? `${startDate} to ${endDate}` : 'TBD',
      registrationDates: { open: regOpen, close: regClose },
      maxTeams: parseInt(maxTeams, 10) || 16,
      maxPlayersPerTeam: parseInt(maxPlayers, 10) || 5,
      prizePool: totalPrize > 0 ? prizePoolStr : 'No Prize Pool',
      prize: totalPrize,
      platformFee,
      feeType,
      entryFeeAmount,
      entryFee: formattedEntryFee,
      organizerPaid: true,
      prizes: [
        { place: '1st Place', amount: `₹${n1.toLocaleString('en-IN')}` },
        { place: '2nd Place', amount: `₹${n2.toLocaleString('en-IN')}` },
        { place: '3rd Place', amount: `₹${n3.toLocaleString('en-IN')}` },
      ],
      status: 'upcoming',
      img: bannerImg,
      participants: 0,
      teams: [],
      matches: [],
      standings: [],
      disputes: [],
      organizerId: session.username,
      createdBy: session.username,
      organizers: Array.from(new Set([session.username, ...cleanCoOrgs].filter(Boolean))),
      pendingCoOrganizers: Array.from(new Set(cleanCoOrgs)),
      approvalStatus: isHighStakes ? 'pending' : 'approved',
      badge: isHighStakes ? 'Pending' : 'New',
      badgeClass: isHighStakes ? 'live' : 'hot',
      season: 'Season 1',
      totalMatches: 0,
      matchesCompleted: 0,
    };

    setCheckout({ comp: newComp, prizePool: totalPrize, platformFee });
  }

  function confirmCheckout() {
    const { comp } = checkout;
    const { pendingCoOrganizers } = comp;
    if (NexusData) NexusData.addCompetition(comp);

    pendingCoOrganizers.forEach((coOrgUsername) => {
      if (!coOrgUsername) return;
      const notifEntry = {
        toUsername: coOrgUsername,
        type: 'co-organizer-invite',
        status: 'pending',
        title: '🏆 Co-Organizer Invitation',
        body: `@${session.username} invited you to be a co-organizer for tournament "${comp.name}".`,
        createdAt: new Date().toISOString(),
        read: false,
        meta: { compId: comp.id, compName: comp.name, invitedBy: session.username },
      };
      if (NexusTeamWorkflow && NexusTeamWorkflow.pushNotification) NexusTeamWorkflow.pushNotification(notifEntry);
      else if (NexusData && NexusData.pushSystemNotification) NexusData.pushSystemNotification(notifEntry);
      else {
        try {
          const items = JSON.parse(localStorage.getItem('nexus.notifications.items') || '[]');
          items.unshift({ id: `notif-${Date.now()}`, ...notifEntry });
          localStorage.setItem('nexus.notifications.items', JSON.stringify(items));
        } catch (e) { /* ignore */ }
      }
    });

    const isHighStakes = comp.approvalStatus === 'pending';
    if (isHighStakes) showToast(`Tournament submitted! Requires Admin approval because prize pool (₹${checkout.prizePool.toLocaleString('en-IN')}) exceeds ₹50,000.`, 'warning');
    else showToast('Tournament Created & Published! Co-organizers invited.', 'success');

    setCheckout(null);
    setTimeout(() => navigate('/pages/my-activity.html'), 1500);
  }

  const formatOptions = ['Single Elimination', 'Round Robin'].filter((f) => (f === 'Round Robin' ? platform.allowRoundRobin : platform.allowKnockout));

  return (
    <>
      <main className="create-comp-page">
        <Link to="/pages/competitions.html" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
          Back to Competitions
        </Link>
        <h1 className="page-title">Create Competition</h1>
        <p className="page-subtitle">Set up a new tournament for your community.</p>

        <div className="create-layout">
          <div className="form-card">
            <form id="create-comp-form" noValidate onSubmit={submit}>
              <div className="form-section-title">Basic Information</div>

              <div className="form-group">
                <label className="form-label" htmlFor="comp-name">Competition Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-input" type="text" id="comp-name" placeholder="e.g. Summer Showdown 2026" value={name} onChange={(e) => setName(e.target.value)} {...fieldProps('comp-name')} />
                <FieldError id="comp-name" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="comp-game">Game <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-select" id="comp-game" value={game} onChange={(e) => setGame(e.target.value)} {...fieldProps('comp-game')}>
                    <option value="">Select game…</option>
                    {GAMES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                  <FieldError id="comp-game" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="comp-format">Format <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-select" id="comp-format" value={format} onChange={(e) => setFormat(e.target.value)} {...fieldProps('comp-format')}>
                    <option value="">Select format…</option>
                    {formatOptions.map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <FieldError id="comp-format" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="comp-desc">Description <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea className="form-textarea" id="comp-desc" placeholder="Describe your tournament — rules, schedule, eligibility requirements… (at least 10 characters)" value={description} onChange={(e) => setDescription(e.target.value)} {...fieldProps('comp-desc')} />
                <FieldError id="comp-desc" />
              </div>

              <div className="form-section-title">Tournament Co-Organizers</div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>Co-Organizers (Assign Multiple)</label>
                  <button type="button" className="btn-table-secondary" onClick={() => setCoOrgs((c) => [...c, ''])} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(198,255,51,0.3)', color: '#c6ff33', cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Co-Organizer
                  </button>
                </div>
                <div id="co-organizers-container" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {coOrgs.map((val, i) => (
                    <div className="co-organizer-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }} key={i}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>@</span>
                        <input type="text" className="form-input co-organizer-input" placeholder="e.g. co_organizer_username or ID" value={val} onChange={(e) => setCoOrgs((c) => c.map((x, j) => (j === i ? e.target.value : x)))} style={{ paddingLeft: 28, width: '100%' }} />
                      </div>
                      <button type="button" className="btn-table-danger" onClick={() => setCoOrgs((c) => c.filter((_, j) => j !== i))} style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} title="Remove co-organizer">✕</button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Click <strong>+ Add Co-Organizer</strong> to assign organizers. Co-organizers can manage brackets, approve teams, and resolve disputes for this tournament.</p>
              </div>

              <div className="form-section-title">Tournament Banner</div>
              <div className="upload-area" onClick={() => document.getElementById('banner-file')?.click()}>
                <div className="upload-icon">🖼️</div>
                <div className="upload-text">
                  <span>Click to upload custom banner</span> or drag &amp; drop<br />
                  Automatic game-tailored banner will be used if left empty
                </div>
                <input type="file" id="banner-file" accept="image/*" style={{ display: 'none' }} onChange={previewBanner} />
              </div>
              <img id="banner-preview" src={effectiveBanner} alt="" style={{ display: effectiveBanner ? 'block' : 'none', width: '100%', borderRadius: 10, marginTop: 12, maxHeight: 180, objectFit: 'cover' }} />

              <div className="form-section-title">Dates &amp; Capacity</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-open">Registration Opens <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="date" id="reg-open" value={regOpen} onChange={(e) => setRegOpen(e.target.value)} {...fieldProps('reg-open')} />
                  <FieldError id="reg-open" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-close">Registration Closes <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="date" id="reg-close" value={regClose} onChange={(e) => setRegClose(e.target.value)} {...fieldProps('reg-close')} />
                  <FieldError id="reg-close" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="start-date">Tournament Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="date" id="start-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} {...fieldProps('start-date')} />
                  <FieldError id="start-date" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="end-date">Tournament End Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="date" id="end-date" value={endDate} onChange={(e) => setEndDate(e.target.value)} {...fieldProps('end-date')} />
                  <FieldError id="end-date" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="max-teams">Max Teams (2–{platform.maxTeams}) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="number" id="max-teams" placeholder="e.g. 16" min="2" max={platform.maxTeams} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} {...fieldProps('max-teams')} />
                  <FieldError id="max-teams" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="max-players">Max Players per Team (1–20) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="number" id="max-players" placeholder="e.g. 5" min="1" max="20" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} {...fieldProps('max-players')} />
                  <FieldError id="max-players" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="fee-type">Participation Fee Model <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-select" id="fee-type" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
                    <option value="free">Free (No Entry Fee)</option>
                    <option value="per_team">Charged Per Team (Team Lead Pays)</option>
                    <option value="per_player">Charged Per Player (Each Player Pays)</option>
                  </select>
                </div>
                <div className="form-group" id="entry-fee-group" style={{ display: feeType === 'free' ? 'none' : 'block' }}>
                  <label className="form-label" htmlFor="entry-fee">Entry Fee Amount (₹) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="number" id="entry-fee" placeholder="e.g. 100" min="0" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} {...fieldProps('entry-fee')} />
                  <FieldError id="entry-fee" />
                </div>
              </div>

              <div className="form-section-title">Prize Pool Distribution (₹)</div>

              <div className="prize-tiers">
                <div className="prize-tier"><div className="prize-rank">🥇</div><div className="prize-label">1st Place</div><input className="prize-input" type="number" id="prize-1" placeholder="0" min="0" value={p1} onChange={(e) => setP1(e.target.value)} {...fieldProps('prize-1')} /><FieldError id="prize-1" /></div>
                <div className="prize-tier"><div className="prize-rank">🥈</div><div className="prize-label">2nd Place</div><input className="prize-input" type="number" id="prize-2" placeholder="0" min="0" value={p2} onChange={(e) => setP2(e.target.value)} {...fieldProps('prize-2')} /><FieldError id="prize-2" /></div>
                <div className="prize-tier"><div className="prize-rank">🥉</div><div className="prize-label">3rd Place</div><input className="prize-input" type="number" id="prize-3" placeholder="0" min="0" value={p3} onChange={(e) => setP3(e.target.value)} {...fieldProps('prize-3')} /><FieldError id="prize-3" /></div>
              </div>

              <div id="prize-total-row" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 10, background: 'rgba(198,255,51,0.06)', border: '1px solid rgba(198,255,51,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>TOTAL PRIZE POOL</span>
                  <span id="prize-total-display" style={{ fontSize: 18, fontWeight: 800, color: '#c6ff33' }}>₹{totalPrize.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed rgba(251,146,60,0.3)', paddingTop: 10, marginTop: 2 }}>
                  <span style={{ fontSize: 13, color: '#fb923c', fontWeight: 700 }}>PLATFORM FEE DUE BY ORGANIZER</span>
                  <span id="total-due-display" style={{ fontSize: 22, fontWeight: 900, color: '#fb923c' }}>₹{platformFee.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div style={{ marginTop: 32 }}>
                <button type="submit" className="btn-submit">Publish Competition</button>
              </div>
            </form>
          </div>

          <div className="summary-card">
            <h3>Summary</h3>
            <div className="summary-row"><span className="k">Name</span> <span className="v" id="s-name">{name.trim() || '—'}</span></div>
            <div className="summary-row"><span className="k">Game</span> <span className="v" id="s-game">{game || '—'}</span></div>
            <div className="summary-row"><span className="k">Format</span> <span className="v" id="s-format">{format || '—'}</span></div>
            <div className="summary-row"><span className="k">Teams</span> <span className="v" id="s-teams">{maxTeams || '—'} Teams / {maxPlayers || '—'} Players</span></div>
            <div className="summary-row"><span className="k">Reg. Opens</span> <span className="v" id="s-reg">{regOpen || '—'}</span></div>
            <div style={{ marginTop: 24 }}>
              <h3>Next Steps</h3>
              <div className="steps-list">
                <div className="step-item"><div className="step-num done">✓</div><span className="step-text">Fill in competition details</span></div>
                <div className="step-item"><div className="step-num">2</div><span className="step-text">Publish your competition</span></div>
                <div className="step-item"><div className="step-num">3</div><span className="step-text">Share with your community</span></div>
                <div className="step-item"><div className="step-num">4</div><span className="step-text">Manage registrations &amp; schedule matches</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {checkout && (
        <div id="org-checkout-modal" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f172a', border: '1px solid #fb923c', borderRadius: 16, width: 'min(90vw,480px)', padding: 32, boxShadow: '0 20px 60px #000a', color: '#f1f5f9' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 20, color: '#f1f5f9' }}>💳 Organizer Platform Fee Checkout</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>Review platform fee payment for "{checkout.comp.name}".</p>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#cbd5e1' }}><span>Tournament Prize Pool:</span><strong style={{ color: '#c6ff33' }}>₹{checkout.prizePool.toLocaleString('en-IN')}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: 8 }}><span>Fee Calculation:</span><strong style={{ color: '#f1f5f9' }}>{(() => { const c = NexusData && NexusData.getRevenueConfig ? NexusData.getRevenueConfig() : { percentage: 7, minCost: 50 }; return `${c.percentage}% Prize Pool Fee (Min. ₹${c.minCost})`; })()}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: 8 }}><span>Participation Fee Model:</span><strong style={{ color: '#f1f5f9' }}>{checkout.comp.entryFee}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#f1f5f9', borderTop: '2px dashed #fb923c', paddingTop: 10, marginTop: 2 }}><strong>Platform Fee Due by Organizer:</strong><strong style={{ color: '#fb923c', fontSize: 22 }}>₹{checkout.platformFee.toLocaleString('en-IN')}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setCheckout(null)} style={{ flex: 1, padding: 12, background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={confirmCheckout} style={{ flex: 2, padding: 12, background: '#fb923c', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>✔ Pay Platform Fee (₹{checkout.platformFee.toLocaleString('en-IN')})</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


