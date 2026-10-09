'use client';
import { usePaged, Pager } from '@/components/Pager';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, Money, TypeBadge, fdate, num, inr } from '@/lib/client';
import { Seg, CompanySelect, OwnerSelect } from '@/components/Filters';
import FollowupLog from './log';

export default function Followups() {
  const [tab, setTab] = useState('pending');
  return <>
    <div className="bar"><h2>Follow-ups</h2></div>
    <div className="filters"><Seg value={tab} onChange={setTab} options={[['pending', 'Pending payments'], ['log', 'Follow-up log by team']]} /></div>
    {tab === 'pending' ? <Pending /> : <FollowupLog />}
  </>;
}

function Pending() {
  const router = useRouter(); const [dt, setDt] = useState(''); const [co, setCo] = useState(''); const [owner, setOwner] = useState(''); const [od, setOd] = useState('');
  const qs = new URLSearchParams(Object.entries({ status: 'approved', doc_type: dt, company_id: co, owner }).filter(([, v]) => v)).toString();
  const { data } = useApi('/invoices?' + qs); const { data: cos } = useApi('/companies'); const { data: me } = useApi('/me'); const { data: team } = useApi('/users');
  const today = new Date().toISOString().slice(0, 10);
  const rows = (data || []).filter((i) => i.stage !== 'received' && (!od || (od === 'overdue' ? String(i.due_date).slice(0, 10) < today : i.promised_date)));
  const pg = usePaged(rows, qs + od);
  return <>
    <div className="filters"><Seg value={dt} onChange={setDt} options={[['', 'All'], ['proforma', 'Proforma'], ['tax', 'Tax']]} /><CompanySelect companies={cos} value={co} onChange={setCo} /><OwnerSelect user={me} team={team} value={owner} onChange={setOwner} />
      <Seg value={od} onChange={setOd} options={[['', 'Any'], ['overdue', 'Overdue'], ['promised', 'Has promise']]} /></div>
    <div className="card scroll"><table><thead><tr><th>Company</th><th>Invoice</th><th className="n">Pending</th><th>Age</th><th>Due</th><th>Promised</th><th>Owner</th></tr></thead><tbody>
      {pg.view.map((i) => { const late = String(i.due_date).slice(0, 10) < today; return <tr key={i.id} className="click" onClick={() => router.push('/invoice/' + i.id)}>
        <td><b>{i.party_name}</b></td><td className="mono">{i.invoice_no} <TypeBadge t={i.doc_type} /></td>
        <td className="n">{i.currency === 'INR' ? inr(i.due) : <>{i.currency} {num(i.due).toLocaleString('en-IN')}<span className="fx">≈ {inr(i.due_inr)}</span></>}</td>
        <td><span className={'pill ' + (i.age_days > 60 ? 'p-bad' : i.age_days > 30 ? 'p-warn' : 'p-good')}>{i.age_days} d</span></td>
        <td className="mono">{fdate(i.due_date)} {late && <span className="pill p-bad">overdue</span>}</td><td className="mono">{fdate(i.promised_date)}</td><td>{i.created_name}</td></tr>; })}
      {data && !rows.length && <tr><td colSpan="7" className="note">Nothing pending.</td></tr>}
    </tbody></table><Pager p={pg} /></div>
  </>;
}
