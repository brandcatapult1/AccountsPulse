'use client';
import { useState } from 'react';
import { api, useApi, inr } from '@/lib/client';

const blank = { name: '', kind: 'client', gstin: '', pan: '', tax_id: '', address: '', state: '', contact: '', currency: 'INR', credit_days: 0 };
export default function Companies() {
  const [kind, setKind] = useState(''); const [s, setS] = useState('');
  const { data, reload } = useApi(`/companies?${new URLSearchParams(Object.entries({ kind, q: s }).filter(([, v]) => v))}`);
  const [e, setE] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  async function save() { try { await api(e.id ? '/companies/' + e.id : '/companies', { method: e.id ? 'PUT' : 'POST', body: e }); setE(null); setErr(''); reload(); } catch (x) { setErr(x.message); } }
  async function del(c) { try { const r = await api('/companies/' + c.id, { method: 'DELETE' }); setMsg(r.archived ? `${c.name} has invoices, so it was archived.` : `${c.name} deleted.`); setErr(''); reload(); } catch (x) { setMsg(''); setErr(x.message); } }
  const S = (k) => (ev) => setE({ ...e, [k]: ev.target.value });
  return <>
    <div className="bar"><h2>Companies</h2><button className="btn pri" onClick={() => { setE({ ...blank }); setErr(''); }}>+ Add company</button></div>
    <div className="filters"><div className="fld"><label htmlFor="k">Type</label><select id="k" value={kind} onChange={(x) => setKind(x.target.value)}><option value="">All</option><option value="own">Own</option><option value="client">Client</option><option value="vendor">Vendor</option></select></div>
      <div className="fld"><label htmlFor="s">Search</label><input id="s" placeholder="name or GSTIN" value={s} onChange={(x) => setS(x.target.value)} /></div></div>
    {msg && <div className="ok-box">{msg}</div>}{err && !e && <div className="err-box">{err}</div>}
    <div className="split w">
      <div className="card scroll"><table><thead><tr><th>Name</th><th>Type</th><th>Tax ID</th><th>Cur.</th><th className="n">Balance</th><th /></tr></thead><tbody>
        {(data || []).map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td><span className={'pill ' + ({ own: 'p-acc', client: 'p-good', vendor: 'p-warn' }[c.kind])}>{c.kind}</span></td><td className="mono">{c.gstin || c.tax_id || '—'}</td><td>{c.currency}</td><td className="n">{inr(c.balance)}</td>
          <td style={{ whiteSpace: 'nowrap' }}><button className="btn" onClick={() => { setE({ ...c, gstin: c.gstin || '', pan: c.pan || '', tax_id: c.tax_id || '', address: c.address || '', state: c.state || '', contact: c.contact || '' }); setErr(''); }}>Edit</button> <button className="btn dng" onClick={() => del(c)}>Delete</button></td></tr>)}
        {data && !data.length && <tr><td colSpan="6" className="note">No companies yet. They are also created automatically when you upload an invoice.</td></tr>}</tbody></table></div>
      {e && <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><b>{e.id ? 'Edit company' : 'Add company'}</b>
        <div className="fld"><label htmlFor="n">Legal name</label><input id="n" value={e.name} onChange={S('name')} /></div>
        <div className="frow"><div className="fld"><label htmlFor="ck">Type</label><select id="ck" value={e.kind} onChange={S('kind')}><option value="own">Own</option><option value="client">Client</option><option value="vendor">Vendor</option></select></div>
          <div className="fld"><label htmlFor="cc">Currency</label><input id="cc" value={e.currency} onChange={S('currency')} /></div><div className="fld"><label htmlFor="cd">Credit days</label><input id="cd" type="number" value={e.credit_days} onChange={S('credit_days')} /></div></div>
        <div className="frow"><div className="fld"><label htmlFor="g">GSTIN</label><input id="g" value={e.gstin} onChange={S('gstin')} /></div><div className="fld"><label htmlFor="pn">PAN</label><input id="pn" value={e.pan} onChange={S('pan')} /></div></div>
        <div className="fld"><label htmlFor="ti">Other tax ID (EIN, VAT…)</label><input id="ti" value={e.tax_id} onChange={S('tax_id')} /></div>
        <div className="fld"><label htmlFor="ad">Address</label><input id="ad" value={e.address} onChange={S('address')} /></div>
        <div className="frow"><div className="fld"><label htmlFor="stt">State</label><input id="stt" value={e.state} onChange={S('state')} /></div><div className="fld"><label htmlFor="ct">Accounts contact</label><input id="ct" value={e.contact} onChange={S('contact')} /></div></div>
        {err && <div className="err-box">{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn" onClick={() => setE(null)}>Cancel</button><button className="btn pri" onClick={save}>Save</button></div>
        <p className="note">A company with invoices cannot be deleted by the team. Super Admin can archive it.</p></div>}
    </div>
  </>;
}
