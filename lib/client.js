'use client';
import { useEffect, useState, useCallback } from 'react';

const SELLER_KEY = 'ap_seller';
export const getSeller = () => { try { return typeof window === 'undefined' ? '' : localStorage.getItem(SELLER_KEY) || ''; } catch { return ''; } };
export const getBrand = () => { try { return typeof window === 'undefined' ? '' : localStorage.getItem('ap_brand') || ''; } catch { return ''; } };
export function setBrand(v) { try { localStorage.setItem('ap_brand', v || ''); } catch {} window.dispatchEvent(new Event('seller-change')); }
export function setSeller(v) { try { localStorage.setItem(SELLER_KEY, v || ''); } catch {} window.dispatchEvent(new Event('seller-change')); }
export function useScope() {
  const [s, setS] = useState(() => ({ seller: getSeller(), brand: getBrand() }));
  useEffect(() => { const h = () => setS({ seller: getSeller(), brand: getBrand() }); window.addEventListener('seller-change', h); return () => window.removeEventListener('seller-change', h); }, []);
  return s;
}
export const useSeller = () => useScope().seller;
export const useBrand = () => useScope().brand;
const SELLER_PATHS = ['/invoices', '/reports', '/ledger', '/companies'];
function withSeller(path, opts) {
  const seller = getSeller(), brand = getBrand();
  if ((!seller && !brand) || (opts.method && opts.method !== 'GET') || !SELLER_PATHS.some((p) => path.startsWith(p)) || /[?&](all|seller_id|brand_id)=/.test(path) || /^\/invoices\/\d+/.test(path) || path.startsWith('/invoices/upload')) return path;
  return path + (path.includes('?') ? '&' : '?') + [seller && 'seller_id=' + seller, brand && 'brand_id=' + brand].filter(Boolean).join('&');
}
export async function api(path, opts = {}) {
  path = withSeller(path, opts);
  const isForm = opts.body instanceof FormData;
  const res = await fetch('/api' + path, { credentials: 'same-origin', ...opts, headers: isForm ? opts.headers : { 'Content-Type': 'application/json', ...(opts.headers || {}) }, body: opts.body && !isForm && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth')) { window.location.href = '/login'; throw new Error('Sign in required'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export function useApi(path, deps = []) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const scope = useScope(); const seller = scope.seller + ':' + scope.brand;
  const load = useCallback(() => { setLoading(true); api(path).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [path, seller]);
  useEffect(() => { load(); }, [load, ...deps]);
  return { data, error, loading, reload: load };
}
export const coLabel = (c) => (c.brand_name && c.brand_name.trim().toLowerCase() !== c.name.trim().toLowerCase() ? `${c.name} (${c.brand_name})` : c.name);
export const num = (n) => Number(n || 0);
export const inr = (n) => '₹ ' + Math.round(num(n)).toLocaleString('en-IN');
export const inr2 = (n) => num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const lakh = (n) => { n = num(n); const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e7 ? `${s}₹ ${(a / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `${s}₹ ${(a / 1e5).toFixed(1)} L` : `${s}₹ ${Math.round(a).toLocaleString('en-IN')}`; };
export const fdate = (d) => { if (!d) return '—'; const x = new Date(String(d).slice(0, 10) + 'T00:00:00'); return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
export const iso = (d) => (d ? String(d).slice(0, 10) : '');
export function fyOf(date = new Date()) { return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1; }
export function fyRange(y) { return { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${y}–${String(y + 1).slice(2)}` }; }
export const TypeBadge = ({ t }) => <span className={'ty ' + (t === 'proforma' ? 'ty-p' : 'ty-t')}>{t === 'proforma' ? 'PROFORMA' : 'TAX'}</span>;
export const StageBadge = ({ s, status }) => {
  if (status === 'review') return <span className="pill p-warn">In review</span>;
  if (status === 'rejected') return <span className="pill p-bad">Rejected</span>;
  if (status === 'converted') return <span className="pill p-acc">Converted</span>;
  const m = { pending: ['p-bad', 'Pending'], promised: ['p-warn', 'Promised'], part: ['p-warn', 'Part paid'], received: ['p-good', 'Paid'] }[s] || ['p-mute', s];
  return <span className={'pill ' + m[0]}>{m[1]}</span>;
};
export const Money = ({ inv, field = 'total' }) => inv.currency === 'INR' ? <>₹ {inr2(inv[field])}</> : <>{inv.currency} {inr2(inv[field])}<span className="fx">≈ {inr(num(inv[field]) * num(inv.fx_rate))}</span></>;
