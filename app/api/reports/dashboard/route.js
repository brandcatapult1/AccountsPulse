import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';

export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams;
  const from = u.get('from'), to = u.get('to'), ids = await visibleIds(user), co = u.get('company_id') || null;
  const owner = u.get('owner') === 'me' ? user.id : u.get('owner') || null;
  const W = `i.status='approved' AND ($1::int[] IS NULL OR i.created_by = ANY($1)) AND i.invoice_date BETWEEN $2 AND $3 AND ($4::int IS NULL OR i.from_company_id=$4 OR i.to_company_id=$4) AND ($5::int IS NULL OR i.created_by=$5)`;
  const P = [ids, from, to, co, owner];
  const [k, sales, collected, months, ageing, fx, top, queue] = await Promise.all([
    q(`SELECT
        COALESCE(SUM(total_inr) FILTER (WHERE doc_type='tax' AND direction='sales'),0) AS billed,
        COALESCE(SUM(total_inr) FILTER (WHERE doc_type='proforma' AND direction='sales' AND stage<>'received'),0) AS pipeline,
        COUNT(*) FILTER (WHERE doc_type='proforma' AND direction='sales' AND stage<>'received')::int AS pipeline_n,
        COALESCE(SUM(ROUND(GREATEST(total-paid,0)*fx_rate,2)) FILTER (WHERE doc_type='tax' AND direction='sales' AND stage<>'received'),0) AS outstanding,
        COUNT(*) FILTER (WHERE doc_type='tax' AND direction='sales' AND stage<>'received')::int AS outstanding_n,
        COALESCE(SUM(ROUND(GREATEST(total-paid,0)*fx_rate,2)) FILTER (WHERE doc_type='tax' AND direction='sales' AND stage<>'received' AND due_date < CURRENT_DATE),0) AS overdue,
        COUNT(*) FILTER (WHERE doc_type='tax' AND direction='sales' AND stage<>'received' AND due_date < CURRENT_DATE)::int AS overdue_n,
        COALESCE(SUM(ROUND(GREATEST(total-paid,0)*fx_rate,2)) FILTER (WHERE doc_type='tax' AND direction='purchase' AND stage<>'received'),0) AS payable
       FROM invoices i WHERE ${W}`, P),
    q(`SELECT COALESCE(SUM(l.credit),0) AS income FROM ledger_entries l JOIN invoices i ON i.id=l.invoice_id WHERE l.account IN ('Sales income','Export income') AND ${W}`, P),
    q(`SELECT COALESCE(SUM(p.amount_inr + p.tds),0) AS c FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE NOT p.voided AND i.direction='sales' AND i.status IN ('approved','converted') AND ($1::int[] IS NULL OR i.created_by = ANY($1)) AND p.paid_on BETWEEN $2 AND $3 AND ($4::int IS NULL OR i.from_company_id=$4 OR i.to_company_id=$4)`, P.slice(0, 4)),
    q(`SELECT to_char(date_trunc('month', i.invoice_date),'YYYY-MM') AS m,
        COALESCE(SUM(total_inr) FILTER (WHERE doc_type='tax' AND direction='sales'),0) AS billed,
        COALESCE(SUM(total_inr) FILTER (WHERE doc_type='proforma' AND direction='sales'),0) AS proforma,
        COALESCE(SUM(ROUND(paid*fx_rate,2)) FILTER (WHERE direction='sales' AND doc_type='tax'),0) AS collected
       FROM invoices i WHERE ${W} GROUP BY 1 ORDER BY 1`, P),
    q(`SELECT CASE WHEN age<=30 THEN 'a' WHEN age<=60 THEN 'b' WHEN age<=90 THEN 'c' ELSE 'd' END AS bucket, SUM(due)::numeric AS amt FROM (
         SELECT (CURRENT_DATE-i.invoice_date) AS age, ROUND(GREATEST(total-paid,0)*fx_rate,2) AS due FROM invoices i WHERE ${W} AND direction='sales' AND stage<>'received') t GROUP BY 1`, P),
    q(`SELECT currency, SUM(GREATEST(total-paid,0)) AS orig, SUM(ROUND(GREATEST(total-paid,0)*fx_rate,2)) AS inr FROM invoices i WHERE ${W} AND currency<>'INR' AND stage<>'received' GROUP BY currency`, P),
    q(`SELECT c.name, COUNT(*)::int AS n, SUM(ROUND(GREATEST(total-paid,0)*fx_rate,2)) AS due, MIN(i.due_date) AS oldest_due FROM invoices i JOIN companies c ON c.id = CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END
        WHERE ${W} AND i.stage<>'received' AND i.direction='sales' GROUP BY c.name ORDER BY due DESC LIMIT 5`, P),
    q(`SELECT i.id,i.invoice_no,i.doc_type,u.name AS created_name,fc.name AS from_name,tc.name AS to_name,i.flags FROM invoices i LEFT JOIN users u ON u.id=i.created_by LEFT JOIN companies fc ON fc.id=i.from_company_id LEFT JOIN companies tc ON tc.id=i.to_company_id WHERE i.status='review' AND ($1::int[] IS NULL OR i.created_by = ANY($1)) ORDER BY i.created_at DESC LIMIT 8`, [ids]),
  ]);
  const exp = await q(`SELECT COALESCE(SUM(l.debit),0) AS e FROM ledger_entries l JOIN invoices i ON i.id=l.invoice_id WHERE l.account IN ('Purchases / expenses','Exchange loss') AND ${W}`, P);
  const gain = await q(`SELECT COALESCE(SUM(l.credit),0) AS g FROM ledger_entries l JOIN invoices i ON i.id=l.invoice_id WHERE l.account='Exchange gain' AND ${W}`, P);
  const income = Number(sales.rows[0].income) + Number(gain.rows[0].g);
  return { kpis: { ...k.rows[0], collected: collected.rows[0].c, income, expenses: Number(exp.rows[0].e), profit: income - Number(exp.rows[0].e) },
    months: months.rows, ageing: Object.fromEntries(['a', 'b', 'c', 'd'].map((x) => [x, Number(ageing.rows.find((r) => r.bucket === x)?.amt || 0)])), fx: fx.rows, top: top.rows, queue: queue.rows };
});
