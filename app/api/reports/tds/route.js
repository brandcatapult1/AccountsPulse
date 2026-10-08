import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { sellerSql } from '@/lib/invoices';

/** mode=deducted: every payment where TDS was cut. mode=missing: sales tax invoices that received money but have no TDS recorded. */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const co = u.get('company_id') || null, seller = u.get('seller_id') || null, from = u.get('from'), to = u.get('to');
  const scope = `($1::int[] IS NULL OR i.created_by = ANY($1)) AND ($2::int IS NULL OR i.from_company_id=$2 OR i.to_company_id=$2) AND ${sellerSql(3)}`;
  if (u.get('mode') === 'missing') {
    const { rows } = await q(
      `SELECT i.id, i.invoice_no, i.invoice_date, i.currency, i.total, i.paid, i.stage, c.name AS party_name, c.brand_name AS party_brand,
         (SELECT MAX(p.paid_on) FROM payments p WHERE p.invoice_id=i.id AND NOT p.voided) AS last_paid_on,
         (SELECT COALESCE(SUM(p.amount_inr),0) FROM payments p WHERE p.invoice_id=i.id AND NOT p.voided) AS received_inr
       FROM invoices i JOIN companies c ON c.id=i.to_company_id
       WHERE i.direction='sales' AND i.doc_type='tax' AND i.status='approved' AND i.paid > 0 AND ${scope}
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id=i.id AND NOT p.voided AND p.tds > 0)
         AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id=i.id AND NOT p.voided AND p.paid_on BETWEEN $4 AND $5)
       ORDER BY last_paid_on DESC`, [ids, co, seller, from, to]);
    return { mode: 'missing', rows };
  }
  const { rows } = await q(
    `SELECT p.id, p.paid_on, p.tds, p.amount, p.amount_inr, p.mode, i.id AS invoice_id, i.invoice_no, i.doc_type, i.currency, i.total, i.direction,
       c.name AS party_name, c.brand_name AS party_brand, c.pan AS party_pan, u.name AS by_name
     FROM payments p JOIN invoices i ON i.id=p.invoice_id
     JOIN companies c ON c.id = CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END
     LEFT JOIN users u ON u.id=p.recorded_by
     WHERE NOT p.voided AND p.tds > 0 AND ${scope} AND p.paid_on BETWEEN $4 AND $5
     ORDER BY p.paid_on DESC, p.id DESC`, [ids, co, seller, from, to]);
  return { mode: 'deducted', rows, total: rows.reduce((s, r) => s + Number(r.tds), 0) };
});
