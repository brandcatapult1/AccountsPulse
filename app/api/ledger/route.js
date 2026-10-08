import { route, bad } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';

export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams;
  const company = +u.get('company_id'); if (!company) bad('Choose a company.');
  const from = u.get('from') || '1900-01-01', to = u.get('to') || '2999-12-31';
  const ids = await visibleIds(user);
  const base = `FROM ledger_entries l LEFT JOIN invoices i ON i.id=l.invoice_id WHERE l.company_id=$1 AND l.account IN ('Receivable','Payable','Customer advances','Vendor advances') AND ($2::int[] IS NULL OR i.created_by = ANY($2))`;
  const op = await q(`SELECT COALESCE(SUM(l.debit-l.credit),0) AS b ${base} AND l.entry_date < $3`, [company, ids, from]);
  const { rows } = await q(`SELECT l.*, i.invoice_no, i.doc_type, i.currency, i.total, i.fx_rate, i.direction ${base} AND l.entry_date BETWEEN $3 AND $4 ORDER BY l.entry_date, l.id`, [company, ids, from, to]);
  let bal = Number(op.rows[0].b);
  const entries = rows.map((r) => { bal += Number(r.debit) - Number(r.credit); return { ...r, balance: Math.round(bal * 100) / 100 }; });
  const co = (await q('SELECT * FROM companies WHERE id=$1', [company])).rows[0];
  return { company: co, opening: Number(op.rows[0].b), entries, closing: bal,
    debits: rows.reduce((s, r) => s + Number(r.debit), 0), credits: rows.reduce((s, r) => s + Number(r.credit), 0) };
});
