'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApi, inr2, fdate, fyOf, fyRange, lakh } from '@/lib/client';
import { CompanySelect, FySelect, Seg } from '@/components/Filters';

function AccountLedger() {
  const [acc, setAcc] = useState(''); const [fy, setFy] = useState(fyOf()); const r = fyRange(fy);
  const { data: accounts } = useApi('/ledger/accounts');
  const { data, error } = useApi(acc ? `/ledger/account?account=${encodeURIComponent(acc)}&from=${r.from}&to=${r.to}` : '/me'); const L = acc && data?.entries ? data : null;
  return <>
    <div className="filters"><div className="fld" style={{ minWidth: 240 }}><label htmlFor="acc">Account</label><select id="acc" value={acc} onChange={(e) => setAcc(e.target.value)}><option value="">Choose an account</option>{(accounts || []).map((a) => <option key={a}>{a}</option>)}</select></div><FySelect value={fy} onChange={setFy} /></div>
    {!acc && <p className="note">Pick a bank account, Cash in hand, Petty cash, an expense head or a GST account to see every entry that touched it.</p>}
    {error && acc && <div className="err-box">{error}</div>}
    {L && <><div className="kpis"><div className="kpi"><div className="l">Opening</div><div className="v">{lakh(L.opening)}</div></div><div className="kpi"><div className="l">Debits</div><div className="v">{lakh(L.debits)}</div></div><div className="kpi"><div className="l">Credits</div><div className="v">{lakh(L.credits)}</div></div><div className="kpi"><div className="l">Closing {L.closing >= 0 ? '(Dr)' : '(Cr)'}</div><div className="v">{lakh(Math.abs(L.closing))}</div></div></div>
      <div className="card scroll"><table><thead><tr><th>Date</th><th>Particulars</th><th>Ref</th><th className="n">Debit ₹</th><th className="n">Credit ₹</th><th className="n">Balance ₹</th></tr></thead><tbody>
        {L.entries.map((e) => <tr key={e.id}><td className="mono">{fdate(e.entry_date)}</td><td>{e.party_name || e.category || e.narration}<span className="fx">{e.narration}</span></td>
          <td className="mono">{e.invoice_id ? <Link href={'/invoice/' + e.invoice_id} style={{ textDecoration: 'underline' }}>{e.invoice_no}</Link> : e.voucher_id ? 'Voucher' : ''}</td>
          <td className="n">{Number(e.debit) ? inr2(e.debit) : ''}</td><td className="n">{Number(e.credit) ? inr2(e.credit) : ''}</td><td className="n">{inr2(Math.abs(e.balance))} {e.balance >= 0 ? 'Dr' : 'Cr'}</td></tr>)}
        {!L.entries.length && <tr><td colSpan="6" className="note">No entries in this period.</td></tr>}</tbody></table></div></>}
  </>;
}

export default function Ledger() {
  const [kind, setKind] = useState('party'); const { data: me } = useApi('/me');
  return <>
    {me && me.role !== 'member' && <div className="filters"><Seg value={kind} onChange={setKind} options={[['party', 'Client / vendor ledger'], ['account', 'Account ledger (bank, cash, expenses)']]} /></div>}
    {kind === 'account' && me?.role !== 'member' ? <AccountLedger /> : <PartyLedger />}
  </>;
}

