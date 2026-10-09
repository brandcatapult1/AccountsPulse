import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { sellerSql, scopeParam } from '@/lib/invoices';

const INCOME = ['Sales income', 'Export income', 'Exchange gain'], EXPENSE = ['Purchases / expenses', 'Exchange loss'];

async function period(ids, from, to, entity, seller) {
  const { rows } = await q(
    `SELECT l.account, to_char(date_trunc('month', l.entry_date),'YYYY-MM') AS m, SUM(l.credit) - SUM(l.debit) AS net
     FROM ledger_entries l LEFT JOIN invoices i ON i.id=l.invoice_id LEFT JOIN vouchers v ON v.id=l.voucher_id
     WHERE (l.account = ANY($1) OR l.account LIKE 'Expense:%') AND l.entry_date BETWEEN $2 AND $3
       AND (
         (i.id IS NOT NULL AND ($4::int[] IS NULL OR i.created_by = ANY($4)) AND ($5::int IS NULL OR i.from_company_id=$5 OR i.to_company_id=$5) AND ${sellerSql(6)})
         OR (v.id IS NOT NULL AND $5::int IS NULL AND NULLIF(split_part($6::text, ':', 2), '') IS NULL AND ($4::int[] IS NULL OR v.created_by = ANY($4)) AND (NULLIF(split_part($6::text, ':', 1), '') IS NULL OR v.seller_id=NULLIF(split_part($6::text, ':', 1), '')::int))
       )
     GROUP BY 1,2 ORDER BY 2`, [[...INCOME, ...EXPENSE], from, to, ids, entity, seller]);
  return rows;
}
const isExpense = (a) => EXPENSE.includes(a) || a.startsWith('Expense:');
const sumBy = (rows) => rows.reduce((a, r) => { a[r.account] = (a[r.account] || 0) + Number(r.net); return a; }, {});

export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user), entity = u.get('company_id') || null;
  const seller = scopeParam(u);
  const [cur, prev] = await Promise.all([period(ids, u.get('from'), u.get('to'), entity, seller), period(ids, u.get('pfrom'), u.get('pto'), entity, seller)]);
  const a = sumBy(cur), b = sumBy(prev);
  const names = (cur_, prev_, test) => [...new Set([...cur_, ...prev_].map((r) => r.account).filter(test))];
  const lines = (names, sign) => names.map((n) => ({ account: n, current: sign * (a[n] || 0), previous: sign * (b[n] || 0) })).filter((l) => l.current || l.previous);
  const income = lines(INCOME, 1), expenses = lines(names(cur, prev, isExpense), -1);
  const tot = (ls, k) => ls.reduce((s, l) => s + l[k], 0);
  const months = {};
  for (const r of cur) { months[r.m] ||= { income: 0, expense: 0 }; if (INCOME.includes(r.account)) months[r.m].income += Number(r.net); else months[r.m].expense -= Number(r.net); }
  return { income, expenses, totals: { income: tot(income, 'current'), incomePrev: tot(income, 'previous'), expense: tot(expenses, 'current'), expensePrev: tot(expenses, 'previous') },
    months: Object.entries(months).map(([m, v]) => ({ m, ...v })) };
});
