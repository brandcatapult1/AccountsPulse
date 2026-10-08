import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Nav from '@/components/Nav';
export const dynamic = 'force-dynamic';
export default async function AppLayout({ children }) {
  const user = await getUser();
  if (!user) redirect('/login');
  return <div className="shell"><Nav user={user} /><main className="main">{children}</main></div>;
}
