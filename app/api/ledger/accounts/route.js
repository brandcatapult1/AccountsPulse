import { route } from '@/lib/api';
import { q } from '@/lib/db';
export const GET = route(async () => (await q(`SELECT DISTINCT account FROM ledger_entries ORDER BY 1`)).rows.map((r) => r.account), { roles: ['admin', 'lead'] });
