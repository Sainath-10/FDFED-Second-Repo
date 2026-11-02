import { useState } from 'react';
import { MatchesAPI } from '../services/api.js';

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(+date)) return '';
  return new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function FixtureEditor({ match, matches, competition, isLeague, onSaved }) {
  const [mode, setMode] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [hostWinnerId, setHostWinnerId] = useState('');
  const tied = score1 !== '' && score2 !== '' && Number(score1) === Number(score2);
  const [dateTime, setDateTime] = useState(() => localDateTime(match.scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const ready = Boolean(match.team1Id && match.team2Id && !['pending', 'bye'].includes(match.status));
  const duration = match.durationMinutes || 60;
  const changeMode = (value) => { setMode(value); setError(''); setMessage(''); };

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    let request;
    if (mode === 'result') {
      const a = Number(score1), b = Number(score2);
      if (!ready || score1 === '' || score2 === '' || ![a, b].every((score) => Number.isSafeInteger(score) && score >= 0)) return setError('Enter a non-negative whole-number score for both teams.');
      if (!isLeague && a === b && ![match.team1Id, match.team2Id].includes(hostWinnerId)) return setError('Select the winner chosen offline by the host.');
      const side = a > b ? 1 : b > a ? 2 : !isLeague ? (hostWinnerId === match.team1Id ? 1 : 2) : 0;
      request = () => MatchesAPI.recordResult(match.id, side ? match[`team${side}Id`] : '', side ? match[`team${side}`] : '', `${a}-${b}`);
    } else {
      const at = +new Date(dateTime);
      if (!dateTime || !Number.isFinite(at)) return setError('Choose a valid date and time.');
      const end = at + duration * 60000;
      if (at < +new Date(competition.startDate) || end > +new Date(competition.endDate)) return setError('The entire match must fit within the competition dates.');
      const conflict = matches.find((other) => other.id !== match.id && other.scheduledAt && other.status !== 'cancelled' && +new Date(other.scheduledAt) < end && at < +new Date(other.scheduledAt) + (other.durationMinutes || 60) * 60000);
      if (conflict) return setError(`Overlaps ${conflict.team1} vs ${conflict.team2}. Each match reserves ${duration} minutes. Choose another time.`);
      request = () => MatchesAPI.reschedule(match.id, new Date(at).toISOString());
    }
    setBusy(true);
    try {
      const response = await request();
      if (!response.ok) throw new Error(Array.isArray(response.error) ? response.error.join(' ') : response.error || 'Unable to save. Try again.');
      setMessage(mode === 'result' ? 'Result saved. The winner advances automatically.' : 'Match time updated.');
      setMode(null);
      onSaved(response.data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="cd-editor">
    {!mode && <div className="cd-editor-actions"><button className="cd-button cd-primary" disabled={!ready || busy} onClick={() => changeMode('result')}>Enter result</button><button className="cd-button" disabled={busy || match.status === 'live'} onClick={() => changeMode('schedule')}>Edit date & time</button></div>}
    {!ready && <p className="cd-detail-hint">Result entry opens when both teams advance into this match.</p>}
    {mode && <form onSubmit={save}>
      <h4>{mode === 'result' ? 'Record final score' : 'Edit date & time'}</h4>
      <fieldset disabled={busy}>
        {mode === 'result' ? <><div className="cd-score-inputs"><label>{match.team1}<input autoFocus type="number" min="0" step="1" required aria-label={`${match.team1} score`} value={score1} onChange={(e) => { setScore1(e.target.value); setHostWinnerId(''); }} /></label><label>{match.team2}<input type="number" min="0" step="1" required aria-label={`${match.team2} score`} value={score2} onChange={(e) => { setScore2(e.target.value); setHostWinnerId(''); }} /></label></div>{tied && !isLeague && <label className="cd-tie-choice">Scores tied: host's offline winner<select required aria-label="Host's offline winner" value={hostWinnerId} onChange={(event) => setHostWinnerId(event.target.value)}><option value="">Choose the host's winner</option><option value={match.team1Id}>{match.team1}</option><option value={match.team2Id}>{match.team2}</option></select></label>}<p className="cd-detail-hint">Saving confirms the final result. Confirmed results cannot be edited.</p></> : <><label>Match starts<input autoFocus type="datetime-local" required value={dateTime} onChange={(e) => setDateTime(e.target.value)} min={localDateTime(competition.startDate)} max={localDateTime(competition.endDate)} /></label><p className="cd-detail-hint">Reserves {duration} minutes. Times are local. Matches must not overlap or cross their next round.</p></>}
        <div className="cd-editor-actions"><button className="cd-button cd-primary" type="submit">{busy ? 'Saving…' : mode === 'result' ? 'Save result' : 'Save time'}</button><button className="cd-button" type="button" onClick={() => changeMode(null)}>Cancel</button></div>
      </fieldset>
    </form>}
    {error && <p className="cd-editor-error" role="alert">{error}</p>}
    {message && <p className="cd-editor-success" role="status">{message}</p>}
  </div>;
}
