import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusData } from '../services/competitionService';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/subpage.css';
import '../styles/pages/comp-manage-organizers.css';

export default function CompManageOrganizersPage() {
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('id') || 'comp-1';
  const { showToast } = useToast();

  const [currentComp, setCurrentComp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [directUsername, setDirectUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [permissions, setPermissions] = useState({
    matches: true,
    teams: true,
    disputes: true,
    warnings: true
  });

  const loadComp = () => {
    const comp = NexusData.getCompetitionById(compId);
    setCurrentComp(comp ? { ...comp } : null);
  };

  useEffect(() => {
    loadComp();
  }, [compId]);

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    let accs = [];
    try {
      accs = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
    } catch (e) {}

    const ql = q.toLowerCase().replace(/^@/, '');
    const currentOrgs = currentComp && Array.isArray(currentComp.organizers)
      ? currentComp.organizers.map(o => (typeof o === 'string' ? o : o.username || '').toLowerCase())
      : [];

    const hits = accs.filter(a =>
      ((a.username || '').toLowerCase().includes(ql) || (a.email || '').toLowerCase().includes(ql)) &&
      !currentOrgs.includes((a.username || '').toLowerCase())
    ).slice(0, 5);

    setSearchResults(hits);
  };

  const addOrg = async (username) => {
    if (!currentComp || !compId) return;
    const cleanUser = username.trim().replace(/^@/, '');

    if (NexusData.addCoOrganizer) {
      const res = NexusData.addCoOrganizer(compId, cleanUser);
      if (!res.ok) {
        showToast(res.error || 'Unable to add co-organizer.', 'error');
        return;
      }
    }

    try {
      await fetch(`http://localhost:3000/competitions/${compId}/organizers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'team_lead' },
        body: JSON.stringify({ organizerId: cleanUser })
      }).catch(() => {});
    } catch (e) {}

    setSearchQuery('');
    setSearchResults([]);
    setDirectUsername('');
    loadComp();
    showToast(`Co-Organizer @${cleanUser} added successfully!`);
  };

  const handleDirectAdd = (e) => {
    e.preventDefault();
    const u = directUsername.trim().replace(/^@/, '');
    if (!u) {
      showToast('Please enter a valid username.', 'error');
      return;
    }
    addOrg(u);
  };

  const removeOrg = async (username) => {
    if (!window.confirm(`Remove @${username} as co-organizer from this competition?`)) return;

    if (NexusData.removeCoOrganizer) {
      const res = NexusData.removeCoOrganizer(compId, username);
      if (!res.ok) {
        showToast(res.error || 'Unable to remove co-organizer.', 'error');
        return;
      }
    }

    try {
      await fetch(`http://localhost:3000/competitions/${compId}/organizers/${username}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'team_lead' }
      }).catch(() => {});
    } catch (e) {}

    loadComp();
    showToast(`Co-Organizer @${username} removed from this tournament.`);
  };

  const headOrg = currentComp
    ? ((Array.isArray(currentComp.organizers) && currentComp.organizers[0]) || currentComp.organizerId || currentComp.createdBy || 'Head Organizer')
    : 'Head Organizer';
  const cleanHeadOrg = typeof headOrg === 'string' ? headOrg.replace(/^@/, '') : (headOrg.username || 'Head Organizer');
  const coOrgs = (currentComp && Array.isArray(currentComp.organizers)) ? currentComp.organizers.slice(1) : [];

  return (
    <Shell activeTab="activity">
      <main className="org-main">
          <div className="sub-page-header" style={{ marginBottom: '28px' }}>
            <div className="sub-header-content">
              <h1 className="sub-page-title" style={{ fontSize: '26px' }}>
                Add / <span style={{ color: 'var(--accent)' }}>Manage Organizers</span>
              </h1>
              <p className="sub-page-subtitle" id="comp-sub-title">
                {currentComp ? `${currentComp.name || 'Tournament'} (${currentComp.game || 'Game'})` : 'Competition not found'}
              </p>
            </div>
            <Link className="btn-back" id="btn-back-to-comp" to={`/competition-detail?id=${compId}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="10" y1="3" x2="4" y2="8" />
                <line x1="4" y1="8" x2="10" y2="13" />
              </svg>
              Back to Dashboard
            </Link>
          </div>

          {/* HEAD ORGANIZER CARD */}
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <div className="sec-title">Head Tournament Organizer</div>
                <div className="sec-desc">Primary creator & owner of this competition</div>
              </div>
            </div>
            <div className="coorg-card" style={{ background: '#0d1a00', borderColor: 'rgba(198,255,51,0.25)' }}>
              <div className="coorg-av" id="hav">{cleanHeadOrg.charAt(0).toUpperCase()}</div>
              <div className="coorg-info">
                <div className="coorg-name" id="hname">{cleanHeadOrg}</div>
                <div className="coorg-role" id="hemail">{cleanHeadOrg.toLowerCase()}@nexus.gg · Primary Admin</div>
              </div>
              <span className="badge ba">👑 Head Organizer</span>
            </div>
          </div>

          {/* CO-ORGANIZERS LIST CARD */}
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico" style={{ background: 'rgba(251,146,60,0.12)', borderColor: 'rgba(251,146,60,0.25)', color: '#fb923c' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="sec-title">Co-Organizers</div>
                <div className="sec-desc">Collaborators assigned to assist in running this tournament</div>
              </div>
            </div>

            <div id="coorg-list">
              {coOrgs.length === 0 ? (
                <div className="empty">
                  <div className="empty-ico">👥</div>
                  <div className="empty-t">No co-organizers assigned yet</div>
                  <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--tm)' }}>
                    Use the form below to assign helpers to this tournament.
                  </p>
                </div>
              ) : (
                coOrgs.map((org, index) => {
                  const u = typeof org === 'string' ? org.replace(/^@/, '') : (org.username || org.name || 'Co-Organizer');
                  const email = typeof org === 'object' && org.email ? org.email : `${u.toLowerCase()}@nexus.gg`;
                  return (
                    <div className="coorg-card" key={index}>
                      <div className="coorg-av">{u.charAt(0).toUpperCase()}</div>
                      <div className="coorg-info">
                        <div className="coorg-name">@{u}</div>
                        <div className="coorg-role">{email} · Co-Organizer</div>
                      </div>
                      <div className="coorg-acts">
                        <span className="badge bo">Co-Organizer</span>
                        <button type="button" className="btn btn-r btn-sm" onClick={() => removeOrg(u)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ADD CO-ORGANIZER FORM CARD */}
          <div className="sec-card">
            <div className="sec-head">
              <div className="sec-ico">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div>
                <div className="sec-title">Add New Co-Organizer</div>
                <div className="sec-desc">Search registered users or enter an exact username to assign</div>
              </div>
            </div>

            <div className="fg">
              <label className="fl">Search User by Username / Email</label>
              <input
                className="fi"
                type="text"
                id="cs-inp"
                placeholder="Type username (e.g. user2, alex)..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchQuery.length >= 2 && (
                <div className={`sres ${searchResults.length >= 0 ? 'vis' : ''}`} id="sres">
                  {searchResults.length === 0 ? (
                    <div className="sri">
                      <div className="sri-n">No matching users found</div>
                    </div>
                  ) : (
                    searchResults.map(a => (
                      <div className="sri" key={a.username} onClick={() => addOrg(a.username)}>
                        <div>
                          <div className="sri-n">@{a.username}</div>
                          <div className="sri-e">{a.email || 'No email'} · {a.role || 'user'}</div>
                        </div>
                        <button type="button" className="btn btn-a btn-sm">+ Assign</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
              <span style={{ fontSize: '11px', color: 'var(--tm)', fontWeight: 700, textTransform: 'uppercase' }}>
                Or Enter Directly
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            </div>

            <form onSubmit={handleDirectAdd} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
              <input
                className="fi"
                type="text"
                id="cd-inp"
                placeholder="Enter exact username"
                style={{ flex: 1 }}
                value={directUsername}
                onChange={(e) => setDirectUsername(e.target.value)}
              />
              <button type="submit" className="btn btn-a" style={{ flexShrink: 0 }}>
                + Add Co-Organizer
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tw)', marginBottom: '12px' }}>
                Co-Organizer Role Permissions
              </div>
              <div className="trow">
                <div className="tinfo">
                  <div className="tlbl">Manage Matches &amp; Enter Results</div>
                  <div className="tdesc">Schedule brackets and update completed match scores</div>
                </div>
                <label className="tsw">
                  <input
                    type="checkbox"
                    id="pm"
                    checked={permissions.matches}
                    onChange={(e) => setPermissions({ ...permissions, matches: e.target.checked })}
                  />
                  <div className="ttrack"></div>
                </label>
              </div>
              <div className="trow">
                <div className="tinfo">
                  <div className="tlbl">Approve &amp; Manage Teams</div>
                  <div className="tdesc">Accept or reject team registrations and verify rosters</div>
                </div>
                <label className="tsw">
                  <input
                    type="checkbox"
                    id="pt"
                    checked={permissions.teams}
                    onChange={(e) => setPermissions({ ...permissions, teams: e.target.checked })}
                  />
                  <div className="ttrack"></div>
                </label>
              </div>
              <div className="trow">
                <div className="tinfo">
                  <div className="tlbl">Review Disputes</div>
                  <div className="tdesc">View filed dispute reports from participants</div>
                </div>
                <label className="tsw">
                  <input
                    type="checkbox"
                    id="pd"
                    checked={permissions.disputes}
                    onChange={(e) => setPermissions({ ...permissions, disputes: e.target.checked })}
                  />
                  <div className="ttrack"></div>
                </label>
              </div>
              <div className="trow">
                <div className="tinfo">
                  <div className="tlbl">Issue Warnings</div>
                  <div className="tdesc">Send conduct and tournament warnings to teams</div>
                </div>
                <label className="tsw">
                  <input
                    type="checkbox"
                    id="pw"
                    checked={permissions.warnings}
                    onChange={(e) => setPermissions({ ...permissions, warnings: e.target.checked })}
                  />
                  <div className="ttrack"></div>
                </label>
              </div>
            </div>
          </div>
        </main>
    </Shell>
  );
}
