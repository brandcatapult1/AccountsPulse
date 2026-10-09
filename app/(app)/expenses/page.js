'use client';
import { usePaged, Pager } from '@/components/Pager';
import { useState } from 'react';
import { api, useApi, useSeller, inr2, lakh, fdate, coLabel } from '@/lib/client';
import { OwnerSelect, Seg } from '@/components/Filters';

const SOURCES = ['Petty cash', 'Bank account', 'UPI', 'Cash', 'Cheque'];
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';
const iso = (d) => d.toISOString().slice(0, 10);
const PRESETS = {
  today: () => [iso(new Date()), iso(new Date())],
  week: () => { const d = new Date(); const w = (d.getDay() + 6) % 7; const s = new Date(d); s.setDate(d.getDate() - w); return [iso(s), iso(new Date())]; },
  month: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)).slice(0, 8) + '01', iso(new Date())]; },
  lastmonth: () => { const d = new Date(); const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = new Date(d.getFullYear(), d.getMonth(), 0); return [`${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-01`, `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, '0')}-${String(b.getDate()).padStart(2, '0')}`]; },
  fy: () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return [`${y}-04-01`, iso(new Date())]; },
};
const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

export default function Expenses() {
  const seller = useSeller();
  const [preset, setPreset] = useState('month'); const [group, setGroup] = useState('week');
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(today()); const [cat, setCat] = useState(''); const [who, setWho] = useState('');
  const { data: me } = useApi('/me'); const { data: team } = useApi('/users');
  const { data: sellers } = useApi('/companies?kind=own&all=1'); const { data: vendors } = useApi('/companies?kind=vendor');
  const pick = (p) => { setPreset(p); if (p !== 'custom') { const [a, b] = PRESETS[p](); setFrom(a); setTo(b); if (p === 'today' || p === 'week') setGroup('day'); else if (p === 'month' || p === 'lastmonth') setGroup('week'); else setGroup('month'); } };
  const qs = new URLSearchParams(Object.entries({ group, from, to, category: cat, user_id: who === 'me' ? me?.id : who }).filter(([, v]) => v)).toString();
  const { data, error, reload } = useApi('/petty?' + qs);
  const [form, setForm] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sure, setSure] = useState(null); const [msg, setMsg] = useState('');
  const blank = (kind) => ({ kind, voucher_date: today(), seller_id: seller || ((sellers || []).length === 1 ? String(sellers[0].id) : ''), amount: '', category: '', description: '', source: kind === 'petty_in' ? 'Cash' : 'Petty cash', account: '', from_name: kind === 'petty_in' ? 'Owner' : '', vendor_id: '', reference: '', file: null });
  const S = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function save() {
    setBusy(true); setErr('');
    try { const fd = new FormData(); for (const [k, v] of Object.entries(form)) if (v !== null && v !== '') fd.append(k, v); await api('/vouchers', { method: 'POST', body: fd }); setMsg(form.kind === 'petty_in' ? 'Petty cash recorded.' : 'Expense recorded.'); setForm(null); reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const E = data?.entries || []; const pg = usePaged(E, qs);
  const exportCsv = () => { const url = URL.createObjectURL(new Blob([csv([['Date', 'Type', 'Category', 'Description', 'Paid from / received', 'Reference', 'Added by', 'Money in', 'Money out'], ...E.map((v) => [v.voucher_date, v.kind === 'petty_in' ? 'Petty cash received' : 'Expense', v.category, v.description || v.from_name, v.source, v.reference, v.by_name, v.kind === 'petty_in' ? v.amount : '', v.kind === 'expense' ? v.amount : ''])])], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `expenses-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url); };
  return <>
    <div className="bar"><h2>Expenses & petty cash</h2>
      <div className="filters"><button className="btn pri" onClick={() => { setForm(blank('expense')); setErr(''); setMsg(''); }}>+ Add expense</button><button className="btn" onClick={() => { setForm(blank('petty_in')); setErr(''); setMsg(''); }}>+ Petty cash received</button></div></div>
    <div className="filters"><Seg value={preset} onChange={pick} options={[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['lastmonth', 'Last month'], ['fy', 'This FY'], ['custom', 'Custom']]} /></div>
    <div className="filters">
      <div className="fld"><label htmlFor="ef">From</label><input id="ef" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} /></div>
      <div className="fld"><label htmlFor="et">To</label><input id="et" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} /></div>
      <div className="fld" style={{ minWidth: 150 }}><label htmlFor="ec">Category</label><select id="ec" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All</option>{(data?.categories || []).map((c) => <option key={c}>{c}</option>)}</select></div>
      <OwnerSelect user={me} team={team} value={who} onChange={setWho} />
      <button className="btn" onClick={exportCsv} disabled={!E.length}>Export CSV</button></div>
    {msg && <div className="ok-box">{msg}</div>}{error && <div className="err-box">{error}</div>}

    {form && <div className="rec">
      <div className="bar"><b>{form.kind === 'petty_in' ? 'Petty cash received' : 'Add expense'}</b><button className="btn" onClick={() => setForm(null)}>Cancel</button></div>
      <div className="frow">
        <div className="fld"><label htmlFor="vd">Date</label><input id="vd" type="date" value={form.voucher_date} onChange={S('voucher_date')} /></div>
        <div className="fld"><label htmlFor="va">Amount (₹)</label><input id="va" inputMode="decimal" value={form.amount} onChange={S('amount')} /></div>
        <div className="fld"><label htmlFor="vs">Seller</label><select id="vs" value={form.seller_id} onChange={S('seller_id')}><option value="">Choose…</option>{(sellers || []).map((s) => <option key={s.id} value={s.id}>{coLabel(s)}</option>)}</select></div>
      </div>
      {form.kind === 'expense' ? <>
        <div className="frow">
          <div className="fld"><label htmlFor="vc">Category</label><input id="vc" list="cats" placeholder="Travel, Fuel, Food…" value={form.category} onChange={S('category')} />
            <datalist id="cats">{['Travel', 'Fuel', 'Food & refreshments', 'Office supplies', 'Printing & stationery', 'Courier', 'Repairs & maintenance', 'Staff welfare', 'Internet & phone', 'Rent', 'Utilities', 'Professional fees', 'Miscellaneous', ...(data?.categories || [])].map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="fld"><label htmlFor="vp">Paid from</label><select id="vp" value={form.source} onChange={S('source')}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
          {form.source === 'Bank account' && <div className="fld"><label htmlFor="vb">Bank account</label><input id="vb" placeholder="HDFC ••5933" value={form.account} onChange={S('account')} /></div>}
        </div>
        <div className="frow"><div className="fld"><label htmlFor="vv">Vendor (optional)</label><select id="vv" value={form.vendor_id} onChange={S('vendor_id')}><option value="">None</option>{(vendors || []).map((v) => <option key={v.id} value={v.id}>{coLabel(v)}</option>)}</select></div>
          <div className="fld"><label htmlFor="vr">Bill / reference no.</label><input id="vr" value={form.reference} onChange={S('reference')} /></div></div>
        <div className="fld"><label htmlFor="vx">What was it for</label><input id="vx" value={form.description} onChange={S('description')} /></div>
        <div className="fld"><label htmlFor="vf">Bill or receipt (optional)</label><input id="vf" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} /></div>
      </> : <>
        <div className="frow"><div className="fld"><label htmlFor="vn">Received from</label><input id="vn" value={form.from_name} onChange={S('from_name')} /></div>
          <div className="fld"><label htmlFor="vm">How received</label><select id="vm" value={form.source} onChange={S('source')}>{['Cash', 'UPI', 'Bank account', 'Cheque'].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="fld"><label htmlFor="vr2">Reference</label><input id="vr2" value={form.reference} onChange={S('reference')} /></div></div>
        <div className="fld"><label htmlFor="vx2">Note</label><input id="vx2" placeholder="e.g. float for October" value={form.description} onChange={S('description')} /></div>
      </>}
      {err && <div className="err-box">{err}</div>}
      <div style={{ textAlign: 'right' }}><button className="btn pri" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save entry'}</button></div>
    </div>}

    {data && <div className="kpis">
      <div className="kpi"><div className="l">Petty cash balance</div><div className="v" style={{ color: data.closing < 0 ? 'var(--bad)' : undefined }}>{lakh(data.closing)}</div><div className="d">at {fdate(to)}</div></div>
      <div className="kpi"><div className="l">Received in period</div><div className="v up">{lakh(data.received)}</div></div>
      <div className="kpi"><div className="l">Spent from petty cash</div><div className="v">{lakh(data.spent_petty)}</div></div>
      <div className="kpi"><div className="l">Paid from bank / UPI / cash</div><div className="v">{lakh(data.spent_other)}</div></div></div>}
    <div className="grid g2">
      <div className="card scroll"><div className="bar"><h3>{group === 'day' ? 'Day by day' : group === 'week' ? 'Week by week' : 'Month by month'}</h3><Seg value={group} onChange={setGroup} options={[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]} /></div>
        <table><thead><tr><th>{group === 'month' ? 'Month' : group === 'week' ? 'Week starting' : 'Day'}</th><th className="n">Entries</th><th className="n">Received ₹</th><th className="n">Spent ₹</th></tr></thead><tbody>
          {(data?.periods || []).map((p) => <tr key={p.period}><td className="mono">{group === 'month' ? new Date(p.period + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : fdate(p.period)}</td><td className="n">{p.count}</td><td className="n">{p.received ? inr2(p.received) : ''}</td><td className="n"><b>{p.spent ? inr2(p.spent) : ''}</b></td></tr>)}
          {data && !data.periods.length && <tr><td colSpan="4" className="note">Nothing in this period.</td></tr>}</tbody></table></div>
      <div className="card scroll"><h3>By team member</h3><table><tbody>
        {(data?.by_person || []).map((p) => <tr key={p.name}><td>{p.name}<span className="fx">{p.count} expense{p.count > 1 ? 's' : ''}</span></td><td className="n">{inr2(p.spent)}</td></tr>)}
        {data && !data.by_person.length && <tr><td className="note">No expenses in this period.</td></tr>}</tbody></table></div>
      <div className="card scroll"><h3>By category</h3><table><tbody>
        {(data?.by_category || []).map((c) => <tr key={c.category}><td>{c.category}</td><td className="n">{inr2(c.amount)}</td></tr>)}
        {data && !data.by_category.length && <tr><td className="note">No expenses in this period.</td></tr>}</tbody></table></div>
    </div>
    <div className="card scroll"><h3>Voucher entries</h3><table><thead><tr><th>Date</th><th>Entry</th><th>Paid from / received</th><th>Added by</th><th className="n">In ₹</th><th className="n">Out ₹</th><th className="n">Petty balance ₹</th><th /></tr></thead><tbody>
      {data && <tr><td /><td><i>Opening balance</i></td><td /><td /><td /><td /><td className="n">{inr2(data.opening)}</td><td /></tr>}
      {pg.view.map((v) => <tr key={v.id}>
        <td className="mono">{fdate(v.voucher_date)}</td>
        <td>{v.kind === 'petty_in' ? <b>Petty cash from {v.from_name || 'Owner'}</b> : <><b>{v.category}</b><span className="fx" style={{ color: 'var(--ink)' }}>{v.description}{v.vendor_name ? ` · ${v.vendor_name}` : ''}{v.reference ? ` · ${v.reference}` : ''}</span></>}
          {v.file_path && <a className="fx" href={`/api/vouchers/${v.id}/file`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View bill</a>}</td>
        <td>{v.source}{v.account ? <span className="fx">{v.account}</span> : null}</td><td>{v.by_name}</td>
        <td className="n">{v.kind === 'petty_in' ? inr2(v.amount) : ''}</td><td className="n">{v.kind === 'expense' ? inr2(v.amount) : ''}</td>
        <td className="n">{v.kind === 'petty_in' || v.source === 'Petty cash' ? inr2(v.balance) : <span className="note">not petty cash</span>}</td>
        <td><button className="btn dng" onClick={async () => { if (sure !== v.id) return setSure(v.id); try { await api('/vouchers/' + v.id, { method: 'DELETE' }); setSure(null); setMsg('Entry deleted.'); reload(); } catch (x) { setErr(x.message); } }}>{sure === v.id ? 'Confirm' : 'Delete'}</button></td></tr>)}
      {data && !E.length && <tr><td colSpan="8" className="note">No entries yet. Add an expense or record petty cash received from the owner.</td></tr>}
    </tbody></table><Pager p={pg} /></div>
    <p className="note">Each entry is saved to the ledger and the profit & loss. You see your own entries; an Account Lead sees the team's, and Super Admin sees everything.</p>
  </>;
}
