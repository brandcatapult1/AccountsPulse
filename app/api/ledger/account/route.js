import { route, bad } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';

/** Ledger for one account (a bank account, Cash in hand, Petty cash, an expense head, GST…) across invoices, payments and vouchers. */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const account = u.get('account'); if (!account) bad('Choose an account.');
  const from = u.get('from') || '1900-01-01', to = u.get('to') || '2999-12-31', seller = u.get('seller_id') || null;
  const base = `FROM ledger_entries l LEFT JOIN invoices i ON i.id=l.invoice_id LEFT JOIN vouchers v ON v.id=l.voucher_id LEFT JOIN companies pc ON pc.id=l.company_id
    WHERE l.account=$1 AND ($2::int[] IS NULL OR (i.id IS NOT NULL AND i.created_by = ANY($2)) OR (v.id IS NOT NULL AND v.created_by = ANY($2)))
      AND ($3::int IS NULL OR (i.id IS NOT NULL AND ((i.direction='sales' AND i.from_company_id=$3) OR (i.direction='purchase' AND i.to_company_id=$3))) OR (v.id IS NOT NULL AND v.seller_id=$3))`;
  const op = await q(`SELECT COALESCE(SUM(l.debit-l.credit),0) AS b ${base} AND l.entry_date < $4`, [account, ids, seller, from]);
  const { rows } = await q(`SELECT l.*, i.invoice_no, v.kind AS voucher_kind, v.category, pc.name AS party_name ${base} AND l.entry_date BETWEEN $4 AND $5 ORDER BY l.entry_date, l.id`, [account, ids, seller, from, to]);
  let bal = Number(op.rows[0].b);
  const entries = rows.map((r) => { bal += Number(r.debit) - Number(r.credit); return { ...r, balance: Math.round(bal * 100) / 100 }; });
  return { account, opening: Number(op.rows[0].b), entries, closing: bal, debits: rows.reduce((s, r) => s + Number(r.debit), 0), credits: rows.reduce((s, r) => s + Number(r.credit), 0) };
}, { roles: ['admin', 'lead'] });
