'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useApi, Money, TypeBadge, fdate } from '@/lib/client';
export default function Queue() {
  const { data, loading, reload } = useApi('/invoices?status=review'); const router = useRouter(); const [sure, setSure] = useState(null); const [err, setErr] = useState('');
  return <>
    <div className="bar"><h2>In review</h2></div>
    {err && <div className="err-box">{err}</div>}
    <div className="card scroll"><table><thead><tr><th>Invoice</th><th>Type</th><th>From → To</th><th>Date</th><th className="n">Total</th><th>Flags</th><th>By</th><th /></tr></thead><tbody>
      {(data || []).map((i) => { const fl = i.flags || []; return <tr key={i.id} className="click" onClick={() => router.push('/invoice/' + i.id)}>
        <td className="mono">{i.invoice_no || '—'}</td><td><TypeBadge t={i.doc_type} /></td><td>{i.from_name || '?'} → {i.to_name || '?'}</td><td className="mono">{fdate(i.invoice_date)}</td>
        <td className="n"><Money inv={i} /></td><td>{fl.length ? <span className={'pill ' + (fl.some((f) => f.level === 'red') ? 'p-bad' : 'p-warn')}>{fl.length} to check</span> : <span className="pill p-good">Ready</span>}</td><td>{i.created_name}</td>
        <td onClick={(e) => e.stopPropagation()}><button className="btn dng" onClick={async () => { if (sure !== i.id) return setSure(i.id); try { await api('/invoices/' + i.id, { method: 'DELETE' }); setSure(null); reload(); } catch (x) { setErr(x.message); } }}>{sure === i.id ? 'Confirm delete' : 'Delete'}</button></td></tr>; })}
      {!loading && !data?.length && <tr><td colSpan="8" className="note">Nothing waiting. Upload an invoice to start.</td></tr>}
    </tbody></table></div>
  </>;
}
