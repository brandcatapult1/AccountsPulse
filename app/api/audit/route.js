import { route } from '@/lib/api';
import { q } from '@/lib/db';
export const GET = route(async () => {
  const { rows } = await q(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200`);
  return rows;
}, { roles: ['admin'] });
