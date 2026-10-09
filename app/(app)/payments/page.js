'use client';
import { usePaged, Pager } from '@/components/Pager';
import { useState } from 'react';
import Link from 'next/link';
import { api, useApi, inr2, lakh, fdate, fyOf, fyRange, coLabel, TypeBadge } from '@/lib/client';
import { Seg, CompanySelect, FySelect } from '@/components/Filters';
import RecordPayment from '@/components/RecordPayment';

const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
const download = (name, text) => { const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };

export default function Payments() {
  const [tab, setTab] = useState('sales'); const [fy, setFy] = useState(fyOf()); const [co, setCo] = useState(''); const [mode, setMode] = useState(''); const r = fyRange(fy);
  const { data: cos } = useApi('/companies');
  const direction = tab === 'purchase' ? 'purchase' : 'sales';
  const qs = new URLSearchParams(Object.entries({ direction, from: r.from, to: r.to, company_id: co, mode }).filter(([, v]) => v)).toString();
  const { data, error, reload } = useApi('/payments?' + qs);
  const [pick, setPick] = useState(null); const [open, setOpen] = useState(false); const [msg, setMsg] = useState('');
  const { data: pending } = useApi(open ? `/invoices?status=approved&direction=${direction}` : '/me');
  // `pending` briefly holds the previous response (the signed-in user) right after the panel opens, so only trust an array
  const loaded = open && Array.isArray(pending);
  const list = loaded ? pending.filter((i) => i.stage !== 'received') : [];
  const rows = data?.rows || []; const pg = usePaged(rows, qs);
  const word = tab === 'purchase' ? 'Paid' : 'Received';
  const exportCsv = () => download(`${tab === 'purchase' ? 'vendor-payments' : 'receipts'}-${r.label}.csv`, csv([['Date', tab === 'purchase' ? 'Vendor' : 'Client', 'Brand', 'Invoice', 'Mode', 'Account', 'Amount (INR)', 'TDS', 'Details', 'Recorded by'], ...rows.map((x) => [x.paid_on, x.party_name, x.party_brand, x.invoice_no, x.mode, x.account, x.amount_inr, x.tds, Object.values(x.details || {}).filter(Boolean).join(' / '), x.by_name])]));
  return <>
    <div className="bar"><h2>Payments & bank</h2></div>
    <div className="filters"><Seg value={tab} onChange={(v) => { setTab(v); setOpen(false); setPick(null); setMode(''); setCo(''); }} options={[['sales', 'Received from clients'], ['purchase', 'Paid to vendors'], ['summary', 'Bank summary']]} /><FySelect value={fy} onChange={setFy} /></div>
    {msg && <div className="ok-box">{msg}</div>}{error && <div className="err-box">{error}</div>}

    {tab !== 'summary' && <>
      <div className="filters"><button className="btn pri" onClick={() => { setOpen(!open); setPick(null); setMsg(''); }}>{tab === 'purchase' ? '+ Pay a vendor' : '+ Record a receipt'}</button>
        <CompanySelect companies={(cos || []).filter((c) => c.kind === (tab === 'purchase' ? 'vendor' : 'client'))} value={co} onChange={setCo} all={tab === 'purchase' ? 'All vendors' : 'All clients'} />
        <div className="fld" style={{ minWidth: 140 }}><label htmlFor="pm">Mode</label><select id="pm" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">All</option><option>Bank account</option><option>UPI</option><option>Cash</option><option>Cheque</option></select></div>
        <button className="btn" onClick={exportCsv} disabled={!rows.length}>Export CSV</button></div>
      {open && <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="fld"><label htmlFor="inv">Which invoice?</label>
          <select id="inv" value={pick?.id || ''} onChange={(e) => setPick(list.find((i) => i.id === +e.target.value) || null)}><option value="">Choose an invoice…</option>
            {list.map((i) => <option key={i.id} value={i.id}>{i.invoice_no} · {i.party_name}{i.party_brand ? ` (${i.party_brand})` : ''} · due {i.currency} {inr2(i.due)}{i.doc_type === 'proforma' ? ' · proforma' : ''}</option>)}</select>
          {open && !loaded && <span className="note">Loading invoices…</span>}
          {loaded && !list.length && <span className="note">No pending {tab === 'purchase' ? 'vendor' : 'client'} invoices. Approve an invoice first.</span>}</div>
        {pick && <RecordPayment key={pick.id} inv={pick} title={`${tab === 'purchase' ? 'Pay' : 'Receive'} · ${pick.party_name} · ${pick.invoice_no}`} onClose={() => setPick(null)} onDone={() => { setPick(null); setOpen(false); setMsg('Saved to the ledger.'); reload(); }} />}
      </div>}
      {data && <div className="kpis"><div className="kpi"><div className="l">{word} in {r.label}</div><div className="v">{lakh(data.total)}</div><div className="d">{rows.length} payments{data.tds > 0 ? ` · TDS ${lakh(data.tds)}` : ''}</div></div>
        {Object.entries(data.by_mode).map(([m, v]) => <div className="kpi" key={m}><div className="l">{m}</div><div className="v">{lakh(v)}</div></div>)}</div>}
      <div className="card scroll"><table><thead><tr><th>Date</th><th>{tab === 'purchase' ? 'Vendor' : 'Client'}</th><th>Invoice</th><th>Mode / account</th><th>Details</th><th className="n">Amount ₹</th><th className="n">TDS ₹</th><th>By</th></tr></thead><tbody>
        {pg.view.map((x) => <tr key={x.id}><td className="mono">{fdate(x.paid_on)}</td><td><b>{x.party_name}</b>{x.party_brand && <span className="fx">{x.party_brand}</span>}</td>
          <td className="mono"><Link href={'/invoice/' + x.invoice_id} style={{ textDecoration: 'underline' }}>{x.invoice_no}</Link> <TypeBadge t={x.doc_type} /></td>
          <td>{x.mode}<span className="fx">{x.mode === 'Bank account' ? x.account : ''}</span></td>
          <td className="note">{Object.entries(x.details || {}).filter(([k, v]) => v && k !== 'account').map(([, v]) => v).join(' · ')}</td>
          <td className="n"><b>{inr2(x.amount_inr)}</b></td><td className="n">{Number(x.tds) > 0 ? inr2(x.tds) : ''}</td><td>{x.by_name}</td></tr>)}
        {data && !rows.length && <tr><td colSpan="8" className="note">Nothing recorded in {r.label}.</td></tr>}</tbody></table><Pager p={pg} /></div></>}

    {tab === 'summary' && data && <>
      <p className="note">Money in and out of every account in {r.label}: client receipts, vendor payments, petty cash and expenses. Use it to match against your bank statement.</p>
      <div className="card scroll"><table><thead><tr><th>Account</th><th className="n">Money in ₹</th><th className="n">Money out ₹</th><th className="n">Net ₹</th></tr></thead><tbody>
        {data.accounts.map((a) => <tr key={a.account}><td><b>{a.account}</b></td><td className="n">{inr2(a.in)}</td><td className="n">{inr2(a.out)}</td><td className="n" style={{ color: a.in - a.out < 0 ? 'var(--bad)' : 'var(--good)' }}>{inr2(a.in - a.out)}</td></tr>)}
        {!data.accounts.length && <tr><td colSpan="4" className="note">Nothing recorded yet.</td></tr>}
        {data.accounts.length > 0 && <tr style={{ background: 'var(--accent-soft)' }}><td><b>Total</b></td><td className="n"><b>{inr2(data.accounts.reduce((s, a) => s + a.in, 0))}</b></td><td className="n"><b>{inr2(data.accounts.reduce((s, a) => s + a.out, 0))}</b></td><td className="n"><b>{inr2(data.accounts.reduce((s, a) => s + a.in - a.out, 0))}</b></td></tr>}
      </tbody></table></div></>}
  </>;
}
