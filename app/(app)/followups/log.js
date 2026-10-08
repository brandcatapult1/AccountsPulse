'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApi, fdate, inr2, coLabel, fyOf, fyRange } from '@/lib/client';
import { CompanySelect, OwnerSelect, FySelect } from '@/components/Filters';

const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
export default function FollowupLog() {
  const [fy, setFy] = useState(fyOf()); const [co, setCo] = useState(''); const [who, setWho] = useState(''); const [ch, setCh] = useState(''); const r = fyRange(fy);
  const { data: cos } = useApi('/companies'); const { data: me } = useApi('/me'); const { data: team } = useApi('/users');
  const qs = new URLSearchParams(Object.entries({ from: r.from, to: r.to, company_id: co, user_id: who === 'me' ? me?.id : who, channel: ch }).filter(([, v]) => v)).toString();
  const { data, error } = useApi('/reports/followups?' + qs); const R = data?.rows || [];
  const exportCsv = () => { const url = URL.createObjectURL(new Blob([csv([['Date', 'By', 'Client', 'Brand', 'Invoice', 'Channel', 'Note', 'Promised date', 'Pending (INR)'], ...R.map((x) => [x.created_at, x.by_name, x.party_name, x.party_brand, x.invoice_no, x.channel, x.note, x.promised_date, x.due_inr])])], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `followups-${r.label}.csv`; a.click(); URL.revokeObjectURL(url); };
  return <>
    <div className="filters"><FySelect value={fy} onChange={setFy} /><CompanySelect companies={(cos || []).filter((c) => c.kind !== 'own')} value={co} onChange={setCo} all="All clients and vendors" />
      <OwnerSelect user={me} team={team} value={who} onChange={setWho} />
      <div className="fld" style={{ minWidth: 130 }}><label htmlFor="ch">Channel</label><select id="ch" value={ch} onChange={(e) => setCh(e.target.value)}><option value="">All</option><option>Call</option><option>Email</option><option>WhatsApp</option><option>Visit</option></select></div>
      <button className="btn" onClick={exportCsv} disabled={!R.length}>Export CSV</button></div>
    {error && <div className="err-box">{error}</div>}
    {data && <div className="kpis"><div className="kpi"><div className="l">Follow-ups</div><div className="v">{data.total}</div><div className="d">{r.label}</div></div>
      <div className="kpi"><div className="l">Clients chased</div><div className="v">{data.clients}</div></div><div className="kpi"><div className="l">Invoices chased</div><div className="v">{data.invoices}</div></div></div>}
    {data && data.people.length > 0 && <div className="card scroll"><h3>By team member</h3><table><thead><tr><th>Team member</th><th className="n">Follow-ups</th><th className="n">Clients</th><th className="n">Invoices</th><th className="n">With a promised date</th></tr></thead><tbody>
      {data.people.map((p) => <tr key={p.user_id}><td><b>{p.name}</b></td><td className="n">{p.count}</td><td className="n">{p.clients}</td><td className="n">{p.invoices}</td><td className="n">{p.promises}</td></tr>)}</tbody></table></div>}
    <div className="card scroll"><h3>Every follow-up</h3><table><thead><tr><th>When</th><th>By</th><th>Client</th><th>Invoice</th><th>Channel</th><th>Note</th><th>Promised</th><th className="n">Pending ₹</th></tr></thead><tbody>
      {R.map((x) => <tr key={x.id}><td className="mono">{fdate(x.created_at)}</td><td>{x.by_name}</td><td><b>{x.party_name}</b>{x.party_brand && <span className="fx">{x.party_brand}</span>}</td>
        <td className="mono"><Link href={'/invoice/' + x.invoice_id} style={{ textDecoration: 'underline' }}>{x.invoice_no}</Link></td><td>{x.channel}</td><td style={{ maxWidth: 280 }}>{x.note}</td><td className="mono">{fdate(x.promised_date)}</td>
        <td className="n">{x.stage === 'received' ? <span className="pill p-good">Paid</span> : inr2(x.due_inr)}</td></tr>)}
      {data && !R.length && <tr><td colSpan="8" className="note">No follow-ups logged for these filters.</td></tr>}</tbody></table></div>
  </>;
}
