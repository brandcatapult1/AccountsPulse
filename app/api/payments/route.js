import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { sellerSql } from '@/lib/invoices';

const acct = (p) => (p.mode === 'Bank account' ? (p.details?.account || 'Bank (account not noted)') : p.mode === 'UPI' ? 'UPI' : p.mode === 'Cash' ? 'Cash' : 'Cheques');

/** Money received (sales) and paid to vendors (purchases), plus a summary by account that also counts petty cash and expenses. */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const dir = u.get('direction') === 'purchase' ? 'purchase' : 'sales', from = u.get('from'), to = u.get('to'), seller = u.get('seller_id') || null, co = u.get('company_id') || null, mode = u.get('mode') || null;
  const { rows } = await q(
    `SELECT p.id, p.paid_on, p.amount, p.amount_inr, p.tds, p.mode, p.details, p.note, p.created_at, ub.name AS by_name,
       i.id AS invoice_id, i.invoice_no, i.doc_type, i.currency, i.direction, c.name AS party_name, c.brand_name AS party_brand
     FROM payments p JOIN invoices i ON i.id=p.invoice_id
     JOIN companies c ON c.id = CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END
     LEFT JOIN users ub ON ub.id=p.recorded_by
     WHERE NOT p.voided AND i.direction=$1 AND p.paid_on BETWEEN $2 AND $3 AND ($4::int[] IS NULL OR i.created_by = ANY($4)) AND ${sellerSql(5)}
       AND ($6::int IS NULL OR c.id=$6) AND ($7::text IS NULL OR p.mode=$7) ORDER BY p.paid_on DESC, p.id DESC`, [dir, from, to, ids, seller, co, mode]);
  const total = rows.reduce((s, r) => s + Number(r.amount_inr), 0), tds = rows.reduce((s, r) => s + Number(r.tds), 0);
  const byMode = {}; for (const r of rows) byMode[r.mode] = (byMode[r.mode] || 0) + Number(r.amount_inr);

  // bank summary: every account, money in and out, all directions
  const all = await q(
    `SELECT p.amount_inr, p.mode, p.details, i.direction FROM payments p JOIN invoices i ON i.id=p.invoice_id
     WHERE NOT p.voided AND p.paid_on BETWEEN $1 AND $2 AND ($3::int[] IS NULL OR i.created_by = ANY($3)) AND ${sellerSql(4)}`, [from, to, ids, seller]);
  const vs = await q(`SELECT v.kind, v.amount, v.source, v.account FROM vouchers v WHERE v.voucher_date BETWEEN $1 AND $2 AND ($3::int[] IS NULL OR v.created_by = ANY($3)) AND ($4::int IS NULL OR v.seller_id=$4)`, [from, to, ids, seller]);
  const acc = {}; const A = (k) => (acc[k] ||= { account: k, in: 0, out: 0 });
  for (const p of all.rows) { const a = A(acct(p)); if (p.direction === 'sales') a.in += Number(p.amount_inr); else a.out += Number(p.amount_inr); }
  for (const v of vs.rows) {
    if (v.kind === 'petty_in') A('Petty cash').in += Number(v.amount);
    else A(v.source === 'Petty cash' ? 'Petty cash' : acct({ mode: v.source, details: { account: v.account } })).out += Number(v.amount);
  }
  return { rows: rows.map((r) => ({ ...r, account: acct(r) })), total, tds, by_mode: byMode, accounts: Object.values(acc).sort((a, b) => b.in + b.out - (a.in + a.out)) };
}, { roles: ['admin', 'lead'] });
