'use client';
import { usePaged, Pager } from '@/components/Pager';
import { useState } from 'react';
import Link from 'next/link';
import { useApi, inr2, lakh, fdate, fyOf, fyRange, TypeBadge } from '@/lib/client';
import { Seg, CompanySelect, FySelect } from '@/components/Filters';

const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function Tds() {
  const [fy, setFy] = useState(fyOf()); const [co, setCo] = useState(''); const [mode, setMode] = useState('deducted'); const r = fyRange(fy);
  const { data: cos } = useApi('/companies');
  const qs = new URLSearchParams(Object.entries({ mode, from: r.from, to: r.to, company_id: co }).filter(([, v]) => v)).toString();
  const { data, error } = useApi('/reports/tds?' + qs);
  const rows = data?.rows || []; const pg = usePaged(rows, qs);
  const exportCsv = () => mode === 'deducted'
    ? download(`tds-${r.label}.csv`, csv([['Date', 'Client', 'Brand', 'PAN', 'Invoice', 'Mode', 'Amount received (INR)', 'TDS (INR)', 'Recorded by'], ...rows.map((x) => [x.paid_on, x.party_name, x.party_brand, x.party_pan, x.invoice_no, x.mode, x.amount_inr, x.tds, x.by_name])]))
    : download(`no-tds-recorded-${r.label}.csv`, csv([['Client', 'Invoice', 'Invoice date', 'Last payment', 'Received (INR)'], ...rows.map((x) => [x.party_name, x.invoice_no, x.invoice_date, x.last_paid_on, x.received_inr])]));
  return <>
    <div className="bar"><h2>TDS report</h2><button className="btn" onClick={exportCsv} disabled={!rows.length}>Export CSV</button></div>
    <div className="filters"><Seg value={mode} onChange={setMode} options={[['deducted', 'TDS deducted'], ['missing', 'Paid, no TDS recorded']]} /><FySelect value={fy} onChange={setFy} />
      <CompanySelect companies={(cos || []).filter((c) => c.kind !== 'own')} value={co} onChange={setCo} all="All clients and vendors" /></div>
    {error && <div className="err-box">{error}</div>}
    {mode === 'deducted' && data && <div className="kpis"><div className="kpi"><div className="l">TDS deducted</div><div className="v">{lakh(data.total)}</div><div className="d">{rows.length} payments · {r.label}</div></div></div>}
    {mode === 'missing' && <p className="note">Tax invoices that have received a payment but where no TDS was entered. Check whether TDS was really not cut, or was left out when recording the payment.</p>}
    <div className="card scroll">{mode === 'deducted'
      ? <table><thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th>Mode</th><th className="n">Received ₹</th><th className="n">TDS ₹</th><th>Recorded by</th></tr></thead><tbody>
        {pg.view.map((x) => <tr key={x.id}><td className="mono">{fdate(x.paid_on)}</td><td><b>{x.party_name}</b>{x.party_brand && <span className="fx">{x.party_brand}</span>}{x.party_pan && <span className="fx">PAN {x.party_pan}</span>}</td>
          <td className="mono"><Link href={'/invoice/' + x.invoice_id} style={{ textDecoration: 'underline' }}>{x.invoice_no}</Link> <TypeBadge t={x.doc_type} /></td><td>{x.mode}</td><td className="n">{inr2(x.amount_inr)}</td><td className="n"><b>{inr2(x.tds)}</b></td><td>{x.by_name}</td></tr>)}
        {data && !rows.length && <tr><td colSpan="7" className="note">No TDS recorded in this period.</td></tr>}</tbody></table>
      : <table><thead><tr><th>Client</th><th>Invoice</th><th>Invoice date</th><th>Last payment</th><th className="n">Received ₹</th></tr></thead><tbody>
        {pg.view.map((x) => <tr key={x.id}><td><b>{x.party_name}</b>{x.party_brand && <span className="fx">{x.party_brand}</span>}</td><td className="mono"><Link href={'/invoice/' + x.id} style={{ textDecoration: 'underline' }}>{x.invoice_no}</Link></td><td className="mono">{fdate(x.invoice_date)}</td><td className="mono">{fdate(x.last_paid_on)}</td><td className="n">{inr2(x.received_inr)}</td></tr>)}
        {data && !rows.length && <tr><td colSpan="5" className="note">Every paid invoice in this period has TDS recorded.</td></tr>}</tbody></table>}<Pager p={pg} /></div>
  </>;
}
