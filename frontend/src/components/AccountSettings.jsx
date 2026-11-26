/**
 * NEXUS ESPORTS — account settings
 *
 * The same settings on every profile page, all saved on the server:
 * bio and picture, email (current password required) and password.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as AuthService from '../services/auth.js';
import { setSession } from '../store/authSlice.js';
import { AuthAPI } from '../services/api.js';
import { fileToAvatarDataUrl } from '../lib/imageAvatar.js';
import { Notice } from './ui.jsx';
import { showToast } from '../lib/toast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AccountSettings() {
  const session = useSelector((state) => state.auth.session);
  const dispatch = useDispatch();

  // After a save, re-read the account from the server and update the store.
  async function refreshSession() {
    const fresh = await AuthService.refreshFromServer();
    dispatch(setSession(fresh || AuthService.getSession()));
  }
  const [bio, setBio] = useState(session?.bio || '');
  const [email, setEmail] = useState(session?.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => { setBio(session?.bio || ''); setEmail(session?.email || ''); }, [session?.bio, session?.email]);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy('profile');
    const res = await AuthAPI.updateProfile({ bio: bio.trim() });
    setBusy('');
    if (!res.ok) { setErrors({ profile: res.error }); return; }
    setErrors({});
    showToast('Profile saved.');
    refreshSession();
  }

  async function onPicture(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let dataUrl;
    try { dataUrl = await fileToAvatarDataUrl(file); } catch (err) { showToast(err.message, 'error'); return; }
    setBusy('picture');
    const res = await AuthAPI.updateProfile({ profilePicUrl: dataUrl });
    setBusy('');
    if (!res.ok) { showToast(res.error || 'The picture was not saved.', 'error'); return; }
    showToast('Profile picture updated.');
    refreshSession();
  }

  async function removePicture() {
    setBusy('picture');
    const res = await AuthAPI.updateProfile({ profilePicUrl: '' });
    setBusy('');
    if (!res.ok) { showToast(res.error || 'The picture was not removed.', 'error'); return; }
    refreshSession();
  }

  async function saveEmail(event) {
    event.preventDefault();
    const next = email.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) { setErrors({ email: 'Enter a valid email address.' }); return; }
    if (!emailPassword) { setErrors({ email: 'Enter your current password to confirm.' }); return; }
    setBusy('email');
    const res = await AuthAPI.changeEmail(next, emailPassword);
    setBusy('');
    if (!res.ok) { setErrors({ email: res.error }); return; }
    setErrors({});
    setEmailPassword('');
    showToast('Email updated.');
    refreshSession();
  }

  async function savePassword(event) {
    event.preventDefault();
    if (pwd.next.length < 6) { setErrors({ password: 'The new password must be at least 6 characters.' }); return; }
    if (pwd.next !== pwd.confirm) { setErrors({ password: 'The new passwords do not match.' }); return; }
    setBusy('password');
    const res = await AuthAPI.changePassword(pwd.current, pwd.next);
    setBusy('');
    if (!res.ok) { setErrors({ password: res.error }); return; }
    setErrors({});
    setPwd({ current: '', next: '', confirm: '' });
    showToast('Password changed. Use the new one next time you log in.');
  }

  return (
    <div className="ui-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
      <form className="ui-card" onSubmit={saveProfile}>
        <h2 className="ui-card-title">Profile</h2>
        <div className="ui-row-actions" style={{ marginBottom: 14, alignItems: 'center' }}>
          {session?.profilePicUrl
            ? <img src={session.profilePicUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            : <span className="ui-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{String(session?.username || '?').charAt(0).toUpperCase()}</span>}
          <label className="btn-table-secondary" style={{ cursor: 'pointer' }}>
            {busy === 'picture' ? 'Uploading…' : 'Change picture'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPicture} style={{ display: 'none' }} disabled={busy === 'picture'} />
          </label>
          {session?.profilePicUrl && <button type="button" className="btn-table-danger" onClick={removePicture} disabled={busy === 'picture'}>Remove</button>}
        </div>
        <div className="ui-field">
          <label htmlFor="acct-bio">Bio</label>
          <textarea id="acct-bio" className="form-input" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
          <span className="ui-field-help">{bio.length} / 500</span>
        </div>
        {errors.profile && <Notice tone="danger">{errors.profile}</Notice>}
        <button type="submit" className="btn-primary" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
      </form>

      <form className="ui-card" onSubmit={saveEmail}>
        <h2 className="ui-card-title">Email</h2>
        <div className="ui-field">
          <label htmlFor="acct-email">Email address</label>
          <input id="acct-email" className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="ui-field">
          <label htmlFor="acct-email-pwd">Current password</label>
          <input id="acct-email-pwd" className="form-input" type="password" autoComplete="current-password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
        </div>
        {errors.email && <Notice tone="danger">{errors.email}</Notice>}
        <button type="submit" className="btn-primary" disabled={busy === 'email'}>{busy === 'email' ? 'Saving…' : 'Change email'}</button>
      </form>

      <form className="ui-card" onSubmit={savePassword}>
        <h2 className="ui-card-title">Password</h2>
        <div className="ui-field">
          <label htmlFor="acct-pwd-current">Current password</label>
          <input id="acct-pwd-current" className="form-input" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} />
        </div>
        <div className="ui-field">
          <label htmlFor="acct-pwd-new">New password</label>
          <input id="acct-pwd-new" className="form-input" type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} />
        </div>
        <div className="ui-field">
          <label htmlFor="acct-pwd-confirm">Confirm new password</label>
          <input id="acct-pwd-confirm" className="form-input" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} />
        </div>
        {errors.password && <Notice tone="danger">{errors.password}</Notice>}
        <button type="submit" className="btn-primary" disabled={busy === 'password' || !pwd.current}>{busy === 'password' ? 'Saving…' : 'Change password'}</button>
      </form>
    </div>
  );
}