const csvText = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
function PartyLedger() {
  const [co, setCo] = useState(''); const [fy, setFy] = useState(fyOf());
  const r = fyRange(fy); const { data: cos } = useApi('/companies');
  const { data, error } = useApi(co ? `/ledger/statement?company_id=${co}&from=${r.from}&to=${r.to}` : '/me');
  const L = co && data?.rows ? data : null; const vendor = L?.company.kind === 'vendor'; const word = vendor ? 'Payment' : 'Receipt';
  const heads = (items) => [...new Set((items || []).map((x) => (x.head || '').trim()).filter(Boolean))].join('; ');
  const narr = (items) => (items || []).map((x) => (x.details || '').trim()).filter(Boolean);
  const exportCsv = () => { const url = URL.createObjectURL(new Blob([csvText([['Invoice Date', 'Invoice No', 'Type', 'Particulars', 'Narration', 'Taxable Value', 'TDS', 'GST', 'Total Invoice Value', word + ' Amount', 'Pending'], ...L.rows.map((x) => [x.invoice_date, x.invoice_no, x.doc_type, heads(x.items), narr(x.items).join(' | '), x.taxable, x.tds, x.gst, x.total_inr, x.receipt, x.pending])])], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `ledger-${L.company.name}-${r.label}.csv`; a.click(); URL.revokeObjectURL(url); };
  return <>
    <div className="bar"><h2>Ledger{L ? ` · ${L.company.name}` : ''}</h2></div>
    <div className="filters"><CompanySelect companies={(cos || []).filter((c) => c.kind !== 'own')} value={co} onChange={setCo} all="Choose a company" /><FySelect value={fy} onChange={setFy} />
      <button className="btn" onClick={exportCsv} disabled={!L || !L.rows.length}>Export CSV</button></div>
    {!co && <p className="note">Pick a client or vendor to see their invoice-wise ledger for {r.label}.</p>}
    {error && co && <div className="err-box">{error}</div>}
    {L && <>
      <div className="kpis"><div className="kpi"><div className="l">Pending before {r.label}</div><div className="v">{lakh(L.opening)}</div></div><div className="kpi"><div className="l">Invoiced</div><div className="v">{lakh(L.totals.total)}</div></div>
        <div className="kpi"><div className="l">{word}s</div><div className="v up">{lakh(L.totals.receipt)}</div></div><div className="kpi"><div className="l">TDS</div><div className="v">{lakh(L.totals.tds)}</div></div>
        <div className="kpi bad"><div className="l">Pending now</div><div className="v">{lakh(L.opening + L.totals.pending)}</div></div></div>
      <div className="card scroll"><table><thead><tr><th>Invoice Date</th><th>Invoice No</th><th>Particulars</th><th>Narration</th><th className="n">Taxable Value</th><th className="n">TDS</th><th className="n">GST</th><th className="n">Total Invoice Value</th><th className="n">{word} Amount</th><th className="n">Pending</th></tr></thead><tbody>
        {L.opening > 0 && <tr><td /><td /><td><i>Opening balance{L.opening_balance > 0 ? ' (carried in)' : ''} · pending before {fdate(r.from)}</i></td><td /><td /><td /><td /><td /><td /><td className="n">{inr2(L.opening)}</td></tr>}
        {L.rows.map((x) => <tr key={x.id}>
          <td className="mono">{fdate(x.invoice_date)}</td>
          <td className="mono"><Link href={'/invoice/' + x.id} style={{ textDecoration: 'underline' }}>{x.invoice_no}</Link>{x.doc_type === 'proforma' && <span className="ty ty-p" style={{ marginLeft: 4 }}>PRO</span>}</td>
          <td style={{ minWidth: 180 }}><b>{heads(x.items) || '—'}</b></td>
          <td style={{ minWidth: 220 }}>{narr(x.items).map((n, i) => <div key={i} className="note" style={{ color: 'var(--ink)' }}>{n.split('\n').join(' · ')}</div>)}
            {(x.receipts || []).map((p, i) => <div key={'r' + i} className="fx">{word} {inr2(p.amount)} on {fdate(p.date)} · {p.mode}{p.details?.reference || p.details?.txn_id || p.details?.cheque_no ? ' · ' + (p.details.reference || p.details.txn_id || p.details.cheque_no) : ''}{Number(p.tds) > 0 ? ` · TDS ${inr2(p.tds)}` : ''}</div>)}</td>
          <td className="n">{inr2(x.taxable)}</td><td className="n" style={{ color: Number(x.tds) > 0 ? 'var(--warn)' : undefined }}>{Number(x.tds) > 0 ? inr2(x.tds) : '—'}</td><td className="n">{inr2(x.gst)}</td>
          <td className="n"><b>{inr2(x.total_inr)}</b>{x.currency !== 'INR' && <span className="fx">{x.currency} {inr2(x.total)} @ {Number(x.fx_rate)}</span>}</td>
          <td className="n">{Number(x.receipt) > 0 ? inr2(x.receipt) : '—'}</td><td className="n"><b>{Number(x.pending) > 0 ? inr2(x.pending) : '0.00'}</b></td></tr>)}
        {!L.rows.length && <tr><td colSpan="10" className="note">No invoices in this period.</td></tr>}
        {L.rows.length > 0 && <tr style={{ background: 'var(--accent-soft)' }}><td colSpan="4"><b>Total</b></td><td className="n"><b>{inr2(L.totals.taxable)}</b></td><td className="n"><b>{inr2(L.totals.tds)}</b></td><td className="n"><b>{inr2(L.totals.gst)}</b></td><td className="n"><b>{inr2(L.totals.total)}</b></td><td className="n"><b>{inr2(L.totals.receipt)}</b></td><td className="n"><b>{inr2(L.totals.pending)}</b></td></tr>}
      </tbody></table></div>
      <p className="note">One row per invoice, in INR. Receipts against each invoice are listed under its narration. Proforma rows appear only if money was received and the tax invoice is not yet issued.</p></>}
  </>;
}
