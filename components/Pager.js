'use client';
import { useState, useEffect } from 'react';

/** Client-side paging over a list already loaded. resetKey changes (filters, tab) send you back to page 1. */
export function usePaged(rows, resetKey = '', initialSize = 25) {
  const [page, setPage] = useState(1); const [size, setSize] = useState(initialSize);
  const list = rows || []; const total = list.length; const pages = Math.max(1, Math.ceil(total / size));
  useEffect(() => { setPage(1); }, [resetKey, size]);
  useEffect(() => { setPage((p) => Math.min(p, pages)); }, [pages]);
  const from = total ? (page - 1) * size + 1 : 0, to = Math.min(page * size, total);
  return { view: list.slice((page - 1) * size, page * size), page, setPage, size, setSize, total, pages, from, to };
}

export function Pager({ p }) {
  if (!p || p.total <= 10) return null;
  const nums = []; for (let i = 1; i <= p.pages; i++) if (i === 1 || i === p.pages || Math.abs(i - p.page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
  return <div className="pager">
    <span className="note">Showing {p.from}–{p.to} of {p.total}</span>
    <div className="filters">
      <select aria-label="Rows per page" value={p.size} onChange={(e) => p.setSize(+e.target.value)} className="inp" style={{ width: 'auto' }}>{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}</select>
      <button type="button" className="btn" disabled={p.page <= 1} onClick={() => p.setPage(p.page - 1)}>‹ Prev</button>
      {nums.map((n, i) => n === '…' ? <span key={'e' + i} className="note">…</span> : <button type="button" key={n} className={'btn' + (n === p.page ? ' pri' : '')} aria-current={n === p.page ? 'page' : undefined} onClick={() => p.setPage(n)}>{n}</button>)}
      <button type="button" className="btn" disabled={p.page >= p.pages} onClick={() => p.setPage(p.page + 1)}>Next ›</button>
    </div></div>;
}
