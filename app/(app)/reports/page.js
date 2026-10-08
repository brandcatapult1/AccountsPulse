'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApi, inr, inr2, num, fdate, lakh, fyOf, fyRange, TypeBadge, StageBadge } from '@/lib/client';
import { Seg, CompanySelect, FySelect } from '@/components/Filters';

const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
function download(name, text) { const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

export default function Reports() {
  const [tab, setTab] = useState('pending');
  return <>
    <div className="bar"><h2>Reports</h2></div>
    <div className="filters"><Seg value={tab} onChange={setTab} options={[['pending', 'Pending by client / vendor'], ['items', 'By item']]} /></div>
    {tab === 'pending' ? <Pending /> : <Items />}
  </>;
}

function Pending() {
  const [dir, setDir] = useState('sales'); const [dt, setDt] = useState('tax'); const [stage, setStage] = useState(''); const [co, setCo] = useState(''); const [open, setOpen] = useState({});
  const { data: cos } = useApi('/companies');
  const qs = new URLSearchParams(Object.entries({ direction: dir, doc_type: dt, stage, company_id: co }).filter(([, v]) => v)).toString();
  const { data, error } = useApi('/reports/pending?' + qs);
  const G = data?.groups || []; const who = dir === 'sales' ? 'Client' : 'Vendor';
  const exportCsv = () => download(`pending-${dir}.csv`, csv([[who, 'Brand', 'Invoice', 'Type', 'Invoice date', 'Due date', 'Currency', 'Total', 'Paid', 'Pending', 'Pending (INR)', 'Status'],
    ...G.flatMap((g) => g.invoices.map((i) => [g.name, g.brand_name, i.invoice_no, i.doc_type, i.invoice_date, i.due_date, i.currency, i.total, i.paid, i.due, i.due_inr, i.stage === 'part' ? 'Part paid' : 'Pending']))]));
  return <>
    <div className="filters"><Seg value={dir} onChange={(v) => { setDir(v); setCo(''); }} options={[['sales', 'Clients (we raised)'], ['purchase', 'Vendors (we received)']]} />
      <Seg value={dt} onChange={setDt} options={[['tax', 'Tax invoices'], ['proforma', 'Proforma'], ['', 'Both']]} />
      <Seg value={stage} onChange={setStage} options={[['', 'Pending + part paid'], ['pending', 'Pending'], ['part', 'Part paid']]} />
      <CompanySelect companies={(cos || []).filter((c) => c.kind === (dir === 'sales' ? 'client' : 'vendor'))} value={co} onChange={setCo} all={`All ${who.toLowerCase()}s`} />
      <button className="btn" onClick={exportCsv} disabled={!G.length}>Export CSV</button></div>
    {error && <div className="err-box">{error}</div>}
    {data && <div className="kpis">
      <div className="kpi"><div className="l">Total pending</div><div className="v">{lakh(data.total_inr)}</div><div className="d">{data.invoice_count} invoices · {G.length} {who.toLowerCase()}s</div></div>
      <div className="kpi bad"><div className="l">Of which overdue</div><div className="v">{lakh(data.overdue_inr)}</div><div className="d">past due date</div></div></div>}
    <div className="card scroll"><table><thead><tr><th>{who} (legal name / brand)</th><th>Contact</th><th className="n">Invoices</th><th className="n">Overdue ₹</th><th className="n">Pending ₹</th></tr></thead><tbody>
      {G.map((g) => { const isOpen = open[g.party_id]; const poc = (g.contacts || [])[0]; return [
        <tr key={g.party_id} className="click" onClick={() => setOpen({ ...open, [g.party_id]: !isOpen })}>
          <td><b>{isOpen ? '▾' : '▸'} {g.name}</b>{g.brand_name && <span className="fx">{g.brand_name}</span>}</td>
          <td>{poc ? <>{poc.name}<span className="fx">{[poc.phone, poc.email].filter(Boolean).join(' · ')}</span></> : <span className="note">—</span>}</td>
          <td className="n">{g.invoices.length}</td><td className="n" style={{ color: g.overdue_inr ? 'var(--bad)' : undefined }}>{g.overdue_inr ? inr2(g.overdue_inr) : '—'}</td><td className="n"><b>{inr2(g.due_inr)}</b></td></tr>,
        isOpen && <tr key={g.party_id + 'd'}><td colSpan="5" style={{ background: 'var(--bg)' }}>
          <table><thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th className="n">Total</th><th className="n">Paid</th><th className="n">Pending</th><th>Status</th></tr></thead><tbody>
            {g.invoices.map((i) => <tr key={i.id}><td className="mono"><Link href={'/invoice/' + i.id} style={{ textDecoration: 'underline' }}>{i.invoice_no}</Link> <TypeBadge t={i.doc_type} /></td>
              <td className="mono">{fdate(i.invoice_date)}</td><td className="mono">{fdate(i.due_date)} {i.overdue && <span className="pill p-bad">overdue</span>}</td>
              <td className="n">{i.currency === 'INR' ? inr2(i.total) : `${i.currency} ${inr2(i.total)}`}</td><td className="n">{inr2(i.paid)}</td>
              <td className="n"><b>{i.currency === 'INR' ? inr2(i.due) : `${i.currency} ${inr2(i.due)}`}</b>{i.currency !== 'INR' && <span className="fx">≈ {inr(i.due_inr)}</span>}</td><td><StageBadge s={i.stage} status="approved" /></td></tr>)}
          </tbody></table></td></tr>]; })}
      {data && !G.length && <tr><td colSpan="5" className="note">Nothing pending for these filters.</td></tr>}
    </tbody></table></div>
    <p className="note">Click a name to see its invoices. Totals are in INR; foreign-currency invoices also show the original amount.</p>
  </>;
}

function Items() {
  const [fy, setFy] = useState(fyOf()); const [dir, setDir] = useState('sales'); const [s, setS] = useState(''); const [open, setOpen] = useState({}); const r = fyRange(fy);
  const qs = new URLSearchParams(Object.entries({ direction: dir, from: r.from, to: r.to, q: s }).filter(([, v]) => v)).toString();
  const { data, error } = useApi('/reports/items?' + qs); const R = data?.rows || [];
  const exportCsv = () => download(`items-${dir}-${r.label}.csv`, csv([['Item (head)', 'Invoice', 'Date', 'Party', 'More lines', 'Amount', 'Currency'], ...R.flatMap((x) => x.entries.map((e) => [x.head, e.invoice_no, e.date, e.party, String(e.details || '').replace(/\n/g, ' | '), e.amount, e.currency]))]));
  return <>
    <div className="filters"><Seg value={dir} onChange={setDir} options={[['sales', 'Sales'], ['purchase', 'Purchase']]} /><FySelect value={fy} onChange={setFy} />
      <div className="fld"><label htmlFor="is">Search item</label><input id="is" placeholder="head or detail line" value={s} onChange={(e) => setS(e.target.value)} /></div>
      <button className="btn" onClick={exportCsv} disabled={!R.length}>Export CSV</button></div>
    {error && <div className="err-box">{error}</div>}
    {data && <div className="kpis"><div className="kpi"><div className="l">Total ({r.label})</div><div className="v">{lakh(data.total_inr)}</div><div className="d">{R.length} item heads · approved tax invoices only</div></div></div>}
    <div className="card scroll"><table><thead><tr><th>Item (first line of description)</th><th className="n">Invoices</th><th className="n">Qty</th><th className="n">Amount ₹</th></tr></thead><tbody>
      {R.map((x) => [<tr key={x.head} className="click" onClick={() => setOpen({ ...open, [x.head]: !open[x.head] })}><td><b>{open[x.head] ? '▾' : '▸'} {x.head}</b></td><td className="n">{x.invoices}</td><td className="n">{num(x.qty)}</td><td className="n"><b>{inr2(x.amount_inr)}</b></td></tr>,
        open[x.head] && <tr key={x.head + 'd'}><td colSpan="4" style={{ background: 'var(--bg)' }}><table><tbody>
          {x.entries.map((e, i) => <tr key={i}><td className="mono"><Link href={'/invoice/' + e.invoice_id} style={{ textDecoration: 'underline' }}>{e.invoice_no}</Link><span className="fx">{fdate(e.date)}</span></td><td>{e.party}</td><td style={{ whiteSpace: 'pre-line' }}>{e.details}</td><td className="n">{e.currency} {inr2(e.amount)}</td></tr>)}</tbody></table></td></tr>])}
      {data && !R.length && <tr><td colSpan="4" className="note">No items for these filters. Items appear once tax invoices are approved.</td></tr>}
    </tbody></table></div>
    <p className="note">Items are grouped by the first line of the description, so a head like "Social Media Marketing Services Local" adds up across every invoice.</p>
  </>;
}
