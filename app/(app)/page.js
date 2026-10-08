'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApi, lakh, inr, fyOf, fyRange, TypeBadge, num } from '@/lib/client';
import { CompanySelect, OwnerSelect, FySelect } from '@/components/Filters';

const MN = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
function Chart({ months, fy }) {
  const keys = MN.map((_, i) => { const m = (i + 3) % 12; const y = m >= 3 ? fy : fy + 1; return `${y}-${String(m + 1).padStart(2, '0')}`; });
  const by = Object.fromEntries(months.map((m) => [m.m, m]));
  const max = Math.max(1, ...months.flatMap((m) => [num(m.billed), num(m.collected), num(m.proforma)]));
  const step = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / step) * step;
  const W = 560, H = 220, x0 = 46, base = 180, h = 150, gw = (W - x0 - 8) / 12, bw = 8;
  const y = (v) => base - (v / top) * h;
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Monthly billed, collected and proforma">
    {[0, .25, .5, .75, 1].map((t) => <g key={t}><line x1={x0} x2={W - 8} y1={y(top * t)} y2={y(top * t)} stroke="var(--line)" /><text x={x0 - 5} y={y(top * t) + 3} textAnchor="end">{lakh(top * t).replace('₹ ', '')}</text></g>)}
    {keys.map((k, i) => { const d = by[k] || {}; const gx = x0 + i * gw + (gw - bw * 3 - 4) / 2;
      return <g key={k}>{[[d.billed, 'var(--c1)'], [d.collected, 'var(--c2)'], [d.proforma, 'var(--c3)']].map(([v, c], j) => <rect key={j} x={gx + j * (bw + 2)} y={y(num(v))} width={bw} height={Math.max(num(v) / top * h, 0)} rx="1.5" fill={c} />)}
        <text x={x0 + i * gw + gw / 2} y={198} textAnchor="middle">{MN[i]}</text></g>; })}
  </svg>;
}
export default function Dashboard() {
  const [fy, setFy] = useState(fyOf()); const [co, setCo] = useState(''); const [owner, setOwner] = useState('');
  const r = fyRange(fy);
  const qs = new URLSearchParams(Object.entries({ from: r.from, to: r.to, company_id: co, owner }).filter(([, v]) => v)).toString();
  const { data, error } = useApi('/reports/dashboard?' + qs); const { data: cos } = useApi('/companies'); const { data: me } = useApi('/me'); const { data: team } = useApi('/users');
  const k = data?.kpis; const ag = data?.ageing || {}; const agMax = Math.max(1, ...Object.values(ag));
  return <>
    <div className="bar"><h2>Dashboard</h2></div>
    <div className="filters"><FySelect value={fy} onChange={setFy} /><CompanySelect companies={cos} value={co} onChange={setCo} /><OwnerSelect user={me} team={team} value={owner} onChange={setOwner} /></div>
    {error && <div className="err-box">{error}</div>}
    {k && <>
      <div className="kpis">
        <div className="kpi"><div className="l">Billed (tax)</div><div className="v">{lakh(k.billed)}</div><div className="d">{r.label}</div></div>
        <div className="kpi"><div className="l">Proforma pipeline</div><div className="v">{lakh(k.pipeline)}</div><div className="d">{k.pipeline_n} awaiting payment</div></div>
        <div className="kpi"><div className="l">Collected</div><div className="v up">{lakh(k.collected)}</div><div className="d">incl. TDS {lakh(k.tds)}</div></div>
        <div className="kpi"><div className="l">Outstanding</div><div className="v">{lakh(k.outstanding)}</div><div className="d">{k.outstanding_n} invoices</div></div>
        <div className="kpi bad"><div className="l">Overdue</div><div className="v">{lakh(k.overdue)}</div><div className="d dn">{k.overdue_n} past due</div></div>
        <div className="kpi"><div className="l">Net profit</div><div className="v">{lakh(k.profit)}</div><div className="d">income {lakh(k.income)} − expenses {lakh(k.expenses)}</div></div>
      </div>
      <div className="grid g2">
        <div className="card"><div className="bar"><h3>Billed vs collected</h3><div className="legend"><span><i style={{ background: 'var(--c1)' }} />Billed</span><span><i style={{ background: 'var(--c2)' }} />Collected</span><span><i style={{ background: 'var(--c3)' }} />Proforma</span></div></div><Chart months={data.months} fy={fy} /></div>
        <div className="card"><h3>Pending by age</h3>
          {[['a', '0–30 days', 'var(--good)'], ['b', '31–60 days', 'var(--accent)'], ['c', '61–90 days', 'var(--warn)'], ['d', '90+ days', 'var(--bad)']].map(([x, l, c]) => <div key={x} style={{ marginBottom: 10 }}><div className="bar"><span>{l}</span><span className="mono">{lakh(ag[x])}</span></div><div className="prog"><span style={{ width: (ag[x] / agMax * 100) + '%', background: c }} /></div></div>)}
          {data.fx.length > 0 && <><h3 style={{ marginTop: 14 }}>Foreign currency pending</h3>{data.fx.map((f) => <div className="bar" key={f.currency}><span className="mono">{f.currency} {num(f.orig).toLocaleString('en-IN')}</span><span className="mono">{lakh(f.inr)}</span></div>)}</>}</div>
      </div>
      <div className="grid g2">
        <div className="card scroll"><h3>Biggest dues</h3><table><thead><tr><th>Company</th><th className="n">Due</th><th>Invoices</th></tr></thead><tbody>
          {data.top.map((t) => <tr key={t.name}><td>{t.name}</td><td className="n">{inr(t.due)}</td><td>{t.n}</td></tr>)}{!data.top.length && <tr><td colSpan="3" className="note">Nothing pending.</td></tr>}</tbody></table></div>
        <div className="card scroll"><div className="bar"><h3>Review queue</h3><Link href="/review" className="note" style={{ textDecoration: 'underline' }}>Open</Link></div><table><tbody>
          {data.queue.map((q) => <tr key={q.id}><td className="mono"><Link href={'/invoice/' + q.id}>{q.invoice_no || '—'}</Link></td><td><TypeBadge t={q.doc_type} /></td><td>{q.to_name || q.from_name}</td><td>{q.created_name}</td></tr>)}
          {!data.queue.length && <tr><td className="note">Nothing in review.</td></tr>}</tbody></table></div>
      </div></>}
  </>;
}
