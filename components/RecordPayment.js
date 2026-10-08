'use client';
import { useState } from 'react';
import { api, inr2, num, fdate } from '@/lib/client';

const MODES = ['Bank account', 'UPI', 'Cash', 'Cheque'];
export default function RecordPayment({ inv, onClose, onDone, title }) {
  const due = Math.max(num(inv.total) - num(inv.paid), 0);
  const [mode, setMode] = useState('Bank account');
  const [f, setF] = useState({ amount: due.toFixed(2), paid_on: new Date().toISOString().slice(0, 10), tds: '0', amount_inr: '', note: '' });
  const [d, setD] = useState({ account: '', reference: '', upi_id: '', txn_id: '', received_by: '', receipt_no: '', cheque_no: '', bank: '', cheque_date: '', status: 'Deposited' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const foreign = inv.currency !== 'INR';
  const det = { 'Bank account': { account: d.account, reference: d.reference }, UPI: { upi_id: d.upi_id, txn_id: d.txn_id }, Cash: { received_by: d.received_by, receipt_no: d.receipt_no }, Cheque: { cheque_no: d.cheque_no, bank: d.bank, cheque_date: d.cheque_date, status: d.status } }[mode];
  async function save() {
    setBusy(true); setErr('');
    try { await api(`/invoices/${inv.id}/payments`, { method: 'POST', body: { ...f, mode, details: det } }); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  const S = (k) => (e) => setF({ ...f, [k]: e.target.value }), D = (k) => (e) => setD({ ...d, [k]: e.target.value });
  return <div className="rec" style={{ marginTop: 12 }}>
    <div className="bar"><b>{title || `Record payment · ${inv.invoice_no}`}</b><button className="btn" onClick={onClose}>Cancel</button></div>
    <div className="frow">
      <div className="fld"><label htmlFor="pa">Amount ({inv.currency})</label><input id="pa" value={f.amount} onChange={S('amount')} /><span className="note">Due {inr2(due)}</span></div>
      <div className="fld"><label htmlFor="pd">Date received</label><input id="pd" type="date" value={f.paid_on} onChange={S('paid_on')} /></div>
      <div className="fld"><label htmlFor="pt">TDS deducted (₹)</label><input id="pt" value={f.tds} onChange={S('tds')} /></div>
      {foreign && <div className="fld"><label htmlFor="pi">Actually received (₹)</label><input id="pi" value={f.amount_inr} placeholder={inr2(num(f.amount) * num(inv.fx_rate))} onChange={S('amount_inr')} /><span className="note">Leave blank to use the invoice rate</span></div>}
    </div>
    <div className="lbl">How was it received?</div>
    <div className="modes">{MODES.map((m) => <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m}</button>)}</div>
    {mode === 'Bank account' && <div className="frow"><div className="fld"><label htmlFor="ba">Received in</label><input id="ba" placeholder="HDFC Current ••5933" value={d.account} onChange={D('account')} /></div><div className="fld"><label htmlFor="br">UTR / reference</label><input id="br" value={d.reference} onChange={D('reference')} /></div></div>}
    {mode === 'UPI' && <div className="frow"><div className="fld"><label htmlFor="ui">UPI ID / app</label><input id="ui" value={d.upi_id} onChange={D('upi_id')} /></div><div className="fld"><label htmlFor="ut">Transaction ID</label><input id="ut" value={d.txn_id} onChange={D('txn_id')} /></div></div>}
    {mode === 'Cash' && <div className="frow"><div className="fld"><label htmlFor="cb">Received by</label><input id="cb" value={d.received_by} onChange={D('received_by')} /></div><div className="fld"><label htmlFor="cr">Receipt no.</label><input id="cr" value={d.receipt_no} onChange={D('receipt_no')} /></div></div>}
    {mode === 'Cheque' && <div className="frow"><div className="fld"><label htmlFor="qn">Cheque no.</label><input id="qn" value={d.cheque_no} onChange={D('cheque_no')} /></div><div className="fld"><label htmlFor="qb">Bank & branch</label><input id="qb" value={d.bank} onChange={D('bank')} /></div><div className="fld"><label htmlFor="qd">Cheque date</label><input id="qd" type="date" value={d.cheque_date} onChange={D('cheque_date')} /></div>
      <div className="fld"><label htmlFor="qs">Status</label><select id="qs" value={d.status} onChange={D('status')}><option>Deposited</option><option>Cleared</option><option>Bounced</option></select></div></div>}
    <div className="fld"><label htmlFor="pn">Note</label><input id="pn" value={f.note} onChange={S('note')} /></div>
    {err && <div className="err-box">{err}</div>}
    <div style={{ textAlign: 'right' }}><button className="btn pri" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save payment'}</button></div>
  </div>;
}
