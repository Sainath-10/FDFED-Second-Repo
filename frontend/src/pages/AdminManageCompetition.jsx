/**
 * NEXUS ESPORTS — Admin Add / Manage Competition
 *
 * the
 * 5-tab builder (basic info, settings, organizers, prize pool, manage existing),
 * co-organizer search/assign, draft save, publish, and the existing-competition list.
 * The page carried its own inline <style>; it is rendered via a <style> tag.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';

const CSS = `
:root { --bg:#0a0a0a; --bg-card:#111; --bg-inset:#181818; --bg-hover:#1e1e1e; --border:#262626; --accent:#c6ff33; --accent-dim:rgba(198,255,51,0.12); --accent-mid:rgba(198,255,51,0.25); --tw:#f5f5f5; --tm:#737373; --td:#a3a3a3; --red:#ef4444; --orange:#fb923c; --font:'Inter',sans-serif; --r:12px; --rs:8px; }
.mc-page *, .mc-page *::before, .mc-page *::after { box-sizing:border-box; }
.mc-page { padding:36px 48px 60px; max-width:1100px; font-family:var(--font); color:var(--tw); }
.mc-page .back-btn { display:inline-flex;align-items:center;gap:8px;color:var(--tm);font-size:13px;font-weight:500;text-decoration:none;padding:6px 12px 6px 8px;border-radius:var(--rs);border:1px solid transparent;transition:all .2s;margin-bottom:28px; }
.mc-page .back-btn:hover { color:var(--accent);border-color:var(--accent-mid);background:var(--accent-dim); }
.mc-header { display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:36px; }
.mc-title { font-size:28px;font-weight:800;color:var(--tw);letter-spacing:-0.5px; }
.mc-title span { color:var(--accent); }
.mc-sub { color:var(--tm);font-size:14px;margin-top:4px; }
.step-tabs { display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:4px;margin-bottom:32px;overflow-x:auto;gap:0; }
.step-tab { flex:1;min-width:120px;padding:10px 16px;background:none;border:none;border-radius:9px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;color:var(--tm);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap; }
.step-tab.active { background:var(--accent);color:#000; }
.step-tab:hover:not(.active) { background:var(--bg-hover);color:var(--tw); }
.snum { width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0; }
.step-tab.active .snum { background:rgba(0,0,0,0.2);color:#000; }
.tab-panel { display:none; } .tab-panel.active { display:block; }
.sec-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:28px 32px;margin-bottom:20px; }
.sec-head { display:flex;align-items:center;gap:12px;margin-bottom:24px; }
.sec-ico { width:36px;height:36px;border-radius:8px;background:var(--accent-dim);border:1px solid var(--accent-mid);display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0; }
.sec-title { font-size:16px;font-weight:700;color:var(--tw); }
.sec-desc { font-size:12px;color:var(--tm);margin-top:2px; }
.fg2 { display:grid;grid-template-columns:1fr 1fr;gap:20px; }
.fg3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px; }
.fg1 { display:grid;grid-template-columns:1fr;gap:20px; }
@media(max-width:720px){ .fg2,.fg3 { grid-template-columns:1fr; } }
.fg { display:flex;flex-direction:column;gap:7px; }
.fl { font-size:12px;font-weight:600;color:var(--td);text-transform:uppercase;letter-spacing:0.5px; }
.fl .r { color:var(--red);margin-left:2px; }
.fi,.fs,.fta { background:var(--bg-inset);border:1px solid var(--border);border-radius:var(--rs);color:var(--tw);font-family:var(--font);font-size:14px;padding:11px 14px;outline:none;transition:border-color .2s,box-shadow .2s;width:100%; }
.fi:focus,.fs:focus,.fta:focus { border-color:var(--accent);box-shadow:0 0 0 3px rgba(198,255,51,0.1); }
.fi::placeholder,.fta::placeholder { color:#404040; }
.fs option { background:#1a1a1a; }
.fta { resize:vertical;min-height:100px; }
.fhint { font-size:11px;color:var(--tm);margin-top:4px; }
.trow { display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border); }
.trow:last-child { border-bottom:none;padding-bottom:0; }
.trow:first-child { padding-top:0; }
.tinfo { flex:1;padding-right:16px; }
.tlbl { font-size:14px;font-weight:600;color:var(--tw); }
.tdesc { font-size:12px;color:var(--tm);margin-top:2px; }
.tsw { position:relative;width:44px;height:24px;flex-shrink:0; }
.tsw input { display:none; }
.ttrack { position:absolute;inset:0;background:#333;border-radius:12px;cursor:pointer;transition:background .2s; }
.ttrack::after { content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;background:#666;border-radius:50%;transition:transform .2s,background .2s; }
.tsw input:checked + .ttrack { background:var(--accent); }
.tsw input:checked + .ttrack::after { transform:translateX(20px);background:#000; }
.badge { display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700; }
.ba { background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent-mid); }
.bo { background:rgba(251,146,60,0.12);color:#fb923c;border:1px solid rgba(251,146,60,0.25); }
.btn { display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:var(--rs);font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .2s;text-decoration:none; }
.btn-a { background:var(--accent);color:#000; }
.btn-a:hover { background:#d4ff4d;transform:translateY(-1px);box-shadow:0 4px 20px rgba(198,255,51,0.3); }
.btn-o { background:transparent;border:1px solid var(--border);color:var(--td); }
.btn-o:hover { border-color:var(--accent);color:var(--accent);background:var(--accent-dim); }
.btn-r { background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171; }
.btn-r:hover { background:rgba(239,68,68,0.25);border-color:#f87171; }
.btn-sm { padding:7px 14px;font-size:12px; }
.coorg-list { display:flex;flex-direction:column;gap:12px;margin-top:16px; }
.coorg-card { display:flex;align-items:center;justify-content:space-between;background:var(--bg-inset);border:1px solid var(--border);border-radius:var(--rs);padding:14px 18px;gap:12px;transition:border-color .2s; }
.coorg-card:hover { border-color:#333; }
.coorg-av { width:40px;height:40px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent-mid);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--accent);flex-shrink:0; }
.coorg-info { flex:1;min-width:0; }
.coorg-name { font-size:14px;font-weight:600;color:var(--tw); }
.coorg-role { font-size:12px;color:var(--tm);margin-top:2px; }
.coorg-acts { display:flex;gap:8px;align-items:center;flex-shrink:0; }
.add-panel { background:var(--bg-inset);border:1px dashed var(--border);border-radius:var(--rs);padding:20px;margin-top:16px;display:none; }
.add-panel.open { display:block; }
.su-row { display:flex;gap:10px;align-items:flex-end; }
.su-row .fg { flex:1; }
.sres { margin-top:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--rs);overflow:hidden;display:none; }
.sres.vis { display:block; }
.sri { display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);gap:12px;cursor:pointer; }
.sri:last-child { border-bottom:none; }
.sri:hover { background:var(--bg-hover); }
.sri-n { font-size:14px;font-weight:600;color:var(--tw); }
.sri-e { font-size:12px;color:var(--tm); }
.pr { display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border); }
.pr:last-of-type { border-bottom:none; }
.pp { width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0; }
.pl { flex:1;font-size:14px;font-weight:600;color:var(--tw); }
.pi { width:160px;background:var(--bg-inset);border:1px solid var(--border);border-radius:var(--rs);color:var(--tw);font-family:var(--font);font-size:14px;font-weight:700;padding:9px 14px;outline:none;transition:border-color .2s; }
.pi:focus { border-color:var(--accent); }
.divider { height:1px;background:var(--border);margin:24px 0; }
.abar { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:32px;padding:20px 24px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r); }
.abar-l,.abar-r { display:flex;align-items:center;gap:12px; }
.spill { display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700; }
.spill::before { content:'';width:7px;height:7px;border-radius:50%;background:currentColor; }
.sp-draft { background:#1f1f1f;color:#737373;border:1px solid #333; }
.sp-active { background:rgba(198,255,51,0.1);color:var(--accent);border:1px solid rgba(198,255,51,0.25); }
.sp-pend { background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.25); }
.ml { display:flex;flex-direction:column;gap:12px; }
.mc { display:flex;align-items:center;gap:16px;background:var(--bg-inset);border:1px solid var(--border);border-radius:var(--rs);padding:16px 20px; }
.mc:hover { border-color:#333; }
.mc-ico { width:44px;height:44px;border-radius:10px;background:var(--accent-dim);border:1px solid var(--accent-mid);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0; }
.mc-info { flex:1;min-width:0; }
.mc-name { font-size:15px;font-weight:700;color:var(--tw); }
.mc-meta { font-size:12px;color:var(--tm);margin-top:3px; }
.mc-acts { display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap; }
.empty { text-align:center;padding:48px 24px;color:var(--tm); }
.empty-ico { font-size:40px;margin-bottom:12px;opacity:0.5; }
.empty-t { font-size:15px;font-weight:600;color:var(--td); }
.empty-s { font-size:13px;margin-top:6px; }
`;

const GAME_EMOJI = { 'Counter-Strike 2': '🎯', Valorant: '🎯', 'League of Legends': '⚔️', 'Dota 2': '🏹', Fortnite: '🎮', 'Rocket League': '🚀', 'PUBG Mobile': '🎮', 'Free Fire': '🔥' };

const DEFAULTS = {
  name: '', game: '', format: '', startDate: '', endDate: '', maxTeams: '', teamSize: '', region: '', description: '',
  openReg: true, requireVerify: false, publicListed: true, streaming: false, disputes: true, autoPublish: true,
  entryFee: '', platformFee: '10',
  p1: '', p2: '', p3: '', p4: '', mvp: '', spirit: '', note: '',
  pm: true, pt: true, pd: false, pw: false,
};

export default function AdminManageCompetition() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('basic');
  const [d, setD] = useState(DEFAULTS);
  const [coOrgs, setCoOrgs] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [csInp, setCsInp] = useState('');
  const [cdInp, setCdInp] = useState('');
  const [allComps, setAllComps] = useState([]);
  const [mSearch, setMSearch] = useState('');
  const [spill, setSpill] = useState({ cls: 'sp-draft', label: 'Draft' });
  const [pubLabel, setPubLabel] = useState('🚀 Create & Publish Competition');
  const [editingId, setEditingId] = useState(null);

  const headUser = (session && session.username) || 'Organizer';
  const headEmail = (session && session.email) || '';

  const loadML = () => {
    try { setAllComps(JSON.parse(localStorage.getItem('nexus_competitions') || '[]')); } catch (e) { setAllComps([]); }
  };

  useEffect(() => { loadML(); }, []);

  useEffect(() => {
    if (tab === 'manage') loadML();
  }, [tab]);

  const set = (key, value) => setD((prev) => ({ ...prev, [key]: value }));
  const onChange = () => { if (d.name.trim()) setSpill({ cls: 'sp-pend', label: 'Modified' }); };

  const totalPrize = ['p1', 'p2', 'p3', 'p4'].reduce((s, k) => s + (parseFloat(d[k]) || 0), 0);

  const searchResults = useMemo(() => {
    if (!csInp || csInp.length < 2) return [];
    let accs = [];
    try { accs = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]'); } catch (e) { accs = []; }
    const ql = csInp.toLowerCase();
    return accs.filter((a) => ((a.username || '').toLowerCase().includes(ql) || (a.email || '').toLowerCase().includes(ql)) && a.role !== 'super_admin' && !coOrgs.some((c) => c.username === a.username)).slice(0, 5);
  }, [csInp, coOrgs]);

  function addCoOrg(u, e) {
    setCoOrgs((c) => [...c, { username: u, email: e }]);
    showToast(`@${u} added as co-organizer.`);
  }
  function addDirect() {
    const u = cdInp.trim();
    if (!u) { showToast('Please enter a username.', 'error'); return; }
    if (coOrgs.some((c) => c.username.toLowerCase() === u.toLowerCase())) { showToast(`@${u} is already a co-organizer.`, 'warning'); return; }
    addCoOrg(u, '');
    setCdInp(''); setCsInp(''); setAddOpen(false);
  }
  function closeAdd() { setAddOpen(false); setCsInp(''); setCdInp(''); }

  function gatherData() {
    return {
      name: d.name.trim(), game: d.game, format: d.format, startDate: d.startDate, endDate: d.endDate,
      maxTeams: d.maxTeams || 16, teamSize: d.teamSize || 5, region: d.region, description: d.description.trim(),
      openReg: d.openReg, requireVerify: d.requireVerify, publicListed: d.publicListed, streaming: d.streaming,
      disputes: d.disputes, autoPublish: d.autoPublish, entryFee: d.entryFee || 0, platformFee: d.platformFee || 10,
      prizes: { first: d.p1 || 0, second: d.p2 || 0, third: d.p3 || 0, fourth: d.p4 || 0, mvp: d.mvp, spirit: d.spirit, note: d.note },
      coOrganizers: coOrgs,
      permissions: { matches: d.pm, teams: d.pt, disputes: d.pd, warnings: d.pw },
    };
  }

  function saveDraft() {
    const data = gatherData();
    data.status = 'draft';
    localStorage.setItem('nexus_comp_draft', JSON.stringify(data));
    setSpill({ cls: 'sp-draft', label: 'Draft Saved' });
    showToast('Competition saved as draft.');
  }

  function submitComp() {
    const data = gatherData();
    if (!data.name || !data.game || !data.format || !data.startDate) { showToast('Please fill all required fields in Basic Info.', 'error'); setTab('basic'); return; }
    data.status = 'pending';
    data.id = editingId || `comp-${Date.now()}`;
    data.createdAt = new Date().toISOString();
    if (NexusData && typeof NexusData.addCompetition === 'function') {
      NexusData.addCompetition(data);
    } else {
      const cs = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
      cs.unshift(data);
      localStorage.setItem('nexus_competitions', JSON.stringify(cs));
    }
    setSpill({ cls: 'sp-active', label: 'Published' });
    showToast('🚀 Competition created and submitted for review!');
    setTimeout(() => { navigate('/pages/admin/dashboard.html'); }, 2000);
  }

  function loadEdit(id) {
    const c = allComps.find((x) => x.id === id);
    if (!c) return;
    setEditingId(c.id);
    setD({
      ...DEFAULTS,
      name: c.name || '', game: c.game || '', format: c.format || '', startDate: c.startDate || '', endDate: c.endDate || '',
      maxTeams: c.maxTeams || '', teamSize: c.teamSize || '', region: c.region || '', description: c.description || '',
      p1: (c.prizes && c.prizes.first) || '', p2: (c.prizes && c.prizes.second) || '', p3: (c.prizes && c.prizes.third) || '', p4: (c.prizes && c.prizes.fourth) || '',
      mvp: (c.prizes && c.prizes.mvp) || '', spirit: (c.prizes && c.prizes.spirit) || '', note: (c.prizes && c.prizes.note) || '',
    });
    setCoOrgs(Array.isArray(c.coOrganizers) ? [...c.coOrganizers] : []);
    setSpill({ cls: c.status === 'active' ? 'sp-active' : 'sp-pend', label: c.status === 'active' ? 'Active' : 'Editing' });
    setPubLabel('✔ Update Competition');
    setTab('basic');
    showToast(`Loaded "${c.name}" for editing.`);
  }

  function editOrgs(id) { loadEdit(id); setTab('organizers'); }

  function archiveComp(id) {
    if (!window.confirm('Archive this competition? It will be hidden from public listing.')) return;
    const cs = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
    const i = cs.findIndex((c) => c.id === id);
    if (i !== -1) { cs[i].status = 'archived'; localStorage.setItem('nexus_competitions', JSON.stringify(cs)); }
    loadML();
    showToast('Competition archived.', 'warning');
  }

  const filteredComps = mSearch ? allComps.filter((c) => String(c.name || '').toLowerCase().includes(mSearch.toLowerCase())) : allComps;

  const Tab = ({ id, num, label }) => (
    <button className={`step-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}><span className="snum">{num}</span>{label}</button>
  );

  return (
    <main className="mc-page">
      <style>{CSS}</style>
      <Link to="/pages/admin/dashboard.html" className="back-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Dashboard
      </Link>

      <div className="mc-header">
        <div>
          <h1 className="mc-title">Add / <span>Manage</span> Competition</h1>
          <p className="mc-sub">Create tournaments, assign co-organizers, configure rules and prize pools.</p>
        </div>
        <span className={`spill ${spill.cls}`} id="spill">{spill.label}</span>
      </div>

      <div className="step-tabs">
        <Tab id="basic" num="1" label="Basic Info" />
        <Tab id="settings" num="2" label="Settings" />
        <Tab id="organizers" num="3" label="Organizers" />
        <Tab id="prizes" num="4" label="Prize Pool" />
        <Tab id="manage" num="5" label="Manage Existing" />
      </div>

      {tab === 'basic' && (
        <div className="tab-panel active">
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 2h11l-1.5 7a5 5 0 0 1-8 0L4.5 2z" /><path d="M2.5 2h2m13 0h2" /><path d="M10 16v2m-3 0h6" /></svg></div>
              <div><div className="sec-title">Basic Information</div><div className="sec-desc">Core details about your competition</div></div>
            </div>
            <div className="fg1" style={{ marginBottom: 20 }}>
              <div className="fg"><label className="fl" htmlFor="cn">Competition Name <span className="r">*</span></label><input className="fi" type="text" id="cn" placeholder="e.g. Summer Showdown 2026" value={d.name} onChange={(e) => { set('name', e.target.value); }} onInput={onChange} /></div>
            </div>
            <div className="fg2" style={{ marginBottom: 20 }}>
              <div className="fg"><label className="fl" htmlFor="cg">Game <span className="r">*</span></label>
                <select className="fs" id="cg" value={d.game} onChange={(e) => { set('game', e.target.value); onChange(); }}>
                  <option value="">Select game…</option>
                  {['Counter-Strike 2', 'League of Legends', 'Dota 2', 'Valorant', 'Fortnite', 'Rocket League', 'PUBG Mobile', 'Free Fire'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl" htmlFor="cf">Format <span className="r">*</span></label>
                <select className="fs" id="cf" value={d.format} onChange={(e) => { set('format', e.target.value); onChange(); }}>
                  <option value="">Select format…</option>
                  {['Single Elimination', 'Double Elimination', 'Round Robin', 'Swiss System', 'Battle Royale'].map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="fg2" style={{ marginBottom: 20 }}>
              <div className="fg"><label className="fl" htmlFor="cs">Start Date <span className="r">*</span></label><input className="fi" type="datetime-local" id="cs" value={d.startDate} onChange={(e) => { set('startDate', e.target.value); onChange(); }} /></div>
              <div className="fg"><label className="fl" htmlFor="ce">End Date <span className="r">*</span></label><input className="fi" type="datetime-local" id="ce" value={d.endDate} onChange={(e) => { set('endDate', e.target.value); onChange(); }} /></div>
            </div>
            <div className="fg3" style={{ marginBottom: 20 }}>
              <div className="fg"><label className="fl" htmlFor="cmt">Max Teams</label><input className="fi" type="number" id="cmt" placeholder="e.g. 16" min="2" value={d.maxTeams} onChange={(e) => set('maxTeams', e.target.value)} /></div>
              <div className="fg"><label className="fl" htmlFor="cts">Team Size</label><input className="fi" type="number" id="cts" placeholder="e.g. 5" min="1" max="10" value={d.teamSize} onChange={(e) => set('teamSize', e.target.value)} /></div>
              <div className="fg"><label className="fl" htmlFor="crg">Region</label>
                <select className="fs" id="crg" value={d.region} onChange={(e) => set('region', e.target.value)}>
                  <option value="">All Regions</option>
                  {['Asia-Pacific', 'South Asia', 'North America', 'Europe', 'Middle East', 'Global'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="fg1">
              <div className="fg"><label className="fl" htmlFor="cd">Description <span className="r">*</span></label>
                <textarea className="fta" id="cd" rows="4" placeholder="Describe your tournament — rules, schedule, eligibility, and prize conditions…" value={d.description} onChange={(e) => { set('description', e.target.value); }} onInput={onChange} />
              </div>
            </div>
          </div>
          <div className="abar">
            <div className="abar-l"><span className="fhint">Fill all required fields before publishing.</span></div>
            <div className="abar-r">
              <button className="btn btn-o" onClick={saveDraft}>💾 Save Draft</button>
              <button className="btn btn-a" onClick={() => setTab('settings')}>Next: Settings →</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="tab-panel active">
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg></div>
              <div><div className="sec-title">Registration &amp; Access</div><div className="sec-desc">Control how players and teams join your competition</div></div>
            </div>
            {[
              ['openReg', 'Open Registration', 'Any team can sign up without manual approval'],
              ['requireVerify', 'Require Team Verification', 'Teams must be verified before they can register'],
              ['publicListed', 'Publicly Listed', 'Show this competition on the public competitions page'],
              ['streaming', 'Enable Live Streaming', 'Allow matches to be streamed via the Watch Live section'],
              ['disputes', 'Allow Dispute Filing', 'Participants can file match disputes for organizer review'],
              ['autoPublish', 'Auto-Publish Results', 'Match results are published immediately after submission'],
            ].map(([key, label, desc]) => (
              <div className="trow" key={key}>
                <div className="tinfo"><div className="tlbl">{label}</div><div className="tdesc">{desc}</div></div>
                <label className="tsw"><input type="checkbox" checked={d[key]} onChange={(e) => set(key, e.target.checked)} /><div className="ttrack"></div></label>
              </div>
            ))}
          </div>
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></div>
              <div><div className="sec-title">Entry Fee &amp; Financial</div><div className="sec-desc">Configure participation fees and platform charges</div></div>
            </div>
            <div className="fg2">
              <div className="fg"><label className="fl">Entry Fee (₹)</label><input className="fi" type="number" id="ef" placeholder="0 for free" min="0" value={d.entryFee} onChange={(e) => set('entryFee', e.target.value)} /><span className="fhint">Set to 0 for a free-to-enter competition</span></div>
              <div className="fg"><label className="fl">Platform Fee (%)</label><input className="fi" type="number" id="pf" placeholder="e.g. 10" min="0" max="50" value={d.platformFee} onChange={(e) => set('platformFee', e.target.value)} /><span className="fhint">Percentage of entry fees retained by platform</span></div>
            </div>
          </div>
          <div className="abar">
            <div className="abar-l"><button className="btn btn-o" onClick={() => setTab('basic')}>← Back</button></div>
            <div className="abar-r">
              <button className="btn btn-o" onClick={saveDraft}>💾 Save Draft</button>
              <button className="btn btn-a" onClick={() => setTab('organizers')}>Next: Organizers →</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'organizers' && (
        <div className="tab-panel active">
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
              <div><div className="sec-title">Head Organizer</div><div className="sec-desc">Primary organizer responsible for this competition</div></div>
            </div>
            <div className="coorg-card" style={{ background: '#0d1a00', borderColor: 'rgba(198,255,51,0.2)' }}>
              <div className="coorg-av" id="hav">{String(headUser).charAt(0).toUpperCase()}</div>
              <div className="coorg-info"><div className="coorg-name" id="hname">{headUser}</div><div className="coorg-role" id="hemail">{headEmail || 'Organizer account'}</div></div>
              <span className="badge ba">👑 Head Organizer</span>
            </div>
          </div>

          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico" style={{ background: 'rgba(251,146,60,0.12)', borderColor: 'rgba(251,146,60,0.25)', color: '#fb923c' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
              </div>
              <div style={{ flex: 1 }}><div className="sec-title">Co-Organizers</div><div className="sec-desc">Additional organizers who help manage this competition</div></div>
              <button className="btn btn-o btn-sm" id="add-btn" onClick={() => setAddOpen((o) => !o)}>{addOpen ? '✕ Close' : '➕ Add Co-Organizer'}</button>
            </div>

            <div className={`add-panel ${addOpen ? 'open' : ''}`} id="add-panel">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--td)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search by Username or Email</div>
              <div className="su-row">
                <div className="fg"><input className="fi" type="text" id="cs-inp" placeholder="e.g. john_doe or john@example.com" value={csInp} onChange={(e) => setCsInp(e.target.value)} /></div>
                <button className="btn btn-o btn-sm" onClick={closeAdd} style={{ flexShrink: 0, height: 42 }}>Cancel</button>
              </div>
              <div className={`sres ${searchResults.length || (csInp.length >= 2) ? 'vis' : ''}`} id="sres">
                {csInp.length >= 2 && searchResults.length === 0 && <div className="sri"><div className="sri-n">No matching users found</div></div>}
                {searchResults.map((a) => (
                  <div className="sri" key={a.username} onClick={() => { addCoOrg(a.username, a.email || ''); closeAdd(); }}>
                    <div><div className="sri-n">@{a.username}</div><div className="sri-e">{a.email || 'No email'} · {a.role || 'user'}</div></div>
                    <button className="btn btn-a btn-sm">+ Add</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--td)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Or assign by username directly</div>
                <div className="su-row">
                  <div className="fg"><input className="fi" type="text" id="cd-inp" placeholder="Enter exact username" value={cdInp} onChange={(e) => setCdInp(e.target.value)} /></div>
                  <button className="btn btn-a btn-sm" onClick={addDirect} style={{ flexShrink: 0, height: 42 }}>+ Assign</button>
                </div>
              </div>
            </div>

            <div className="coorg-list" id="coorg-list">
              {coOrgs.length === 0 && (
                <div className="empty" id="coorg-empty"><div className="empty-ico">👥</div><div className="empty-t">No co-organizers assigned</div><div className="empty-s">Click "+ Add Co-Organizer" to assign helpers</div></div>
              )}
              {coOrgs.map((c) => (
                <div className="coorg-card" key={c.username}>
                  <div className="coorg-av">{String(c.username).charAt(0).toUpperCase()}</div>
                  <div className="coorg-info"><div className="coorg-name">@{c.username}</div><div className="coorg-role">{c.email || 'Co-Organizer'}</div></div>
                  <div className="coorg-acts">
                    <span className="badge bo">Co-Organizer</span>
                    <button className="btn btn-r btn-sm" onClick={() => { setCoOrgs((list) => list.filter((x) => x.username !== c.username)); showToast(`@${c.username} removed.`, 'warning'); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div><div className="sec-title">Co-Organizer Permissions</div><div className="sec-desc">Define what co-organizers are allowed to do</div></div>
            </div>
            {[
              ['pm', 'Can Manage Matches', 'Schedule and update match results'],
              ['pt', 'Can Approve Teams', 'Accept or reject team registrations'],
              ['pd', 'Can Review Disputes', 'View and action dispute filings'],
              ['pw', 'Can Issue Warnings', 'Issue conduct warnings to players'],
            ].map(([key, label, desc]) => (
              <div className="trow" key={key}>
                <div className="tinfo"><div className="tlbl">{label}</div><div className="tdesc">{desc}</div></div>
                <label className="tsw"><input type="checkbox" checked={d[key]} onChange={(e) => set(key, e.target.checked)} /><div className="ttrack"></div></label>
              </div>
            ))}
          </div>

          <div className="abar">
            <div className="abar-l"><button className="btn btn-o" onClick={() => setTab('settings')}>← Back</button></div>
            <div className="abar-r">
              <button className="btn btn-o" onClick={saveDraft}>💾 Save Draft</button>
              <button className="btn btn-a" onClick={() => setTab('prizes')}>Next: Prize Pool →</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'prizes' && (
        <div className="tab-panel active">
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg></div>
              <div><div className="sec-title">Prize Pool Distribution</div><div className="sec-desc">Set prize amounts for each placement</div></div>
            </div>
            <div className="pr"><div className="pp">🥇</div><div className="pl">1st Place</div><input className="pi" type="number" id="p1" placeholder="₹ 0" min="0" value={d.p1} onChange={(e) => set('p1', e.target.value)} /></div>
            <div className="pr"><div className="pp">🥈</div><div className="pl">2nd Place</div><input className="pi" type="number" id="p2" placeholder="₹ 0" min="0" value={d.p2} onChange={(e) => set('p2', e.target.value)} /></div>
            <div className="pr"><div className="pp">🥉</div><div className="pl">3rd Place</div><input className="pi" type="number" id="p3" placeholder="₹ 0" min="0" value={d.p3} onChange={(e) => set('p3', e.target.value)} /></div>
            <div className="pr"><div className="pp" style={{ fontSize: 14, color: 'var(--tm)' }}>4th</div><div className="pl">4th Place</div><input className="pi" type="number" id="p4" placeholder="₹ 0" min="0" value={d.p4} onChange={(e) => set('p4', e.target.value)} /></div>
            <div className="divider"></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--td)' }}>Total Prize Pool</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }} id="ptotal">₹{totalPrize.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico" style={{ background: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.2)', color: '#fb923c' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
              <div><div className="sec-title">Additional Prizes &amp; Incentives</div><div className="sec-desc">MVP awards, special recognition, and bonus rewards</div></div>
            </div>
            <div className="fg2" style={{ marginBottom: 20 }}>
              <div className="fg"><label className="fl">MVP Award</label><input className="fi" type="text" id="pmvp" placeholder="e.g. ₹5,000 + Trophy" value={d.mvp} onChange={(e) => set('mvp', e.target.value)} /></div>
              <div className="fg"><label className="fl">Best Team Spirit Award</label><input className="fi" type="text" id="psp" placeholder="e.g. Merchandise Pack" value={d.spirit} onChange={(e) => set('spirit', e.target.value)} /></div>
            </div>
            <div className="fg1">
              <div className="fg"><label className="fl">Sponsor / Prizes Note</label><textarea className="fta" id="pnt" rows="2" placeholder="Additional notes about prizes, sponsors, or delivery timelines…" value={d.note} onChange={(e) => set('note', e.target.value)} /></div>
            </div>
          </div>
          <div className="abar">
            <div className="abar-l"><button className="btn btn-o" onClick={() => setTab('organizers')}>← Back</button></div>
            <div className="abar-r">
              <button className="btn btn-o" onClick={saveDraft}>💾 Save Draft</button>
              <button className="btn btn-a" id="pub-btn" onClick={submitComp}>{pubLabel}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'manage' && (
        <div className="tab-panel active">
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /></svg></div>
              <div style={{ flex: 1 }}><div className="sec-title">Your Competitions</div><div className="sec-desc">Edit, manage organizers, or archive existing competitions</div></div>
              <input className="fi" type="text" id="msearch" placeholder="Search competitions…" value={mSearch} onChange={(e) => setMSearch(e.target.value)} style={{ width: 240 }} />
            </div>
            <div className="ml" id="mlist">
              {filteredComps.length === 0 && (
                <div className="empty"><div className="empty-ico">🏆</div><div className="empty-t">No competitions found</div><div className="empty-s">Create a new competition using the tabs above</div></div>
              )}
              {filteredComps.map((c) => {
                const nc = Array.isArray(c.coOrganizers) ? c.coOrganizers.length : 0;
                return (
                  <div className="mc" key={c.id}>
                    <div className="mc-ico">{GAME_EMOJI[c.game] || '🏆'}</div>
                    <div className="mc-info"><div className="mc-name">{c.name || 'Untitled'}</div><div className="mc-meta">{c.game || '—'} · {c.format || '—'} · {nc} co-organizer{nc !== 1 ? 's' : ''}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
                      {c.status === 'active' ? <span className="badge ba">⚡ Active</span> : c.status === 'pending' ? <span className="badge bo">⏳ Pending</span> : <span className="badge" style={{ background: '#1f1f1f', color: '#737373', border: '1px solid #333' }}>Draft</span>}
                    </div>
                    <div className="mc-acts">
                      <Link className="btn btn-o btn-sm" to={`/pages/organizer-revenue.html?id=${encodeURIComponent(c.id)}`}>Revenue</Link>
                      <button className="btn btn-o btn-sm" onClick={() => loadEdit(c.id)}>✏️ Edit</button>
                      <button className="btn btn-o btn-sm" onClick={() => editOrgs(c.id)}>👥 Organizers</button>
                      <button className="btn btn-r btn-sm" onClick={() => archiveComp(c.id)}>🗃️ Archive</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


