/**
 * NEXUS ESPORTS — Team Settings
 *
 * The captain renames the team or unregisters it. Both go through the backend,
 * which enforces unique names, the start-date lock and refunds.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import { TeamsAPI } from '../../services/api.js';
import TeamHeader, { TeamAvatar } from '../../components/TeamHeader.jsx';
import { Notice, ReasonDialog } from '../../components/ui.jsx';
import { teamGate } from './TeamGate.jsx';
import { showToast } from '../../lib/toast.js';

export default function TeamSettings() {
  const navigate = useNavigate();
  const t = useTeamContext();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [disbandOpen, setDisbandOpen] = useState(false);

  useEffect(() => { if (t.team) setName(t.team.name); }, [t.team?.id, t.team?.name]);

  const gate = teamGate(t, { captainOnly: true, title: 'Team settings' });
  if (gate) return gate;

  const { team, comp, isEnded, isStarted, rosterLocked } = t;
  const trimmed = name.trim();
  const nameError = trimmed.length < 3 ? 'At least 3 characters.' : trimmed.length > 40 ? 'At most 40 characters.' : /[<>]/.test(trimmed) ? 'Cannot contain < or >.' : '';
  const hasFee = comp.feeType !== 'free' && Number(comp.entryFeeAmount) > 0;

  async function save(event) {
    event.preventDefault();
    if (nameError || trimmed === team.name) return;
    setSaving(true);
    const res = await TeamsAPI.update(team.id, { name: trimmed });
    setSaving(false);
    if (!res.ok) { showToast(res.error || 'Unable to rename the team.', 'error'); return; }
    showToast('Team name updated.');
    t.refresh();
  }

  async function disband(reason) {
    const res = await TeamsAPI.disband(team.id, reason, team.memberUsernames || []);
    if (!res.ok) { showToast(res.error || 'Unable to unregister the team.', 'error'); return; }
    setDisbandOpen(false);
    showToast(`${team.name} is unregistered.${hasFee ? ' Every fee paid is refunded.' : ''} Members are notified.`);
    navigate('/pages/my-activity.html');
  }

  return (
    <main className="main-content">
      <TeamHeader t={t} active="settings" />

      <div className="td-two-col">
        <form className="td-panel" onSubmit={save}>
          <h2 className="td-section-title">Team name</h2>
          <p className="td-section-sub" style={{ marginBottom: 16 }}>Names are unique within a competition: 3–40 characters, no &lt; or &gt;.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <TeamAvatar name={trimmed || team.name} size="md" />
            <input id="team-name" type="text" className="form-input" style={{ flex: 1 }} aria-label="Team name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} disabled={isEnded} />
          </div>
          {nameError && <p className="ui-field-error">{nameError}</p>}
          <button type="submit" className="td-btn td-btn-primary" disabled={isEnded || saving || !!nameError || trimmed === team.name}>{saving ? 'Saving…' : 'Save name'}</button>
        </form>

        <aside className="td-panel" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
          <h2 className="td-section-title" style={{ color: '#f87171' }}>Unregister team</h2>
          <p className="td-section-sub" style={{ margin: '6px 0 14px' }}>
            The team leaves {comp.name}. Every member and the organiser are notified{hasFee ? ', and every fee paid for this team is refunded in full' : ''}.
          </p>
          {rosterLocked && <Notice tone="info">{isStarted && !isEnded ? 'The competition has started, so the team can no longer be unregistered. Players can still unregister themselves, without a refund.' : 'This competition has ended.'}</Notice>}
          <button type="button" className="td-btn td-btn-danger" onClick={() => setDisbandOpen(true)} disabled={rosterLocked}>Unregister team</button>
        </aside>
      </div>

      <ReasonDialog
        open={disbandOpen}
        title={`Unregister ${team.name}`}
        description="This cannot be undone. The reason is sent to the organiser and every member."
        placeholder="e.g. Half the roster cannot attend the match days"
        minLength={10}
        confirmLabel="Unregister team"
        onConfirm={disband}
        onClose={() => setDisbandOpen(false)}
      />
    </main>
  );
}
