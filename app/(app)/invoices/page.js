'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, Money, TypeBadge, StageBadge, fdate, inr, inr2, num } from '@/lib/client';
import { Seg, CompanySelect, OwnerSelect } from '@/components/Filters';
import { Pager } from '@/components/Pager';

export default function Invoices() {
  const router = useRouter();
  const [dt, setDt] = useState(''); const [dir, setDir] = useState(''); const [status, setStatus] = useState(''); const [co, setCo] = useState(''); const [owner, setOwner] = useState(''); const [s, setS] = useState('');
  const [page, setPage] = useState(1); const [size, setSize] = useState(25);
  useEffect(() => { setPage(1); }, [dt, dir, status, co, owner, s, size]);
  const qs = new URLSearchParams(Object.entries({ doc_type: dt, direction: dir, status, company_id: co, owner, q: s, paged: 1, page, page_size: size }).filter(([, v]) => v)).toString();
  const { data: res } = useApi('/invoices?' + qs); const data = res?.rows; const total = res?.total || 0; const pages = Math.max(1, Math.ceil(total / size));
  const pager = { page, setPage, size, setSize, total, pages, from: total ? (page - 1) * size + 1 : 0, to: Math.min(page * size, total) };
  const { data: cos } = useApi('/companies'); const { data: me } = useApi('/me'); const { data: team } = useApi('/users');
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
    <div className="card scroll"><table><thead><tr><th>Invoice</th><th>Type</th><th>Company</th><th>Date</th><th className="n">Amount</th><th className="n">Paid till date</th><th className="n">Amount due</th><th>Status</th><th>Added by</th><th>Reviewed by</th></tr></thead><tbody>
      {(data || []).map((i) => <tr key={i.id} className="click" onClick={() => router.push('/invoice/' + i.id)}>
        <td className="mono">{i.invoice_no || '—'}</td><td><TypeBadge t={i.doc_type} /></td><td>{i.party_name || '—'}{(i.brand_label || i.party_brand) && <span className="fx">{i.brand_label || i.party_brand}</span>}{i.direction === 'purchase' && <span className="fx">purchase</span>}</td><td className="mono">{fdate(i.invoice_date)}</td>
        <td className="n"><Money inv={i} /></td><td className="n">{i.status === 'approved' || i.status === 'converted' ? (num(i.paid) > 0 ? <>{i.currency === 'INR' ? '₹ ' : i.currency + ' '}{inr2(i.paid)}</> : '0') : '—'}</td>
        <td className="n">{i.status === 'approved' ? (i.stage === 'received' ? '0' : <b>{i.currency === 'INR' ? '₹ ' : i.currency + ' '}{inr2(i.due)}{i.currency !== 'INR' && <span className="fx">≈ {inr(i.due_inr)}</span>}</b>) : i.status === 'converted' ? '0' : '—'}</td><td><StageBadge s={i.stage} status={i.status} /></td><td>{i.created_name || '—'}<span className="fx">{fdate(i.created_at)}</span></td><td>{i.reviewed_name || '—'}{i.reviewed_at && <span className="fx">{fdate(i.reviewed_at)}</span>}</td></tr>)}
      {data && !data.length && <tr><td colSpan="10" className="note">No invoices match.</td></tr>}
    </tbody></table><Pager p={pager} /></div>
  </>;
}
