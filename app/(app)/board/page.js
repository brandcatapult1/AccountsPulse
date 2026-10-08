'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, useApi, lakh, inr2, num, TypeBadge, fdate, fyOf, fyRange } from '@/lib/client';
import { Seg, CompanySelect, OwnerSelect, FySelect } from '@/components/Filters';
import RecordPayment from '@/components/RecordPayment';

const COLS = [['pending', 'Pending'], ['promised', 'Promised'], ['part', 'Part paid'], ['received', 'Received']];
export default function Board() {
  const [dt, setDt] = useState(''); const [co, setCo] = useState(''); const [owner, setOwner] = useState(''); const [fy, setFy] = useState(fyOf());
  const r = fyRange(fy);
  const qs = new URLSearchParams(Object.entries({ status: 'approved', doc_type: dt, company_id: co, owner, from: r.from, to: r.to }).filter(([, v]) => v)).toString();
  const { data, reload } = useApi('/invoices?' + qs); const { data: cos } = useApi('/companies'); const { data: me } = useApi('/me'); const { data: team } = useApi('/users');
  const [over, setOver] = useState(''); const [pay, setPay] = useState(null); const [err, setErr] = useState(''); const [promise, setPromise] = useState(null);
  const list = (data || []).filter((i) => i.direction === 'sales');
  const byCol = (c) => list.filter((i) => i.stage === c);
  const dueInr = (i) => num(i.due_inr);
  const received = byCol('received');
  const modeTotals = {};
  async function drop(e, col) {
    e.preventDefault(); setOver('');
    const inv = list.find((i) => i.id === +e.dataTransfer.getData('text/plain')); if (!inv || inv.stage === col) return; setErr('');
    if (col === 'received' || col === 'part') { if (inv.stage === 'received') return setErr('Already paid in full.'); setPay({ inv, title: `${col === 'received' ? 'Record full payment' : 'Record part payment'} · ${inv.party_name} · ${inv.invoice_no}` }); return; }
    if (inv.stage === 'received') return setErr('Paid invoices cannot move back. Bounce or void the payment on the invoice instead.');
    if (col === 'promised') return setPromise({ inv, date: '' });
    try { await api(`/invoices/${inv.id}/stage`, { method: 'POST', body: { stage: col } }); reload(); } catch (x) { setErr(x.message); }
  }
  const pend = list.filter((i) => i.stage !== 'received');
  return <>
    <div className="bar"><h2>Payments board</h2></div>
    <div className="filters"><Seg value={dt} onChange={setDt} options={[['', 'All'], ['proforma', 'Proforma'], ['tax', 'Tax']]} /><CompanySelect companies={cos} value={co} onChange={setCo} /><OwnerSelect user={me} team={team} value={owner} onChange={setOwner} /><FySelect value={fy} onChange={setFy} /></div>
    <p className="note">Drag a card between columns. Dropping on Part paid or Received opens the payment form. Sales invoices only; totals in INR.</p>
    <div className="kpis">
      <div className="kpi"><div className="l">Pending total</div><div className="v">{lakh(pend.reduce((s, i) => s + dueInr(i), 0))}</div><div className="d">{pend.length} invoices</div></div>
      <div className="kpi"><div className="l">Received</div><div className="v up">{lakh(received.reduce((s, i) => s + num(i.total_inr), 0))}</div><div className="d">{received.length} invoices fully paid</div></div>
    </div>
    {err && <div className="err-box">{err}</div>}
    <div className="board">{COLS.map(([c, label]) => { const cards = byCol(c); const tot = cards.reduce((s, i) => s + (c === 'received' ? num(i.total_inr) : dueInr(i)), 0);
      return <div key={c} className={'col' + (over === c ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(c); }} onDragLeave={() => setOver('')} onDrop={(e) => drop(e, c)}>
        <h3><span>{label} <span className="cnt">{cards.length}</span></span></h3><div className="tot">{lakh(tot)}</div>
        {cards.map((i) => <div key={i.id} className="cardi" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i.id))}>
          <div className="t"><Link href={'/invoice/' + i.id}><b>{i.party_name}</b></Link><TypeBadge t={i.doc_type} /></div>
          <div className="t"><span className="mono note">{i.invoice_no}{c !== 'received' && ` · ${i.age_days} d`}</span><span className="amt">₹ {inr2(c === 'received' ? i.total_inr : i.due_inr)}</span></div>
          {i.currency !== 'INR' && <span className="fx">{i.currency} {inr2(c === 'received' ? i.total : i.due)}</span>}
          {i.promised_date && c === 'promised' && <span className="note">Promised {fdate(i.promised_date)}</span>}
          {c === 'part' && <span className="note">Paid {i.currency} {inr2(i.paid)} of {inr2(i.total)}</span>}
          <span className="note">{i.created_name}</span></div>)}
      </div>; })}</div>
    {promise && <div className="rec"><b>Promised payment date · {promise.inv.party_name}</b><div className="fld"><label htmlFor="pr">Date</label><input id="pr" type="date" value={promise.date} onChange={(e) => setPromise({ ...promise, date: e.target.value })} /></div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn" onClick={() => setPromise(null)}>Cancel</button><button className="btn pri" onClick={async () => { try { await api(`/invoices/${promise.inv.id}/stage`, { method: 'POST', body: { stage: 'promised', promised_date: promise.date } }); setPromise(null); reload(); } catch (x) { setErr(x.message); } }}>Save</button></div></div>}
    {pay && <RecordPayment inv={pay.inv} title={pay.title} onClose={() => setPay(null)} onDone={() => { setPay(null); reload(); }} />}
  </>;
}
