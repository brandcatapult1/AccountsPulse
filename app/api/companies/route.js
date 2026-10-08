import { route, bad, audit } from '@/lib/api';
import { q, tx } from '@/lib/db';

export const GET = route(async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const kind = u.get('kind'); const s = u.get('q');
  const { rows } = await q(
    `SELECT c.*, COALESCE((SELECT SUM(CASE WHEN l.account IN ('Receivable') THEN l.debit-l.credit WHEN l.account='Payable' THEN l.debit-l.credit ELSE 0 END)
       FROM ledger_entries l WHERE l.company_id=c.id),0) AS balance,
       (SELECT COUNT(*) FROM invoices i WHERE i.from_company_id=c.id OR i.to_company_id=c.id)::int AS invoice_count
     FROM companies c WHERE NOT c.archived AND ($1::text IS NULL OR c.kind=$1) AND ($2::text IS NULL OR c.name ILIKE '%'||$2||'%' OR c.gstin ILIKE '%'||$2||'%') ORDER BY c.name`, [kind, s]);
  return rows;
});

export const POST = route(async ({ req, user }) => {
  const b = await req.json();
  if (!b.name?.trim()) bad('Company name is required.');
  return tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO companies (name,kind,gstin,pan,tax_id,address,state,contact,currency,credit_days,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.name.trim(), b.kind || 'client', b.gstin?.trim().toUpperCase() || null, b.pan?.trim().toUpperCase() || null, b.tax_id || null, b.address || null, b.state || null, b.contact || null, (b.currency || 'INR').toUpperCase(), +b.credit_days || 0, user.id]);
    await audit(c, user, 'company.create', 'company', rows[0].id, { name: b.name });
    return rows[0];
  });
});
