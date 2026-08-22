import { useState } from 'react';
import { Cloud, CloudDownload, CloudOff, CloudUpload, LogIn, LogOut, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { cloudAccountAvailable, type CloudAuthSession } from './client';

export type CloudViewState = {
  status: 'disconnected' | 'working' | 'connected';
  apiBase: string;
  session?: CloudAuthSession;
  remoteVersion: number;
  remoteUpdatedAt: number;
  message?: string;
};

export function CloudAccountCard({ cloud, onAuthenticate, onLogout, onPull, onPush, onRefreshCampaigns, onDeleteAccount }: {
  cloud: CloudViewState;
  onAuthenticate: (mode: 'login' | 'register', input: { apiBase: string; name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  onLogout: () => Promise<void>;
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  onRefreshCampaigns: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [apiBase, setApiBase] = useState(cloud.apiBase);
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const busy = cloud.status === 'working';

  if (!cloudAccountAvailable() && !cloud.session) return <div className="cloud-account-card cloud-unavailable">
    <div className="cloud-account-head"><CloudOff aria-hidden="true" /><span><strong>Development cloud tools</strong><small>Not part of the Play v1 launch profile</small></span></div>
    <div className="cloud-unavailable-state" role="status">
      <ShieldCheck aria-hidden="true" />
      <span><strong>Cloud is not enabled in this release</strong><small>Scanner, Library, and Track continue to work offline. No connection to a local or remote cloud service will be attempted.</small></span>
    </div>
  </div>;

  if (cloud.session) return <><div className="cloud-account-card connected">
    <div className="cloud-account-head"><Cloud /><span><strong>{cloud.session.organization.name}</strong><small>{cloud.session.user.email} · {cloud.session.organization.role}</small></span><b>Connected</b></div>
    <div className="cloud-sync-state"><ShieldCheck /><span><strong>Manual, tenant-isolated sync</strong><small>{cloud.remoteVersion ? `Cloud version ${cloud.remoteVersion}${cloud.remoteUpdatedAt ? ` · ${new Date(cloud.remoteUpdatedAt).toLocaleString()}` : ''}` : 'No cloud backup created yet'}</small></span></div>
    <div className="cloud-actions">
      <button disabled={busy} onClick={onPull}><CloudDownload /> Pull cloud</button>
      <button disabled={busy} onClick={onPush}><CloudUpload /> Back up now</button>
      <button disabled={busy} onClick={onRefreshCampaigns}><RefreshCw /> Refresh campaigns</button>
    </div>
    {cloud.message && <p className="cloud-message">{cloud.message}</p>}
    <button className="cloud-logout" disabled={busy} onClick={onLogout}><LogOut /> End cloud session</button>
    {cloud.session.organization.role === 'owner' && <button className="cloud-delete" disabled={busy} onClick={() => setDeleteOpen(true)}><Trash2 /> Delete cloud account</button>}
    <small className="cloud-session-note">The access token is kept only in this running app session. QRY does not silently upload local records.</small>
  </div>{deleteOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Delete cloud account">
    <button className="modal-backdrop" onClick={() => { setDeleteOpen(false); setDeletePhrase(''); }} aria-label="Close" />
    <section className="bottom-sheet account-delete-sheet">
      <div className="sheet-handle" aria-hidden="true" />
      <button className="close-button floating" onClick={() => { setDeleteOpen(false); setDeletePhrase(''); }} aria-label="Close"><X /></button>
      <span className="sheet-kicker">PERMANENT DELETION</span>
      <h2>Delete cloud account?</h2>
      <p>QRYverse will permanently remove this organization, members, cloud backups, hosted campaigns, redirects, and aggregate analytics. Local data already on this device stays here.</p>
      <label className="field"><span>Type DELETE to confirm</span><div><Trash2 /><input autoFocus value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} autoComplete="off" /></div></label>
      <button className="solid-button full danger-action" disabled={deletePhrase !== 'DELETE' || busy} onClick={async () => { await onDeleteAccount(); setDeleteOpen(false); setDeletePhrase(''); }}><Trash2 /> Permanently delete</button>
    </section>
  </div>}</>;

  const valid = email.trim() && password.length >= 10 && apiBase.trim() && (mode === 'login' || (name.trim() && organizationName.trim()));
  return <div className="cloud-account-card">
    <div className="cloud-account-head"><Cloud /><span><strong>QRYverse Cloud</strong><small>Accounts, hosted redirects, and cross-device backup</small></span></div>
    <div className="cloud-mode"><button className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => setMode('login')}>Sign in</button><button className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'} onClick={() => setMode('register')}>Create account</button></div>
    <div className="cloud-form">
      {import.meta.env.DEV && <label><span>Service URL</span><input type="url" value={apiBase} onChange={(event) => setApiBase(event.target.value)} placeholder="https://cloud.qryverse.app" /></label>}
      {mode === 'register' && <><label><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label><label><span>Organization</span><input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label></>}
      <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      <label><span>Password</span><input type="password" value={password} minLength={10} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
    </div>
    {cloud.message && <p className="cloud-message error">{cloud.message}</p>}
    <button className="solid-button full" disabled={!valid || busy} onClick={async () => { await onAuthenticate(mode, { apiBase, name, email, password, organizationName }); setPassword(''); }}><LogIn /> {busy ? 'Connecting…' : mode === 'login' ? 'Sign in securely' : 'Create organization'}</button>
    <small className="cloud-session-note">Use HTTPS in production. Local HTTP is accepted only for localhost development.</small>
  </div>;
}
