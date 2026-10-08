'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useApi, inr, inr2, num, fdate, iso, TypeBadge, StageBadge } from '@/lib/client';
import RecordPayment from '@/components/RecordPayment';

const flagFor = (flags, ...fields) => (flags || []).find((f) => fields.includes(f.field));
function F({ label, id, flags, fields, children, hint }) {
  const f = flagFor(flags, ...(fields || []));
  return <div className={'fld' + (f ? (f.level === 'red' ? ' err' : ' flag') : '')}><label htmlFor={id}>{label}</label>{children}{(f || hint) && <span className="hint">{f?.msg || hint}</span>}</div>;
}

export default function Invoice() {
  const { id } = useParams(); const router = useRouter();
  const { data: inv, reload } = useApi('/invoices/' + id);
  const { data: companies } = useApi('/companies');
  const [f, setF] = useState(null); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false); const [showPay, setShowPay] = useState(false);
  const [proformas, setProformas] = useState([]);
  useEffect(() => { if (inv) setF({ ...inv, invoice_date: iso(inv.invoice_date), due_date: iso(inv.due_date), fx_date: iso(inv.fx_date), items: inv.items.map((i) => ({ ...i })) }); }, [inv]);
  const partyId = f && (f.direction === 'sales' ? f.to_company_id : f.from_company_id);
  useEffect(() => { if (f?.doc_type === 'tax' && partyId) api(`/invoices?doc_type=proforma&status=approved&company_id=${partyId}`).then(setProformas).catch(() => {}); else setProformas([]); }, [f?.doc_type, partyId]);
  if (!f) return <p className="note">Loading…</p>;
  const editable = inv.status === 'review';
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setItem = (n, k, v) => setF((x) => { const items = x.items.map((it, i) => i === n ? { ...it, [k]: v } : it); const it = items[n]; if (k === 'qty' || k === 'rate') it.amount = Math.round(num(it.qty) * num(it.rate) * 100) / 100; return { ...x, items, subtotal: items.reduce((s, i) => s + num(i.amount), 0) }; });
  const taxSum = num(f.cgst) + num(f.sgst) + num(f.igst);
  const calcTotal = Math.round((num(f.subtotal) + taxSum) * 100) / 100;
  const foreign = f.currency !== 'INR';
  const fx = foreign ? num(f.fx_rate) : 1;
  const flags = inv.flags || [];
  const items = f.items.reduce((s, i) => s + num(i.amount), 0);
  const matches = Math.abs(items - num(f.subtotal)) < 0.5 && Math.abs(calcTotal - num(f.total)) < 1;
  async function save() {
    await api('/invoices/' + id, { method: 'PUT', body: { ...f, fx_rate: fx, total: f.total, subtotal: f.subtotal } });
  }
  async function run(fn, ok) { setBusy(true); setMsg(null); try { await fn(); setMsg({ ok: ok }); reload(); } catch (e) { setMsg({ err: e.message }); } finally { setBusy(false); } }
  const parties = (kind) => (companies || []).filter((c) => !kind || kind.includes(c.kind));
  const sales = f.direction === 'sales';

  return <>
    <div className="bar"><h2>{inv.invoice_no || 'New invoice'} <TypeBadge t={inv.doc_type} /> <StageBadge s={inv.stage} status={inv.status} /></h2>
      <div className="filters"><button className="btn" onClick={() => router.back()}>◀ Back</button></div></div>
    {msg?.err && <div className="err-box">{msg.err}</div>}{msg?.ok && <div className="ok-box">{msg.ok}</div>}
    <div className="split">
      <div>
        <div className="lbl" style={{ marginBottom: 6 }}>Original · {inv.file_name}</div>
        {inv.file_mime?.startsWith('image') ? <img src={`/api/invoices/${id}/file`} alt="Original invoice" style={{ maxWidth: '100%' }} /> : <iframe className="viewer" title="Original invoice" src={`/api/invoices/${id}/file#toolbar=0`} />}
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="lbl">Details · {editable ? 'editable' : 'locked'}</div>
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="frow">
            <F label="Document" id="dt" flags={flags} fields={['docType']}><select id="dt" value={f.doc_type} onChange={(e) => set('doc_type', e.target.value)}><option value="tax">Tax Invoice</option><option value="proforma">Proforma</option></select></F>
            <F label="Direction" id="dir"><select id="dir" value={f.direction} onChange={(e) => set('direction', e.target.value)}><option value="sales">Sales</option><option value="purchase">Purchase</option></select></F>
            <F label="Invoice no." id="no" flags={flags} fields={['invoiceNo']}><input id="no" value={f.invoice_no || ''} onChange={(e) => set('invoice_no', e.target.value)} /></F>
            <F label="Date" id="d" flags={flags} fields={['invoiceDate']}><input id="d" type="date" value={f.invoice_date} onChange={(e) => set('invoice_date', e.target.value)} /></F>
            <F label="Due date" id="dd" flags={flags} fields={['dueDate']}><input id="dd" type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></F>
          </div>
          <div className="frow">
            <F label="From (seller)" id="fc" flags={flags} fields={['fromGstin', 'parties']}><select id="fc" value={f.from_company_id || ''} onChange={(e) => set('from_company_id', +e.target.value || null)}><option value="">Choose…</option>{parties().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
            <F label="To (buyer)" id="tc" flags={flags} fields={['toGstin']}><select id="tc" value={f.to_company_id || ''} onChange={(e) => set('to_company_id', +e.target.value || null)}><option value="">Choose…</option>{parties().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
          </div>
          <div className="link" style={{ alignItems: 'flex-end' }}>
            <b style={{ minWidth: '100%' }}>Currency</b>
            <div className="fld" style={{ flex: '1 1 90px' }}><label htmlFor="cur">Currency</label><input id="cur" value={f.currency} onChange={(e) => set('currency', e.target.value.toUpperCase().slice(0, 3))} /></div>
            {foreign && <>
              <div className={'fld' + (num(f.fx_rate) > 1 ? '' : ' flag')} style={{ flex: '1 1 110px' }}><label htmlFor="fx">Rate to INR</label><input id="fx" type="number" step="0.0001" value={f.fx_rate} onChange={(e) => set('fx_rate', e.target.value)} />{!(num(f.fx_rate) > 1) && <span className="hint">Enter the rate</span>}</div>
              <div className="fld" style={{ flex: '1 1 130px' }}><label htmlFor="fxd">Rate date</label><input id="fxd" type="date" value={f.fx_date} onChange={(e) => set('fx_date', e.target.value)} /></div>
              <div className="fld" style={{ flex: '1 1 130px' }}><label>Total in INR</label><div className="mono" style={{ padding: '7px 0', fontWeight: 600 }}>{inr2(calcTotal * fx)}</div></div>
            </>}
          </div>
          <div className="scroll"><table><thead><tr><th>Description</th><th>HSN/SAC</th><th className="n">Qty</th><th className="n">Rate</th><th className="n">Amount</th><th /></tr></thead><tbody>
            {f.items.map((it, n) => <tr key={n}>
              <td><input className="inp" aria-label="Description" value={it.description} onChange={(e) => setItem(n, 'description', e.target.value)} /></td>
              <td style={{ width: 90 }}><input className="inp" aria-label="HSN" value={it.hsn || ''} onChange={(e) => setItem(n, 'hsn', e.target.value)} /></td>
              <td style={{ width: 84 }}><input className="inp" aria-label="Qty" type="number" value={it.qty} onChange={(e) => setItem(n, 'qty', e.target.value)} /></td>
              <td style={{ width: 100 }}><input className="inp" aria-label="Rate" type="number" step="0.01" value={it.rate} onChange={(e) => setItem(n, 'rate', e.target.value)} /></td>
              <td style={{ width: 110 }}><input className="inp" aria-label="Amount" type="number" step="0.01" value={it.amount} onChange={(e) => setItem(n, 'amount', e.target.value)} /></td>
              <td>{editable && <button type="button" className="btn dng" onClick={() => setF((x) => { const items = x.items.filter((_, i) => i !== n); return { ...x, items, subtotal: items.reduce((s, i) => s + num(i.amount), 0) }; })}>✕</button>}</td></tr>)}
          </tbody></table></div>
          {editable && <div><button type="button" className="btn" onClick={() => setF((x) => ({ ...x, items: [...x.items, { description: '', hsn: '', qty: 1, rate: 0, amount: 0 }] }))}>+ Add line</button></div>}
          <div className="frow">
            <F label="Subtotal" id="st" flags={flags} fields={['items']}><input id="st" type="number" step="0.01" value={f.subtotal} onChange={(e) => set('subtotal', e.target.value)} /></F>
            <F label="CGST" id="cg"><input id="cg" type="number" step="0.01" value={f.cgst} onChange={(e) => set('cgst', e.target.value)} /></F>
            <F label="SGST" id="sg"><input id="sg" type="number" step="0.01" value={f.sgst} onChange={(e) => set('sgst', e.target.value)} /></F>
            <F label="IGST" id="ig"><input id="ig" type="number" step="0.01" value={f.igst} onChange={(e) => set('igst', e.target.value)} /></F>
            <F label="Total" id="tt" flags={flags} fields={['total']}><input id="tt" type="number" step="0.01" value={f.total} onChange={(e) => set('total', e.target.value)} /></F>
          </div>
          <div className="bar"><span className={'pill ' + (matches ? 'p-good' : 'p-bad')}>{matches ? 'Totals match' : `Items ${inr2(items)} · computed total ${inr2(calcTotal)}`}</span>
            {!matches && editable && <button type="button" className="btn" onClick={() => set('total', calcTotal)}>Use computed total</button>}</div>
          {f.doc_type === 'tax' && (
            <div className="fld"><label htmlFor="lp">Linked proforma (optional)</label>
              <select id="lp" value={f.linked_proforma_id || ''} onChange={(e) => set('linked_proforma_id', +e.target.value || null)}><option value="">None</option>
                {proformas.map((p) => <option key={p.id} value={p.id}>{p.invoice_no} · {inr2(p.total)} · paid {inr2(p.paid)}</option>)}</select>
              <span className="note">Approving converts the proforma. Payments already received move over, and income posts once.</span></div>)}
        </fieldset>
        {flags.length > 0 && editable && <div className="card" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}><b>Check these</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{flags.map((x, i) => <li key={i}>{x.msg}</li>)}</ul></div>}
        {editable && <div className="card" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
          <b>{f.doc_type === 'tax' ? 'On approve, these entries post (INR)' : 'Proforma: saved and tracked, nothing posts to the ledger'}</b>
          {f.doc_type === 'tax' && <table style={{ marginTop: 6 }}><tbody>
            <tr><td>{sales ? 'Dr Receivable' : 'Dr Purchases / expenses'}</td><td className="n">{inr2(sales ? calcTotal * fx : (calcTotal - taxSum) * fx)}</td></tr>
            <tr><td>{sales ? (foreign ? 'Cr Export income' : 'Cr Sales income') : 'Dr GST input'}</td><td className="n">{inr2(sales ? (calcTotal - taxSum) * fx : taxSum * fx)}</td></tr>
            <tr><td>{sales ? 'Cr GST payable' : 'Cr Payable'}</td><td className="n">{inr2(sales ? taxSum * fx : calcTotal * fx)}</td></tr></tbody></table>}</div>}
        {editable && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn dng" disabled={busy} onClick={() => run(async () => { await api(`/invoices/${id}/reject`, { method: 'POST', body: {} }); router.push('/review'); }, 'Rejected')}>Reject</button>
          <button className="btn" disabled={busy} onClick={() => run(save, 'Draft saved')}>Save draft</button>
          <button className="btn pri" disabled={busy} onClick={() => run(async () => { await save(); await api(`/invoices/${id}/approve`, { method: 'POST' }); }, 'Approved' + (f.doc_type === 'tax' ? ' and posted to the ledger' : ''))}>Approve{f.doc_type === 'tax' ? ' & post to ledger' : ''}</button></div>}
      </div>
    </div>

    {!editable && <div className="grid g2">
      <div className="card"><div className="bar"><h3>Payments</h3>{inv.status === 'approved' && inv.stage !== 'received' && <button className="btn pri" onClick={() => setShowPay(true)}>Record payment</button>}</div>
        {inv.proforma && <p className="note">Converted from proforma {inv.proforma.invoice_no}.</p>}{inv.converted_to && <p className="note">Converted to tax invoice {inv.converted_to.invoice_no}.</p>}
        <p className="note">Paid {inv.currency} {inr2(inv.paid)} of {inr2(inv.total)}</p>
        <table><tbody>{inv.payments.map((p) => <tr key={p.id} style={p.voided ? { opacity: .5, textDecoration: 'line-through' } : null}>
          <td className="mono">{fdate(p.paid_on)}</td><td>{p.mode}<span className="fx">{Object.entries(p.details || {}).filter(([k, v]) => v && k !== 'status').map(([k, v]) => v).join(' · ')}{p.details?.status ? ' · ' + p.details.status : ''}</span></td>
          <td className="n">{inr2(p.amount)}<span className="fx">{p.by_name}</span></td>
          <td>{!p.voided && p.mode === 'Cheque' && <button className="btn dng" onClick={() => run(() => api(`/invoices/${id}/payments`, { method: 'PUT', body: { payment_id: p.id, action: 'bounce' } }), 'Cheque marked bounced')}>Bounced</button>}</td></tr>)}
          {!inv.payments.length && <tr><td className="note">No payments yet.</td></tr>}</tbody></table>
        {showPay && <RecordPayment inv={inv} onClose={() => setShowPay(false)} onDone={() => { setShowPay(false); reload(); }} />}
      </div>
      <div className="card"><h3>Follow-ups</h3><FollowForm id={id} onDone={reload} disabled={inv.status !== 'approved' || inv.stage === 'received'} />
        <div className="tl">{inv.followups.map((x) => <div key={x.id}>{x.channel}: {x.note}{x.promised_date ? ` · promised ${fdate(x.promised_date)}` : ''}<small>{x.by_name} · {fdate(x.created_at)}</small></div>)}</div></div>
    </div>}
    {!editable && inv.status === 'approved' && <ReopenBox id={id} onDone={reload} />}
  </>;
}

