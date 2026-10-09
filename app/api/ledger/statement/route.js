import { route, bad } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { sellerSql, scopeParam } from '@/lib/invoices';

/** Invoice-wise statement for one client or vendor, in INR: taxable value, TDS, GST, invoice total, amount received and what is still pending. */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const company = +u.get('company_id'); if (!company) bad('Choose a company.');
  const from = u.get('from') || '1900-01-01', to = u.get('to') || '2999-12-31', seller = scopeParam(u);
  const where = `i.status='approved' AND (i.doc_type='tax' OR i.paid > 0) AND (CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END)=$1
    AND ($2::int[] IS NULL OR i.created_by = ANY($2)) AND ${sellerSql(3)}`;
  const open = await q(`SELECT COALESCE(SUM(ROUND(GREATEST(i.total-i.paid,0)*i.fx_rate,2)),0) AS p FROM invoices i WHERE ${where} AND i.invoice_date < $4`, [company, ids, seller, from]);
  const { rows } = await q(
    `SELECT i.id, i.invoice_no, i.doc_type, i.direction, i.invoice_date, i.due_date, i.currency, i.fx_rate, i.total,
       ROUND(i.subtotal*i.fx_rate,2) AS taxable, ROUND((i.cgst+i.sgst+i.igst)*i.fx_rate,2) AS gst, i.total_inr AS total_inr,
       COALESCE((SELECT SUM(p.amount_inr) FROM payments p WHERE p.invoice_id=i.id AND NOT p.voided),0) AS receipt,
       COALESCE((SELECT SUM(p.tds) FROM payments p WHERE p.invoice_id=i.id AND NOT p.voided),0) AS tds,
       ROUND(GREATEST(i.total-i.paid,0)*i.fx_rate,2) AS pending,
       (SELECT string_agg(DISTINCT b.name, ', ') FROM company_brands b WHERE b.id=i.brand_id OR b.id IN (SELECT ii.brand_id FROM invoice_items ii WHERE ii.invoice_id=i.id)) AS brand_label,
       (SELECT json_agg(json_build_object('head',t.description,'details',t.details) ORDER BY t.sl,t.id) FROM invoice_items t WHERE t.invoice_id=i.id) AS items,
       (SELECT json_agg(json_build_object('date',p.paid_on,'mode',p.mode,'amount',p.amount_inr,'tds',p.tds,'details',p.details) ORDER BY p.paid_on,p.id) FROM payments p WHERE p.invoice_id=i.id AND NOT p.voided) AS receipts
     FROM invoices i WHERE ${where} AND i.invoice_date BETWEEN $4 AND $5 ORDER BY i.invoice_date, i.id`, [company, ids, seller, from, to]);
  const co = (await q('SELECT * FROM companies WHERE id=$1', [company])).rows[0];
  const carried = Number(co?.opening_balance || 0);
  const sum = (k) => Math.round(rows.reduce((s, r) => s + Number(r[k]), 0) * 100) / 100;
  return { company: co, opening_balance: carried, opening: Number(open.rows[0].p) + carried, rows, totals: { taxable: sum('taxable'), tds: sum('tds'), gst: sum('gst'), total: sum('total_inr'), receipt: sum('receipt'), pending: sum('pending') } };
});
