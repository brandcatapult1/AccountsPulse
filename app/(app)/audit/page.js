'use client';
import { useState, useEffect } from 'react';
import { useApi } from '@/lib/client';
import { Seg } from '@/components/Filters';
import { Pager } from '@/components/Pager';

const ist = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function Audit() {
  const [f, setF] = useState({ from: '', to: '', from_time: '', to_time: '', user_id: '', action: '', q: '' });
  const [preset, setPreset] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPreset(''); };
  const pick = (p) => { setPreset(p); const t = todayIst(); setF({ ...f, ...(p === 'today' ? { from: t, to: t } : p === '7' ? { from: daysAgo(6), to: t } : p === '30' ? { from: daysAgo(29), to: t } : { from: '', to: '' }) }); };
  const [page, setPage] = useState(1); const [size, setSize] = useState(50);
  const fkey = JSON.stringify(f);
  useEffect(() => { setPage(1); }, [fkey, size]);
  const qs = new URLSearchParams(Object.entries({ ...f, page, page_size: size }).filter(([, v]) => v)).toString();
  const { data, error } = useApi('/audit' + (qs ? '?' + qs : ''));
  const R = data?.rows || []; const total = data?.total || 0; const pages = Math.max(1, Math.ceil(total / size)); const pager = { page, setPage, size, setSize, total, pages, from: total ? (page - 1) * size + 1 : 0, to: Math.min(page * size, total) }; const filtered = Object.values(f).some(Boolean);
  return <>
    <div className="bar"><h2>Audit log</h2>{filtered && <button className="btn" onClick={() => { setF({ from: '', to: '', from_time: '', to_time: '', user_id: '', action: '', q: '' }); setPreset(''); }}>Clear filters</button>}</div>
    <div className="filters"><Seg value={preset} onChange={pick} options={[['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All dates']]} /></div>
    <div className="filters">
      <div className="fld"><label htmlFor="af">From date</label><input id="af" type="date" value={f.from} onChange={set('from')} /></div>
      <div className="fld"><label htmlFor="at">To date</label><input id="at" type="date" value={f.to} onChange={set('to')} /></div>
      <div className="fld"><label htmlFor="aft">From time</label><input id="aft" type="time" value={f.from_time} onChange={set('from_time')} /></div>
      <div className="fld"><label htmlFor="att">To time</label><input id="att" type="time" value={f.to_time} onChange={set('to_time')} /></div>
      <div className="fld" style={{ minWidth: 150 }}><label htmlFor="au">Who</label><select id="au" value={f.user_id} onChange={set('user_id')}><option value="">Everyone</option>{(data?.users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      <div className="fld" style={{ minWidth: 150 }}><label htmlFor="aa">What</label><select id="aa" value={f.action} onChange={set('action')}><option value="">Everything</option>{(data?.actions || []).map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
      <div className="fld"><label htmlFor="aq">Search</label><input id="aq" placeholder="invoice no., amount, id" value={f.q} onChange={set('q')} /></div>
    </div>
    <p className="note">Times are Indian time. A time range is a daily window, for example 09:00 to 18:00 on every day in the date range.</p>
    {error && <div className="err-box">{error}</div>}
    {data && <p className="note"><b>{data.total}</b> entr{data.total === 1 ? 'y' : 'ies'} match</p>}
    <div className="card scroll"><table><thead><tr><th>When (IST)</th><th>Who</th><th>Action</th><th>What</th><th>Detail</th></tr></thead><tbody>
      {R.map((a) => <tr key={a.id}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{ist(a.created_at)}</td><td>{a.user_name}</td><td>{a.action}</td><td className="mono">{a.entity} #{a.entity_id}</td><td className="note">{a.detail ? JSON.stringify(a.detail) : ''}</td></tr>)}
      {data && !R.length && <tr><td colSpan="5" className="note">Nothing matches these filters.</td></tr>}</tbody></table><Pager p={pager} /></div>
  </>;
}
