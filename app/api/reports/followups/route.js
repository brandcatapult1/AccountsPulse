import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { sellerSql } from '@/lib/invoices';

/** Follow-up log: who chased which client on which invoice. Leads see their team, Super Admin sees everyone, members see their own. */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const { rows } = await q(
    `SELECT f.id, f.created_at, f.channel, f.note, f.promised_date, f.by_user, ub.name AS by_name,
       i.id AS invoice_id, i.invoice_no, i.doc_type, i.currency, i.total, i.paid, i.stage,
       GREATEST(i.total - i.paid, 0) AS due, ROUND(GREATEST(i.total - i.paid, 0) * i.fx_rate, 2) AS due_inr,
       c.id AS party_id, c.name AS party_name, c.brand_name AS party_brand
     FROM followups f JOIN invoices i ON i.id=f.invoice_id
     JOIN companies c ON c.id = CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END
     LEFT JOIN users ub ON ub.id=f.by_user
     WHERE ($1::int[] IS NULL OR f.by_user = ANY($1)) AND f.created_at::date BETWEEN $2 AND $3
       AND ($4::int IS NULL OR f.by_user=$4) AND ($5::int IS NULL OR c.id=$5) AND ($6::text IS NULL OR f.channel=$6) AND ${sellerSql(7)}
     ORDER BY f.created_at DESC LIMIT 1000`,
    [ids, u.get('from') || '1900-01-01', u.get('to') || '2999-12-31', u.get('user_id') || null, u.get('company_id') || null, u.get('channel') || null, u.get('seller_id') || null]);
  const by = new Map();
  for (const r of rows) {
    let g = by.get(r.by_user);
    if (!g) by.set(r.by_user, (g = { user_id: r.by_user, name: r.by_name || 'Unknown', count: 0, clients: new Set(), invoices: new Set(), promises: 0, last: r.created_at }));
    g.count++; g.clients.add(r.party_id); g.invoices.add(r.invoice_id); if (r.promised_date) g.promises++;
  }
  const people = [...by.values()].map((g) => ({ ...g, clients: g.clients.size, invoices: g.invoices.size })).sort((a, b) => b.count - a.count);
  return { rows, people, total: rows.length, clients: new Set(rows.map((r) => r.party_id)).size, invoices: new Set(rows.map((r) => r.invoice_id)).size };
});
