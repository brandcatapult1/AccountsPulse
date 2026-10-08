'use client';
import { useState } from 'react';
import { api, useApi, fdate } from '@/lib/client';

const ROLE = { admin: 'Super Admin', lead: 'Account Lead', member: 'Accounts' };
export default function Team() {
  const { data: me } = useApi('/me'); const { data, reload } = useApi('/users');
  const [n, setN] = useState({ name: '', email: '', password: '', role: 'member', lead_id: '' }); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const admin = me?.role === 'admin'; const leads = (data || []).filter((u) => u.role === 'lead');
  async function add() { try { await api('/users', { method: 'POST', body: n }); setN({ name: '', email: '', password: '', role: 'member', lead_id: '' }); setErr(''); setMsg('User added.'); reload(); } catch (x) { setErr(x.message); setMsg(''); } }
  async function upd(u, patch) { try { await api('/users/' + u.id, { method: 'PUT', body: patch }); setErr(''); reload(); } catch (x) { setErr(x.message); } }
  return <>
    <div className="bar"><h2>Team</h2></div>
    {err && <div className="err-box">{err}</div>}{msg && <div className="ok-box">{msg}</div>}
    <div className="card scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Reports to</th><th>Status</th><th /></tr></thead><tbody>
      {(data || []).map((u) => <tr key={u.id}><td><b>{u.name}</b></td><td>{u.email}</td>
        <td>{admin ? <select className="inp" aria-label="Role" value={u.role} onChange={(e) => upd(u, { role: e.target.value })}>{Object.entries(ROLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : ROLE[u.role]}</td>
        <td>{admin && u.role === 'member' ? <select className="inp" aria-label="Lead" value={u.lead_id || ''} onChange={(e) => upd(u, { lead_id: +e.target.value || null })}><option value="">No lead</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select> : (data.find((l) => l.id === u.lead_id)?.name || '—')}</td>
        <td><span className={'pill ' + (u.active ? 'p-good' : 'p-bad')}>{u.active ? 'Active' : 'Locked'}</span></td>
        <td>{admin && u.id !== me.id && <button className="btn" onClick={() => upd(u, { active: !u.active })}>{u.active ? 'Lock' : 'Unlock'}</button>}</td></tr>)}
    </tbody></table></div>
    {admin && <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}><b>Add a user</b>
      <div className="frow"><div className="fld"><label htmlFor="un">Name</label><input id="un" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></div><div className="fld"><label htmlFor="ue">Email</label><input id="ue" type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /></div></div>
      <div className="frow"><div className="fld"><label htmlFor="up">Temporary password</label><input id="up" type="text" value={n.password} onChange={(e) => setN({ ...n, password: e.target.value })} /></div>
        <div className="fld"><label htmlFor="ur">Role</label><select id="ur" value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })}>{Object.entries(ROLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        {n.role === 'member' && <div className="fld"><label htmlFor="ul">Reports to</label><select id="ul" value={n.lead_id} onChange={(e) => setN({ ...n, lead_id: e.target.value })}><option value="">No lead</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}</div>
      <div style={{ textAlign: 'right' }}><button className="btn pri" onClick={add}>Add user</button></div>
      <p className="note">An Account Lead sees their own records and everything their team members enter. Super Admin sees everything.</p></div>}
  </>;
}
