'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, Money, TypeBadge, StageBadge, fdate, inr } from '@/lib/client';
import { Seg, CompanySelect, OwnerSelect } from '@/components/Filters';

export default function Invoices() {
  const router = useRouter();
  const [dt, setDt] = useState(''); const [dir, setDir] = useState(''); const [status, setStatus] = useState(''); const [co, setCo] = useState(''); const [owner, setOwner] = useState(''); const [s, setS] = useState('');
  const qs = new URLSearchParams(Object.entries({ doc_type: dt, direction: dir, status, company_id: co, owner, q: s }).filter(([, v]) => v)).toString();
  const { data } = useApi('/invoices' + (qs ? '?' + qs : '')); const { data: cos } = useApi('/companies'); const { data: me } = useApi('/me'); const { data: team } = useApi('/users');
  return <>
    <div className="bar"><h2>All invoices</h2></div>
    <div className="filters">
      <Seg value={dt} onChange={setDt} options={[['', 'All'], ['proforma', 'Proforma'], ['tax', 'Tax']]} />
      <Seg value={dir} onChange={setDir} options={[['', 'Sales + Purchase'], ['sales', 'Sales'], ['purchase', 'Purchase']]} />
      <CompanySelect companies={cos} value={co} onChange={setCo} />
      <div className="fld" style={{ minWidth: 130 }}><label htmlFor="st">Status</label><select id="st" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any</option><option value="review">In review</option><option value="approved">Approved</option><option value="converted">Converted</option><option value="rejected">Rejected</option></select></div>
      <OwnerSelect user={me} team={team} value={owner} onChange={setOwner} />
      <div className="fld"><label htmlFor="q">Search</label><input id="q" placeholder="no. or company" value={s} onChange={(e) => setS(e.target.value)} /></div>
    </div>
    <div className="card scroll"><table><thead><tr><th>Invoice</th><th>Type</th><th>Company</th><th>Date</th><th className="n">Amount</th><th className="n">INR</th><th>Status</th><th>Added by</th><th>Reviewed by</th></tr></thead><tbody>
      {(data || []).map((i) => <tr key={i.id} className="click" onClick={() => router.push('/invoice/' + i.id)}>
        <td className="mono">{i.invoice_no || '—'}</td><td><TypeBadge t={i.doc_type} /></td><td>{i.party_name || '—'}{i.party_brand && <span className="fx">{i.party_brand}</span>}{i.direction === 'purchase' && <span className="fx">purchase</span>}</td><td className="mono">{fdate(i.invoice_date)}</td>
        <td className="n"><Money inv={i} /></td><td className="n">{inr(i.total_inr)}</td><td><StageBadge s={i.stage} status={i.status} /></td><td>{i.created_name || '—'}<span className="fx">{fdate(i.created_at)}</span></td><td>{i.reviewed_name || '—'}{i.reviewed_at && <span className="fx">{fdate(i.reviewed_at)}</span>}</td></tr>)}
      {data && !data.length && <tr><td colSpan="9" className="note">No invoices match.</td></tr>}
    </tbody></table></div>
  </>;
}
