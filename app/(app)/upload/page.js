'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { api, useApi, inr2, TypeBadge } from '@/lib/client';
import { Seg } from '@/components/Filters';

export default function Upload() {
  const [direction, setDirection] = useState('sales'); const [docType, setDocType] = useState('auto');
  const [rows, setRows] = useState([]); const [over, setOver] = useState(false); const input = useRef();
  async function send(files) {
    for (const file of files) {
      const key = file.name + Math.random(); setRows((r) => [{ key, name: file.name, state: 'reading' }, ...r]);
      const fd = new FormData(); fd.append('file', file); fd.append('direction', direction); if (docType !== 'auto') fd.append('doc_type', docType);
      try { const res = await api('/invoices/upload', { method: 'POST', body: fd }); setRows((r) => r.map((x) => x.key === key ? { ...x, state: 'done', res } : x)); }
      catch (e) { setRows((r) => r.map((x) => x.key === key ? { ...x, state: 'fail', err: e.message } : x)); }
    }
  }
  return <>
    <div className="bar"><h2>Upload invoices</h2></div>
    <div className="filters">
      <div className="fld"><label>Direction</label><Seg value={direction} onChange={setDirection} options={[['sales', 'Sales (we raised)'], ['purchase', 'Purchase (we received)']]} /></div>
      <div className="fld"><label>Document type</label><Seg value={docType} onChange={setDocType} options={[['auto', 'Detect'], ['tax', 'Tax Invoice'], ['proforma', 'Proforma']]} /></div>
    </div>
    <div className={'drop' + (over ? ' over' : '')} onClick={() => input.current.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); send([...e.dataTransfer.files]); }}>
      <b>Drop PDFs here</b>or click to browse. PDF, PNG or JPG, up to 10 MB each. Companies are matched by GSTIN or created from the invoice.
      <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple hidden onChange={(e) => { send([...e.target.files]); e.target.value = ''; }} />
    </div>
    {rows.length > 0 && <div className="card scroll"><h3>This session</h3><table><thead><tr><th>File</th><th>Type</th><th>Result</th><th></th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.key}><td className="mono">{r.name}</td>
        <td>{r.res && <TypeBadge t={r.res.doc_type} />}</td>
        <td>{r.state === 'reading' && <span className="pill p-acc">Reading…</span>}
          {r.state === 'fail' && <span className="pill p-bad">{r.err}</span>}
          {r.state === 'done' && <>{r.res.invoice_no} · {r.res.currency} {inr2(r.res.total)} {r.res.flags.length ? <span className="pill p-warn">{r.res.flags.length} to check</span> : <span className="pill p-good">Read cleanly</span>}</>}</td>
        <td>{r.state === 'done' && <Link className="btn pri" href={`/invoice/${r.res.id}`}>Review</Link>}</td></tr>)}
    </tbody></table></div>}
  </>;
}
