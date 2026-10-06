import React, { useState, useEffect } from 'react';

export default function WarningModal() {
  const [bannedInfo, setBannedInfo] = useState(null);
  const [warningInfo, setWarningInfo] = useState(null);

  useEffect(() => {
    try {
      const sessionRaw = localStorage.getItem('nexus.auth.session');
      if (!sessionRaw) return;
      const session = JSON.parse(sessionRaw);
      if (!session || !session.username) return;

      const ACCOUNTS_KEY = 'nexus.auth.accounts';
      const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      const uname = session.username.trim().toLowerCase();
      const account = accounts.find(a => (a.username || '').trim().toLowerCase() === uname);

      // Check live team status in competitions
      const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
      let bannedFound = null;

      comps.forEach(comp => {
        if (!comp || !Array.isArray(comp.teams)) return;
        comp.teams.forEach(t => {
          if (!t) return;
          const tStatus = String(t.status || '').toLowerCase();
          if (tStatus === 'banned') {
            let isMember = false;
            const checkUname = val => {
              if (!val) return false;
              const normalizedVal = (typeof val === 'string' ? val : (val.username || val.name || '')).trim().toLowerCase();
              return normalizedVal === uname;
            };
            if (checkUname(t.createdBy) || checkUname(t.leaderId) || checkUname(t.leaderUsername) || checkUname(t.captain)) {
              isMember = true;
            }
            if (Array.isArray(t.members)) {
              t.members.forEach(m => {
                if (checkUname(m)) isMember = true;
              });
            }
            if (Array.isArray(t.players)) {
              t.players.forEach(p => {
                if (checkUname(p)) isMember = true;
              });
            }
            if (isMember) {
              bannedFound = { team: t, comp };
            }
          }
        });
      });

      if (bannedFound) {
        const dismissKey = 'nexus.banned_modal_seen.' + (bannedFound.team.id || bannedFound.team.name || 'default');
        const alreadySeenBanModal = localStorage.getItem(dismissKey);

        if (account && Array.isArray(account.warnings)) {
          let modified = false;
          account.warnings.forEach(w => {
            if (!w.seen) { w.seen = true; modified = true; }
          });
          if (modified) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        }

        if (!alreadySeenBanModal) {
          setBannedInfo({
            ...bannedFound,
            dismissKey
          });
          return;
        }
      }

      // Check unseen account warnings
      if (!account || !Array.isArray(account.warnings)) return;

      const unseenIdx = account.warnings.findIndex(w => !w.seen);
      if (unseenIdx < 0) return;

      const warning = account.warnings[unseenIdx];
      const isTeamWarning = warning.targetType === 'team' || !!warning.teamName || (warning.reason || '').toLowerCase().includes('team') || (warning.reason || '').toLowerCase().includes('organizer warning');

      const totalWarnCount = account.warnings.length;
      const teamWarnCount = warning.teamWarnCount || account.warnings.filter(w => {
        return (w.targetType === 'team' || !!w.teamName) && w.teamName === warning.teamName && w.compId === warning.compId;
      }).length;

      if (isTeamWarning && teamWarnCount >= 3) {
        account.warnings[unseenIdx].seen = true;
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        return;
      }

      setWarningInfo({
        warning,
        unseenIdx,
        isTeamWarning,
        titleText: isTeamWarning ? `TEAM WARNING (${teamWarnCount}/3)` : `PLATFORM WARNING (${totalWarnCount}/3)`,
        bodyText: isTeamWarning
          ? `Your team has received a competition warning (${teamWarnCount}/3).`
          : `You have received a platform warning (${totalWarnCount}/3).`,
        noteText: isTeamWarning
          ? 'Note: Repeated team warnings may result in your team being banned from the tournament.'
          : 'Note: After 3 warnings your account will be permanently banned.'
      });
    } catch (e) {
      console.error('Warning popup check failed:', e);
    }
  }, []);

  const handleDismissBan = () => {
    if (bannedInfo && bannedInfo.dismissKey) {
      localStorage.setItem(bannedInfo.dismissKey, 'true');
    }
    setBannedInfo(null);
  };

  const handleDismissWarning = () => {
    if (warningInfo) {
      try {
        const ACCOUNTS_KEY = 'nexus.auth.accounts';
        const sessionRaw = localStorage.getItem('nexus.auth.session');
        const session = JSON.parse(sessionRaw || '{}');
        const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        const uname = (session.username || '').trim().toLowerCase();
        const account = accounts.find(a => (a.username || '').trim().toLowerCase() === uname);
        if (account && Array.isArray(account.warnings) && account.warnings[warningInfo.unseenIdx]) {
          account.warnings[warningInfo.unseenIdx].seen = true;
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        }
      } catch (e) {}
    }
    setWarningInfo(null);
  };

  if (bannedInfo) {
    return (
      <div
        id="nexus-team-banned-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.85)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            background: '#1a1015',
            border: '2px solid #ef4444',
            borderRadius: 16,
            padding: 40,
            maxWidth: 480,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 0 60px rgba(239,68,68,0.3)'
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ color: '#ef4444', fontSize: 22, marginBottom: 12, fontWeight: 800 }}>TEAM BANNED FROM TOURNAMENT</h2>
          <p style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>
            Your team <strong style={{ color: '#fff' }}>"{bannedInfo.team.name || 'Team'}"</strong> has been banned from <strong style={{ color: '#c6ff33' }}>{bannedInfo.comp.name || 'the tournament'}</strong>.
          </p>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
            Reason: <strong style={{ color: '#f87171' }}>{bannedInfo.team.bannedReason || 'Banned following a resolved dispute.'}</strong><br /><br />
            <span style={{ color: '#c6ff33', fontWeight: 600 }}>Note: Your individual player account remains active on the platform.</span>
          </p>
          <button
            id="nexus-ban-ok-btn"
            onClick={handleDismissBan}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '12px 48px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 8,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 1
            }}
          >
            I UNDERSTAND
          </button>
        </div>
      </div>
    );
  }

  if (warningInfo) {
    return (
      <div
        id="nexus-warning-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.85)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            background: '#1a1a2e',
            border: '2px solid #f59e0b',
            borderRadius: 16,
            padding: 40,
            maxWidth: 480,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 0 60px rgba(245,158,11,0.3)'
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#f59e0b', fontSize: 22, marginBottom: 12, fontWeight: 800 }}>{warningInfo.titleText}</h2>
          <p style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>{warningInfo.bodyText}</p>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
            Reason: <strong style={{ color: '#f59e0b' }}>{warningInfo.warning.reason || 'Violation of tournament rules'}</strong><br /><br />
            <span style={{ color: '#f87171', fontWeight: 600 }}>{warningInfo.noteText}</span>
          </p>
          <button
            id="nexus-warning-ok-btn"
            onClick={handleDismissWarning}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              padding: '12px 48px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 8,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 1
            }}
          >
            I UNDERSTAND
          </button>
        </div>
      </div>
    );
  }

  return null;
}
