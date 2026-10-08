'use client';
import { useState } from 'react';
import { api, useApi, inr } from '@/lib/client';

const KIND = { own: 'Seller', client: 'Client', vendor: 'Vendor' };
const PILL = { own: 'p-acc', client: 'p-good', vendor: 'p-warn' };
const blank = (kind) => ({ name: '', brand_name: '', kind, gstin: '', pan: '', tax_id: '', address: '', state: '', currency: 'INR', credit_days: 0, contacts: [{ name: '', phone: '', email: '' }], seller_ids: [] });

export default function Companies() {
  const [kind, setKind] = useState(''); const [s, setS] = useState('');
  const { data, reload } = useApi(`/companies?${new URLSearchParams(Object.entries({ kind, q: s }).filter(([, v]) => v))}`);
  const { data: sellers } = useApi('/companies?kind=own&all=1');
  const [e, setE] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  async function save() {
    try { await api(e.id ? '/companies/' + e.id : '/companies', { method: e.id ? 'PUT' : 'POST', body: e }); setMsg(`${KIND[e.kind]} saved.`); setE(null); setErr(''); reload(); }
    catch (x) { setErr(x.message); }
  }
  async function del(c) { try { const r = await api('/companies/' + c.id, { method: 'DELETE' }); setMsg(r.archived ? `${c.name} has invoices, so it was archived.` : `${c.name} deleted.`); setErr(''); reload(); } catch (x) { setMsg(''); setErr(x.message); } }
  const S = (k) => (ev) => setE({ ...e, [k]: ev.target.value });
  const setPoc = (i, k, v) => setE({ ...e, contacts: e.contacts.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const toggleSeller = (id) => setE({ ...e, seller_ids: e.seller_ids.includes(id) ? e.seller_ids.filter((x) => x !== id) : [...e.seller_ids, id] });
  const edit = (c) => { setE({ ...blank(c.kind), ...c, brand_name: c.brand_name || '', gstin: c.gstin || '', pan: c.pan || '', tax_id: c.tax_id || '', address: c.address || '', state: c.state || '', contacts: c.contacts?.length ? c.contacts : [{ name: '', phone: '', email: '' }], seller_ids: (c.sellers || []).map((x) => x.id) }); setErr(''); setMsg(''); };
  const add = (k) => { setE({ ...blank(k), seller_ids: k === 'own' ? [] : (sellers || []).length === 1 ? [sellers[0].id] : [] }); setErr(''); setMsg(''); };
  return <>
    <div className="bar"><h2>Companies</h2>
      <div className="filters"><button className="btn pri" onClick={() => add('client')}>+ Add client</button><button className="btn pri" onClick={() => add('vendor')}>+ Add vendor</button><button className="btn" onClick={() => add('own')}>+ Add seller</button></div></div>
    <div className="filters"><div className="fld"><label htmlFor="k">Type</label><select id="k" value={kind} onChange={(x) => setKind(x.target.value)}><option value="">All</option><option value="own">Sellers</option><option value="client">Clients</option><option value="vendor">Vendors</option></select></div>
      <div className="fld"><label htmlFor="s">Search</label><input id="s" placeholder="name, brand, GSTIN, contact" value={s} onChange={(x) => setS(x.target.value)} /></div></div>
    {msg && <div className="ok-box">{msg}</div>}{err && !e && <div className="err-box">{err}</div>}
    <div className="split w">
      <div className="card scroll"><table><thead><tr><th>Name</th><th>Type</th><th>Contacts</th><th>Seller(s)</th><th className="n">Balance</th><th /></tr></thead><tbody>
        {(data || []).map((c) => <tr key={c.id}>
          <td><b>{c.name}</b>{c.brand_name && <span className="fx">{c.brand_name}</span>}<span className="fx">{c.gstin || c.tax_id || ''}</span></td>
          <td><span className={'pill ' + PILL[c.kind]}>{KIND[c.kind]}</span></td>
          <td>{(c.contacts || []).map((p, i) => <span key={i} className="fx" style={{ color: 'var(--ink)' }}>{p.name}{p.phone ? ' · ' + p.phone : ''}{p.email ? ' · ' + p.email : ''}</span>)}</td>
          <td>{c.kind === 'own' ? '—' : (c.sellers || []).map((x) => x.name).join(', ') || <span className="note">none</span>}</td>
          <td className="n">{c.kind === 'own' ? '' : inr(c.balance)}</td>
          <td style={{ whiteSpace: 'nowrap' }}><button className="btn" onClick={() => edit(c)}>Edit</button> <button className="btn dng" onClick={() => del(c)}>Delete</button></td></tr>)}
        {data && !data.length && <tr><td colSpan="6" className="note">Nothing here yet. Add a client or vendor, or upload an invoice and they are created for you.</td></tr>}</tbody></table></div>
      {e && <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><b>{e.id ? 'Edit' : 'Add'} {KIND[e.kind].toLowerCase()}</b>
        <div className="fld"><label htmlFor="ck">Type</label><select id="ck" value={e.kind} onChange={S('kind')}><option value="client">Client</option><option value="vendor">Vendor</option><option value="own">Seller (our company)</option></select></div>
        <div className="fld"><label htmlFor="n">Legal name</label><input id="n" value={e.name} onChange={S('name')} /></div>
        <div className="fld"><label htmlFor="bn">Brand name</label><input id="bn" value={e.brand_name} onChange={S('brand_name')} /></div>
        <div className="lbl">Contact persons (POC)</div>
        {e.contacts.map((p, i) => <div className="poc" key={i}>
          <input className="inp" aria-label="POC name" placeholder="Name" value={p.name} onChange={(x) => setPoc(i, 'name', x.target.value)} />
          <input className="inp" aria-label="POC phone" placeholder="Phone" value={p.phone} onChange={(x) => setPoc(i, 'phone', x.target.value)} />
          <input className="inp" aria-label="POC email" type="email" placeholder="Email" value={p.email} onChange={(x) => setPoc(i, 'email', x.target.value)} />
          <button type="button" className="btn dng" aria-label="Remove contact" onClick={() => setE({ ...e, contacts: e.contacts.filter((_, j) => j !== i) })}>✕</button></div>)}
        <div><button type="button" className="btn" onClick={() => setE({ ...e, contacts: [...e.contacts, { name: '', phone: '', email: '' }] })}>+ Add another contact</button></div>
        {e.kind !== 'own' && <div className="fld"><label>Works with seller(s)</label>
          <div className="checks">{(sellers || []).map((x) => <label key={x.id}><input type="checkbox" checked={e.seller_ids.includes(x.id)} onChange={() => toggleSeller(x.id)} />{x.brand_name || x.name}</label>)}
            {!(sellers || []).length && <span className="note">Add a seller first (our own company).</span>}</div></div>}
        <div className="frow"><div className="fld"><label htmlFor="cc">Currency</label><input id="cc" value={e.currency} onChange={S('currency')} /></div><div className="fld"><label htmlFor="cd">Credit days</label><input id="cd" type="number" value={e.credit_days} onChange={S('credit_days')} /></div></div>
        <div className="frow"><div className="fld"><label htmlFor="g">GSTIN</label><input id="g" value={e.gstin} onChange={S('gstin')} /></div><div className="fld"><label htmlFor="pn">PAN</label><input id="pn" value={e.pan} onChange={S('pan')} /></div></div>
        <div className="fld"><label htmlFor="ti">Other tax ID (EIN, VAT…)</label><input id="ti" value={e.tax_id} onChange={S('tax_id')} /></div>
        <div className="fld"><label htmlFor="ad">Address</label><input id="ad" value={e.address} onChange={S('address')} /></div>
        <div className="fld"><label htmlFor="stt">State</label><input id="stt" value={e.state} onChange={S('state')} /></div>
        {err && <div className="err-box">{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn" onClick={() => setE(null)}>Cancel</button><button className="btn pri" onClick={save}>Save</button></div>
        <p className="note">A company with invoices cannot be deleted by the team. Super Admin can archive it.</p></div>}
    </div>
  </>;
}
