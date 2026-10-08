import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { sellerSql } from '@/lib/invoices';

/** Pending and part-paid invoices grouped by client (sales) or vendor (purchase). */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const direction = u.get('direction') === 'purchase' ? 'purchase' : 'sales';
  const docType = u.get('doc_type') || null, stage = u.get('stage') || null, seller = u.get('seller_id') || null, co = u.get('company_id') || null;
  const { rows } = await q(
    `SELECT i.id, i.invoice_no, i.doc_type, i.invoice_date, i.due_date, i.currency, i.fx_rate, i.total, i.paid, i.stage, i.promised_date,
       GREATEST(i.total - i.paid, 0) AS due, ROUND(GREATEST(i.total - i.paid, 0) * i.fx_rate, 2) AS due_inr, (CURRENT_DATE - i.invoice_date) AS age_days,
       (i.due_date < CURRENT_DATE) AS overdue, u.name AS created_name,
       c.id AS party_id, c.name AS party_name, c.brand_name, c.gstin, c.contacts
     FROM invoices i JOIN companies c ON c.id = CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END
     LEFT JOIN users u ON u.id=i.created_by
     WHERE i.status='approved' AND i.direction=$1 AND i.stage <> 'received' AND ($2::text IS NULL OR i.doc_type=$2) AND ($3::text IS NULL OR i.stage=$3)
       AND ($4::int[] IS NULL OR i.created_by = ANY($4)) AND ($5::int IS NULL OR c.id=$5) AND ${sellerSql(6)}
     ORDER BY c.name, i.invoice_date`, [direction, docType, stage, ids, co, seller]);
  const by = new Map();
  for (const r of rows) {
    let g = by.get(r.party_id);
    if (!g) by.set(r.party_id, (g = { party_id: r.party_id, name: r.party_name, brand_name: r.brand_name, gstin: r.gstin, contacts: r.contacts || [], due_inr: 0, overdue_inr: 0, invoices: [] }));
    g.due_inr += Number(r.due_inr); if (r.overdue) g.overdue_inr += Number(r.due_inr);
    g.invoices.push({ ...r, contacts: undefined });
  }
  const groups = [...by.values()].sort((a, b) => b.due_inr - a.due_inr);
  return { direction, groups, total_inr: groups.reduce((s, g) => s + g.due_inr, 0), overdue_inr: groups.reduce((s, g) => s + g.overdue_inr, 0), invoice_count: rows.length };
});
