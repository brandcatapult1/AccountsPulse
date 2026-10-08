'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, useApi, useSeller, setSeller } from '@/lib/client';

const ROLE = { admin: 'Super Admin', lead: 'Account Lead', member: 'Accounts' };
export default function Nav({ user }) {
  const path = usePathname(); const router = useRouter();
  const { data: sellers } = useApi('/companies?kind=own&all=1'); const seller = useSeller();
  const L = (href, label) => <Link href={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'on' : ''}>{label}</Link>;
  return (
    <aside className="side">
      <div className="brand">Accounts Pulse<small>{ROLE[user.role]}</small></div>
      <div className="seller-pick"><label htmlFor="seller">Seller</label>
        <select id="seller" value={seller} onChange={(e) => setSeller(e.target.value)}><option value="">All sellers</option>{(sellers || []).map((c) => <option key={c.id} value={c.id}>{c.brand_name || c.name}</option>)}</select></div>
      <div className="grp">Work</div>{L('/', 'Dashboard')}{L('/upload', 'Upload')}{L('/review', 'In review')}{L('/invoices', 'Invoices')}{L('/board', 'Payments board')}{L('/followups', 'Follow-ups')}
      <div className="grp">Books</div>{L('/ledger', 'Ledger')}{L('/pl', 'Profit & Loss')}{L('/reports', 'Reports')}{L('/tds', 'TDS report')}
      <div className="grp">Setup</div>{L('/companies', 'Companies')}
      {user.role !== 'member' && L('/team', 'Team')}
      {user.role === 'admin' && L('/audit', 'Audit log')}
      <div className="who">{user.name}<br /><span style={{ opacity: .7 }}>{user.email}</span><br />
        <button onClick={async () => { await api('/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); }}>Sign out</button></div>
    </aside>
  );
}