function FollowForm({ id, onDone, disabled }) {
  const [x, setX] = useState({ channel: 'Call', note: '', promised_date: '' }); const [err, setErr] = useState('');
  if (disabled) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
    <div className="frow"><div className="fld"><label htmlFor="fc2">Channel</label><select id="fc2" value={x.channel} onChange={(e) => setX({ ...x, channel: e.target.value })}><option>Call</option><option>Email</option><option>WhatsApp</option><option>Visit</option></select></div>
      <div className="fld"><label htmlFor="fpd">Promised date</label><input id="fpd" type="date" value={x.promised_date} onChange={(e) => setX({ ...x, promised_date: e.target.value })} /></div></div>
    <div className="fld"><label htmlFor="fn">Note</label><input id="fn" value={x.note} onChange={(e) => setX({ ...x, note: e.target.value })} /></div>
    {err && <div className="err-box">{err}</div>}
    <div style={{ textAlign: 'right' }}><button className="btn pri" onClick={async () => { try { await api(`/invoices/${id}/followups`, { method: 'POST', body: x }); setX({ channel: 'Call', note: '', promised_date: '' }); setErr(''); onDone(); } catch (e) { setErr(e.message); } }}>Log follow-up</button></div></div>;
}
function ReopenBox({ id, onDone }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [err, setErr] = useState('');
  const { data: me } = useApi('/me'); if (me?.role !== 'admin') return null;
  return <div className="card"><button className="btn" onClick={() => setOpen(!open)}>Reopen for edits (Super Admin)</button>
    {open && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><input className="inp" style={{ flex: 1 }} placeholder="Reason, e.g. wrong tax rate" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn dng" onClick={async () => { try { await api(`/invoices/${id}/reopen`, { method: 'POST', body: { reason } }); onDone(); } catch (e) { setErr(e.message); } }}>Reopen</button>{err && <div className="err-box" style={{ width: '100%' }}>{err}</div>}</div>}</div>;
}
