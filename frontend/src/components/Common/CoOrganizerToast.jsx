import React, { useState, useEffect } from 'react';
import NexusTeamWorkflow from '../../services/teamService';
import { showToast } from './Toast';

export default function CoOrganizerToast() {
  const [invites, setInvites] = useState([]);

  const refreshInvites = () => {
    try {
      const sessionRaw = localStorage.getItem('nexus.auth.session');
      if (!sessionRaw) {
        setInvites([]);
        return;
      }
      const session = JSON.parse(sessionRaw);
      if (!session || !session.username) {
        setInvites([]);
        return;
      }

      const rawNotifs = localStorage.getItem('nexus.notifications.items');
      if (!rawNotifs) {
        setInvites([]);
        return;
      }

      const notifications = JSON.parse(rawNotifs || '[]');
      if (!Array.isArray(notifications)) {
        setInvites([]);
        return;
      }

      const userKey = session.username.trim().toLowerCase();
      const pending = notifications.filter(n => {
        return n &&
          n.toUsername && n.toUsername.trim().toLowerCase() === userKey &&
          n.type === 'co-organizer-invite' &&
          n.status === 'pending';
      });

      setInvites(pending);
    } catch (e) {
      console.error('Co-organizer toast check failed:', e);
    }
  };

  useEffect(() => {
    refreshInvites();
    const interval = setInterval(refreshInvites, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = (invite) => {
    const session = NexusTeamWorkflow.getSession();
    const res = NexusTeamWorkflow.decideCoOrganizerInvite({
      compId: invite.meta && invite.meta.compId,
      action: 'accepted'
    });
    NexusTeamWorkflow.updateNotification(
      invite.id,
      { status: 'approved', read: true, body: invite.body + ' (You accepted this invitation.)' },
      session && session.username
    );
    showToast(res.message || 'You are now a co-organizer!', 'success');
    refreshInvites();
  };

  const handleDecline = (invite) => {
    const session = NexusTeamWorkflow.getSession();
    const res = NexusTeamWorkflow.decideCoOrganizerInvite({
      compId: invite.meta && invite.meta.compId,
      action: 'declined'
    });
    NexusTeamWorkflow.updateNotification(
      invite.id,
      { status: 'rejected', read: true, body: invite.body + ' (You declined this invitation.)' },
      session && session.username
    );
    showToast(res.message || 'Invitation declined.', 'error');
    refreshInvites();
  };

  const handleClose = (inviteId) => {
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  if (invites.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {invites.map(invite => {
        const compName = (invite.meta && invite.meta.compName) || 'a competition';
        const invitedBy = (invite.meta && invite.meta.invitedBy) || 'An organizer';

        return (
          <div
            key={invite.id}
            id={`co-org-toast-${invite.id}`}
            style={{
              background: '#0f172a',
              border: '2px solid #c6ff33',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              color: '#f8fafc',
              maxWidth: 420,
              fontFamily: "'Lato', sans-serif"
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: 24, lineHeight: 1 }}>🏆</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#c6ff33', marginBottom: 4 }}>
                  Co-Organizer Invitation
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.4 }}>
                  <strong>@{invitedBy}</strong> added you as a co-organizer for <strong>"{compName}"</strong>.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    id={`accept-co-org-${invite.id}`}
                    onClick={() => handleAccept(invite)}
                    style={{
                      padding: '6px 14px',
                      background: '#c6ff33',
                      color: '#000',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Accept
                  </button>
                  <button
                    id={`decline-co-org-${invite.id}`}
                    onClick={() => handleDecline(invite)}
                    style={{
                      padding: '6px 14px',
                      background: 'rgba(239,68,68,0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.4)',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
              <button
                id={`close-co-org-${invite.id}`}
                onClick={() => handleClose(invite.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
