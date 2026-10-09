import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { sellerSql, scopeParam } from '@/lib/invoices';

/** Line items on approved tax invoices, grouped by the first line of the description (the head). */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const direction = u.get('direction') === 'purchase' ? 'purchase' : 'sales';
  const { rows } = await q(
    `SELECT COALESCE(NULLIF(trim(it.description),''), '(no description)') AS head, COUNT(DISTINCT i.id)::int AS invoices, COUNT(*)::int AS lines,
       SUM(it.qty) AS qty, SUM(ROUND(it.amount * i.fx_rate, 2)) AS amount_inr,
       json_agg(json_build_object('invoice_id', i.id, 'invoice_no', i.invoice_no, 'date', i.invoice_date, 'details', it.details, 'amount', it.amount, 'currency', i.currency,
         'party', CASE WHEN i.direction='sales' THEN tc.name ELSE fc.name END) ORDER BY i.invoice_date DESC) AS entries
     FROM invoice_items it JOIN invoices i ON i.id=it.invoice_id LEFT JOIN companies fc ON fc.id=i.from_company_id LEFT JOIN companies tc ON tc.id=i.to_company_id
     WHERE i.status='approved' AND i.doc_type='tax' AND i.direction=$1 AND i.invoice_date BETWEEN $2 AND $3 AND ($4::int[] IS NULL OR i.created_by = ANY($4)) AND ${sellerSql(5)}
       AND ($6::text IS NULL OR it.description ILIKE '%'||$6||'%' OR it.details ILIKE '%'||$6||'%')
       AND ($7::int IS NULL OR i.from_company_id=$7 OR i.to_company_id=$7) AND ($8::int IS NULL OR it.brand_id=$8)
     GROUP BY 1 ORDER BY amount_inr DESC`, [direction, u.get('from'), u.get('to'), ids, scopeParam(u), u.get('q') || null, u.get('company_id') || null, u.get('brand_id') || null]);
  return { direction, rows, total_inr: rows.reduce((s, r) => s + Number(r.amount_inr), 0) };
});
