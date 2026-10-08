'use client';
import { useState } from 'react';
import { useApi, inr, fyOf, fyRange, num } from '@/lib/client';
import { CompanySelect, FySelect } from '@/components/Filters';

const pct = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs((a - b) / Math.abs(b) * 100).toFixed(1)}%` : '—');
export default function PL() {
  const [fy, setFy] = useState(fyOf()); const [co, setCo] = useState('');
  const r = fyRange(fy), p = fyRange(fy - 1); const { data: cos } = useApi('/companies');
  const qs = new URLSearchParams(Object.entries({ from: r.from, to: r.to, pfrom: p.from, pto: p.to, company_id: co }).filter(([, v]) => v)).toString();
  const { data } = useApi('/reports/pl?' + qs);
  const T = data?.totals; const profit = T ? T.income - T.expense : 0, pprofit = T ? T.incomePrev - T.expensePrev : 0;
  const Row = ({ l, bold, soft }) => <tr style={soft ? { background: 'var(--accent-soft)' } : null}><td>{l.account}</td><td className="n">{inr(l.current)}</td><td className="n">{inr(l.previous)}</td><td className="n">{pct(l.current, l.previous)}</td></tr>;
  const max = Math.max(1, ...(data?.months || []).flatMap((m) => [m.income, m.expense]));
  return <>
    <div className="bar"><h2>Profit & Loss</h2></div>
    <div className="filters"><CompanySelect companies={cos} value={co} onChange={setCo} label="Entity" all="All entities" /><FySelect value={fy} onChange={setFy} /></div>
    <p className="note">{r.label} against {p.label}. Built from approved tax invoices only; proformas never count.</p>
    {T && <div className="grid g2">
      <div className="card scroll"><table><thead><tr><th>Particulars (₹)</th><th className="n">{r.label}</th><th className="n">{p.label}</th><th className="n">Change</th></tr></thead><tbody>
        <tr><td><b>Income</b></td><td /><td /><td /></tr>{data.income.map((l) => <Row key={l.account} l={l} />)}
        <tr><td><b>Total income</b></td><td className="n"><b>{inr(T.income)}</b></td><td className="n">{inr(T.incomePrev)}</td><td className="n">{pct(T.income, T.incomePrev)}</td></tr>
        <tr><td><b>Expenses</b></td><td /><td /><td /></tr>{data.expenses.map((l) => <Row key={l.account} l={l} />)}
        <tr><td><b>Total expenses</b></td><td className="n"><b>{inr(T.expense)}</b></td><td className="n">{inr(T.expensePrev)}</td><td className="n">{pct(T.expense, T.expensePrev)}</td></tr>
        <tr style={{ background: 'var(--accent-soft)' }}><td><b>Net profit</b></td><td className="n"><b>{inr(profit)}</b></td><td className="n">{inr(pprofit)}</td><td className="n">{pct(profit, pprofit)}</td></tr>
      </tbody></table></div>
      <div className="card"><h3>Income vs expense, by month</h3><div className="legend"><span><i style={{ background: 'var(--c1)' }} />Income</span><span><i style={{ background: 'var(--c2)' }} />Expense</span></div>
        <svg viewBox="0 0 400 220" width="100%" role="img" aria-label="Monthly income and expense">
          {data.months.map((m, i) => { const gw = 340 / Math.max(data.months.length, 1), x = 46 + i * gw; return <g key={m.m}>
            <rect x={x + 4} y={180 - m.income / max * 150} width={gw / 2 - 6} height={m.income / max * 150} fill="var(--c1)" rx="1.5" /><rect x={x + gw / 2} y={180 - m.expense / max * 150} width={gw / 2 - 6} height={m.expense / max * 150} fill="var(--c2)" rx="1.5" />
            <text x={x + gw / 2} y={196} textAnchor="middle">{m.m.slice(5)}</text></g>; })}
          <line x1="44" x2="392" y1="180" y2="180" stroke="var(--line)" />
        </svg>{!data.months.length && <p className="note">No approved tax invoices in this year yet.</p>}</div>
    </div>}
  </>;
}
