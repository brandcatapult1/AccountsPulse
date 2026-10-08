'use client';
import { useRouter } from 'next/navigation';
import { useApi, Money, TypeBadge, fdate } from '@/lib/client';
export default function Queue() {
  const { data, loading } = useApi('/invoices?status=review'); const router = useRouter();
  return <>
    <div className="bar"><h2>In review</h2></div>
    <div className="card scroll"><table><thead><tr><th>Invoice</th><th>Type</th><th>From → To</th><th>Date</th><th className="n">Total</th><th>Flags</th><th>By</th></tr></thead><tbody>
      {(data || []).map((i) => { const fl = i.flags || []; return <tr key={i.id} className="click" onClick={() => router.push('/invoice/' + i.id)}>
        <td className="mono">{i.invoice_no || '—'}</td><td><TypeBadge t={i.doc_type} /></td><td>{i.from_name || '?'} → {i.to_name || '?'}</td><td className="mono">{fdate(i.invoice_date)}</td>
        <td className="n"><Money inv={i} /></td><td>{fl.length ? <span className={'pill ' + (fl.some((f) => f.level === 'red') ? 'p-bad' : 'p-warn')}>{fl.length} to check</span> : <span className="pill p-good">Ready</span>}</td><td>{i.created_name}</td></tr>; })}
      {!loading && !data?.length && <tr><td colSpan="7" className="note">Nothing waiting. Upload an invoice to start.</td></tr>}
    </tbody></table></div>
  </>;
}
