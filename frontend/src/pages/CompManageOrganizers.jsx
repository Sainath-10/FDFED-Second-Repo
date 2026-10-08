/**
 * NEXUS ESPORTS — Add / Manage Organizers
 *
 *
 * external JS): head organizer card, co-organizer list, user search + direct add,
 * remove, and the co-organizer permission toggles.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/subpage.css';

const INLINE_CSS = `
:root { --bg:#0a0a0a; --bg-card:#111; --bg-inset:#181818; --bg-hover:#1e1e1e; --border:#262626; --accent:#c6ff33; --accent-dim:rgba(198,255,51,0.12); --accent-mid:rgba(198,255,51,0.25); --tw:#f5f5f5; --tm:#737373; --td:#a3a3a3; --red:#ef4444; --orange:#fb923c; --font:'Inter',sans-serif; --r:12px; --rs:8px; }
.org-main { padding:36px 48px 60px; max-width:1000px; margin:0 auto; width:100%; box-sizing:border-box; }
.org-title { font-size:26px; font-weight:800; color:var(--tw); letter-spacing:-0.5px; }
.org-sub { color:var(--tm); font-size:14px; margin-top:4px; }
.sec-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r); padding:28px 32px; margin-bottom:24px; }
.sec-head { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
.sec-ico { width:36px; height:36px; border-radius:8px; background:var(--accent-dim); border:1px solid var(--accent-mid); display:flex; align-items:center; justify-content:center; color:var(--accent); flex-shrink:0; }
.sec-title { font-size:16px; font-weight:700; color:var(--tw); }
.sec-desc { font-size:12px; color:var(--tm); margin-top:2px; }
.coorg-card { display:flex; align-items:center; justify-content:space-between; background:var(--bg-inset); border:1px solid var(--border); border-radius:var(--rs); padding:14px 18px; gap:12px; margin-bottom:12px; }
.coorg-av { width:42px; height:42px; border-radius:50%; background:var(--accent-dim); border:1px solid var(--accent-mid); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; color:var(--accent); flex-shrink:0; }
.coorg-info { flex:1; min-width:0; }
.coorg-name { font-size:14px; font-weight:600; color:var(--tw); }
.coorg-role { font-size:12px; color:var(--tm); margin-top:2px; }
.coorg-acts { display:flex; gap:8px; align-items:center; flex-shrink:0; }
.badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; }
.ba { background:var(--accent-dim); color:var(--accent); border:1px solid var(--accent-mid); }
.bo { background:rgba(251,146,60,0.12); color:#fb923c; border:1px solid rgba(251,146,60,0.25); }
.btn { display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:var(--rs); font-family:var(--font); font-size:13px; font-weight:600; cursor:pointer; border:none; text-decoration:none; }
.btn-a { background:var(--accent); color:#000; }
.btn-o { background:transparent; border:1px solid var(--border); color:var(--td); }
.btn-r { background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; }
.btn-sm { padding:6px 12px; font-size:12px; }
.fg { display:flex; flex-direction:column; gap:7px; margin-bottom:14px; }
.fl { font-size:12px; font-weight:600; color:var(--td); text-transform:uppercase; letter-spacing:0.5px; }
.fi { background:var(--bg-inset); border:1px solid var(--border); border-radius:var(--rs); color:var(--tw); font-family:var(--font); font-size:14px; padding:11px 14px; outline:none; width:100%; box-sizing:border-box; }
.sres { margin-top:8px; background:var(--bg-inset); border:1px solid var(--border); border-radius:var(--rs); overflow:hidden; display:none; }
.sres.vis { display:block; }
.sri { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; }
.sri:last-child { border-bottom:none; }
.sri-n { font-size:13px; font-weight:600; color:var(--tw); }
.sri-e { font-size:11px; color:var(--tm); }
.trow { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border); }
.trow:last-child { border-bottom:none; }
.tinfo { flex:1; padding-right:16px; }
.tlbl { font-size:13px; font-weight:600; color:var(--tw); }
.tdesc { font-size:11px; color:var(--tm); margin-top:2px; }
.tsw { position:relative; width:40px; height:22px; flex-shrink:0; }
.tsw input { display:none; }
.ttrack { position:absolute; inset:0; background:#333; border-radius:11px; cursor:pointer; }
.ttrack::after { content:''; position:absolute; top:3px; left:3px; width:16px; height:16px; background:#666; border-radius:50%; }
.tsw input:checked + .ttrack { background:var(--accent); }
.tsw input:checked + .ttrack::after { transform:translateX(18px); background:#000; }
.empty { text-align:center; padding:36px 20px; color:var(--tm); }
.empty-ico { font-size:32px; margin-bottom:8px; opacity:0.5; }
.empty-t { font-size:14px; font-weight:600; color:var(--td); }
`;

export default function CompManageOrganizers() {
  const [params] = useSearchParams();
  const compId = params.get('id') || '';
  const [version, setVersion] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const [direct, setDirect] = useState('');
  const [perms, setPerms] = useState({ pm: true, pt: true, pd: true, pw: true });

  const comp = useMemo(() => (NexusData ? NexusData.getCompetitionById(compId) : null), [compId, version]); // eslint-disable-line react-hooks/exhaustive-deps

  function addOrg(username) {
    if (!comp || !compId) return;
    const cleanUser = String(username).trim().replace(/^@/, '');
    if (NexusData && typeof NexusData.addCoOrganizer === 'function') {
      const res = NexusData.addCoOrganizer(compId, cleanUser);
      if (!res.ok) { showToast(res.error || 'Unable to add co-organizer.', 'error'); return; }
    }
    try {
      fetch(`http://localhost:3000/competitions/${compId}/organizers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'team_lead' },
        body: JSON.stringify({ organizerId: cleanUser }),
      }).catch(() => {});
    } catch (e) { /* ignore */ }
    setSearchQ('');
    setVersion((v) => v + 1);
    showToast(`Co-Organizer @${cleanUser} added successfully!`);
  }

  function removeOrg(username) {
    if (!window.confirm(`Remove @${username} as co-organizer from this competition?`)) return;
    if (NexusData && typeof NexusData.removeCoOrganizer === 'function') {
      const res = NexusData.removeCoOrganizer(compId, username);
      if (!res.ok) { showToast(res.error || 'Unable to remove co-organizer.', 'error'); return; }
    }
    try {
      fetch(`http://localhost:3000/competitions/${compId}/organizers/${username}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'team_lead' },
      }).catch(() => {});
    } catch (e) { /* ignore */ }
    setVersion((v) => v + 1);
    showToast(`Co-Organizer @${username} removed from this tournament.`);
  }

  const headOrg = comp ? ((Array.isArray(comp.organizers) && comp.organizers[0]) || comp.organizerId || comp.createdBy || 'Head Organizer') : 'Organizer';
  const headClean = String(headOrg).replace(/^@/, '');
  const coOrgs = comp && Array.isArray(comp.organizers) ? comp.organizers.slice(1) : [];

  const searchHits = useMemo(() => {
    const ql = searchQ.toLowerCase().replace(/^@/, '');
    if (!ql || ql.length < 2) return null;
    let accs = [];
    try { accs = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]'); } catch (e) { /* ignore */ }
    const currentOrgs = comp && Array.isArray(comp.organizers) ? comp.organizers.map((o) => String(typeof o === 'string' ? o : o.username || '').toLowerCase()) : [];
    return accs.filter((a) => ((a.username || '').toLowerCase().includes(ql) || (a.email || '').toLowerCase().includes(ql))
      && !currentOrgs.includes((a.username || '').toLowerCase())).slice(0, 5);
  }, [searchQ, comp]);

  return (
    <main className="org-main">
      <style>{INLINE_CSS}</style>
      <div className="sub-page-header" style={{ marginBottom: 28 }}>
        <div className="sub-header-content">
          <h1 className="sub-page-title" style={{ fontSize: 26 }}>Add / <span style={{ color: 'var(--accent)' }}>Manage Organizers</span></h1>
          <p className="sub-page-subtitle">{comp ? `${comp.name || 'Tournament'} (${comp.game || 'Game'})` : 'Competition not found'}</p>
        </div>
        <Link className="btn-back" id="btn-back-to-comp" to={`/pages/competition-detail.html?id=${compId}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="sec-card">
        <div className="sec-head">
          <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
          <div><div className="sec-title">Head Tournament Organizer</div><div className="sec-desc">Primary creator &amp; owner of this competition</div></div>
        </div>
        <div className="coorg-card" style={{ background: '#0d1a00', borderColor: 'rgba(198,255,51,0.25)' }}>
          <div className="coorg-av" id="hav">{headClean.charAt(0).toUpperCase()}</div>
          <div className="coorg-info">
            <div className="coorg-name" id="hname">{headClean}</div>
            <div className="coorg-role" id="hemail">{headClean.toLowerCase()}@nexus.gg · Primary Admin</div>
          </div>
          <span className="badge ba">👑 Head Organizer</span>
        </div>
      </div>

      <div className="sec-card">
        <div className="sec-head">
          <div className="sec-ico" style={{ background: 'rgba(251,146,60,0.12)', borderColor: 'rgba(251,146,60,0.25)', color: '#fb923c' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
          </div>
          <div style={{ flex: 1 }}><div className="sec-title">Co-Organizers</div><div className="sec-desc">Collaborators assigned to assist in running this tournament</div></div>
        </div>

        <div id="coorg-list">
          {coOrgs.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">👥</div>
              <div className="empty-t">No co-organizers assigned yet</div>
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--tm)' }}>Use the form below to assign helpers to this tournament.</p>
            </div>
          ) : (
            coOrgs.map((org, i) => {
              const u = typeof org === 'string' ? org.replace(/^@/, '') : (org.username || org.name || 'Co-Organizer');
              const email = typeof org === 'object' && org.email ? org.email : `${u.toLowerCase()}@nexus.gg`;
              return (
                <div className="coorg-card" key={u + i}>
                  <div className="coorg-av">{u.charAt(0).toUpperCase()}</div>
                  <div className="coorg-info">
                    <div className="coorg-name">@{u}</div>
                    <div className="coorg-role">{email} · Co-Organizer</div>
                  </div>
                  <div className="coorg-acts">
                    <span className="badge bo">Co-Organizer</span>
                    <button className="btn btn-r btn-sm" onClick={() => removeOrg(u)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="sec-card">
        <div className="sec-head">
          <div className="sec-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></div>
          <div><div className="sec-title">Add New Co-Organizer</div><div className="sec-desc">Search registered users or enter an exact username to assign</div></div>
        </div>

        <div className="fg">
          <label className="fl">Search User by Username / Email</label>
          <input className="fi" type="text" id="cs-inp" placeholder="Type username (e.g. user2, alex)..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          {searchHits !== null && (
            <div id="sres" className="sres vis">
              {searchHits.length === 0 ? (
                <div className="sri"><div className="sri-n">No matching users found</div></div>
              ) : (
                searchHits.map((a) => (
                  <div className="sri" key={a.username} onClick={() => addOrg(a.username)}>
                    <div>
                      <div className="sri-n">@{a.username}</div>
                      <div className="sri-e">{a.email || 'No email'} · {a.role || 'user'}</div>
                    </div>
                    <button className="btn btn-a btn-sm">+ Assign</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
          <span style={{ fontSize: 11, color: 'var(--tm)', fontWeight: 700, textTransform: 'uppercase' }}>Or Enter Directly</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
          <input className="fi" type="text" id="cd-inp" placeholder="Enter exact username" style={{ flex: 1 }} value={direct} onChange={(e) => setDirect(e.target.value)} />
          <button className="btn btn-a" style={{ flexShrink: 0 }} onClick={() => { const u = direct.trim().replace(/^@/, ''); if (!u) { showToast('Please enter a valid username.', 'error'); return; } addOrg(u); setDirect(''); }}>+ Add Co-Organizer</button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tw)', marginBottom: 12 }}>Co-Organizer Role Permissions</div>
          {[
            { id: 'pm', l: 'Manage Matches & Enter Results', d: 'Schedule brackets and update completed match scores' },
            { id: 'pt', l: 'Approve & Manage Teams', d: 'Accept or reject team registrations and verify rosters' },
            { id: 'pd', l: 'Review Disputes', d: 'View filed dispute reports from participants' },
            { id: 'pw', l: 'Issue Warnings', d: 'Send conduct and tournament warnings to teams' },
          ].map((row) => (
            <div className="trow" key={row.id}>
              <div className="tinfo"><div className="tlbl">{row.l}</div><div className="tdesc">{row.d}</div></div>
              <label className="tsw"><input type="checkbox" checked={perms[row.id]} onChange={(e) => setPerms((p) => ({ ...p, [row.id]: e.target.checked }))} /><div className="ttrack"></div></label>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}


