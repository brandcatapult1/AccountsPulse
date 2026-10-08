'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApi, inr2, fdate, fyOf, fyRange, lakh } from '@/lib/client';
import { CompanySelect, FySelect } from '@/components/Filters';

export default function Ledger() {
  const [co, setCo] = useState(''); const [fy, setFy] = useState(fyOf()); const [cur, setCur] = useState('INR');
  const r = fyRange(fy); const { data: cos } = useApi('/companies');
  const { data, error } = useApi(co ? `/ledger?company_id=${co}&from=${r.from}&to=${r.to}` : '/me');
  const L = co && data?.entries ? data : null;
  return <>
    <div className="bar"><h2>Ledger{L ? ` · ${L.company.name}` : ''}</h2></div>
    <div className="filters"><CompanySelect companies={(cos || []).filter((c) => c.kind !== 'own')} value={co} onChange={setCo} all="Choose a company" /><FySelect value={fy} onChange={setFy} />
      <div className="fld"><label>Show</label><div className="seg">{['INR', 'Both'].map((x) => <button key={x} className={cur === x ? 'on' : ''} onClick={() => setCur(x)}>{x === 'Both' ? 'INR + original' : x}</button>)}</div></div></div>
    {!co && <p className="note">Pick a company to see its ledger for {r.label}.</p>}
    {error && co && <div className="err-box">{error}</div>}
    {L && <>
      <div className="kpis"><div className="kpi"><div className="l">Opening</div><div className="v">{lakh(L.opening)}</div></div><div className="kpi"><div className="l">Debits</div><div className="v">{lakh(L.debits)}</div></div><div className="kpi"><div className="l">Credits</div><div className="v">{lakh(L.credits)}</div></div>
        <div className="kpi bad"><div className="l">Closing {L.closing >= 0 ? '(Dr)' : '(Cr)'}</div><div className="v">{lakh(Math.abs(L.closing))}</div></div></div>
      <div className="card scroll"><table><thead><tr><th>Date</th><th>Particulars</th><th>Ref</th><th className="n">Debit ₹</th><th className="n">Credit ₹</th><th className="n">Balance ₹</th></tr></thead><tbody>
        <tr><td /><td><i>Opening balance</i></td><td /><td /><td /><td className="n">{inr2(Math.abs(L.opening))} {L.opening >= 0 ? 'Dr' : 'Cr'}</td></tr>
        {L.entries.map((e) => <tr key={e.id}><td className="mono">{fdate(e.entry_date)}</td><td>{e.account}<span className="fx">{e.narration}{cur === 'Both' && e.currency && e.currency !== 'INR' ? ` · ${e.currency} ${e.total} @ ${e.fx_rate}` : ''}</span></td>
          <td className="mono">{e.invoice_id ? <Link href={'/invoice/' + e.invoice_id} style={{ textDecoration: 'underline' }}>{e.invoice_no}</Link> : ''}</td>
          <td className="n">{Number(e.debit) ? inr2(e.debit) : ''}</td><td className="n">{Number(e.credit) ? inr2(e.credit) : ''}</td><td className="n">{inr2(Math.abs(e.balance))} {e.balance >= 0 ? 'Dr' : 'Cr'}</td></tr>)}
        {!L.entries.length && <tr><td colSpan="6" className="note">No entries in this period.</td></tr>}
      </tbody></table></div></>}
  </>;
}
