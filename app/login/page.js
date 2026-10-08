'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go(e) { e.preventDefault(); setBusy(true); setErr(''); try { await api('/auth/login', { method: 'POST', body: { email, password } }); window.location.href = '/'; } catch (x) { setErr(x.message); setBusy(false); } }
  return <div className="login"><form onSubmit={go} className="card">
    <h2>Accounts Pulse</h2><p className="note">Sign in with the account your Super Admin created for you.</p>
    <div className="fld"><label htmlFor="e">Email</label><input id="e" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
    <div className="fld"><label htmlFor="p">Password</label><input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
    {err && <div className="err-box">{err}</div>}
    <button className="btn pri" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form></div>;
}
