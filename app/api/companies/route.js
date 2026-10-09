import { route, bad, audit } from '@/lib/api';
import { q, tx } from '@/lib/db';
import { cleanContacts, cleanBanks, saveSellers, openingOf } from '@/lib/companies';
import { saveBrands } from '@/lib/brands';

export const GET = route(async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const kind = u.get('kind'), s = u.get('q'), seller = u.get('seller_id') && u.get('all') !== '1' ? +u.get('seller_id') : null;
  const { rows } = await q(
    `SELECT c.*, COALESCE((SELECT SUM(l.debit-l.credit) FROM ledger_entries l WHERE l.company_id=c.id AND l.account IN ('Receivable','Payable')),0) + c.opening_balance AS balance,
       (SELECT COUNT(*) FROM invoices i WHERE i.from_company_id=c.id OR i.to_company_id=c.id)::int AS invoice_count,
       COALESCE((SELECT json_agg(json_build_object('id', bb.id, 'name', bb.name) ORDER BY bb.name) FROM company_brands bb WHERE bb.company_id=c.id), '[]') AS brands,
       COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name) FROM company_sellers cs JOIN companies s ON s.id=cs.seller_id WHERE cs.company_id=c.id), '[]') AS sellers
     FROM companies c WHERE NOT c.archived AND ($1::text IS NULL OR c.kind=$1)
       AND ($2::text IS NULL OR c.name ILIKE '%'||$2||'%' OR c.brand_name ILIKE '%'||$2||'%' OR c.gstin ILIKE '%'||$2||'%' OR c.contacts::text ILIKE '%'||$2||'%')
       AND ($3::int IS NULL OR c.id=$3 OR EXISTS (SELECT 1 FROM company_sellers cs WHERE cs.company_id=c.id AND cs.seller_id=$3))
     ORDER BY c.kind='own' DESC, c.name`, [kind, s, seller]);
  return rows;
});

export const POST = route(async ({ req, user }) => {
  const b = await req.json();
  if (!b.name?.trim()) bad('Legal name is required.');
  return tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO companies (name,brand_name,kind,gstin,pan,tax_id,address,state,contacts,currency,credit_days,created_by,bank_accounts,opening_balance) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [b.name.trim(), b.brand_name?.trim() || null, b.kind || 'client', b.gstin?.trim().toUpperCase() || null, b.pan?.trim().toUpperCase() || null, b.tax_id || null, b.address || null, b.state || null, JSON.stringify(cleanContacts(b.contacts)), (b.currency || 'INR').toUpperCase(), +b.credit_days || 0, user.id, JSON.stringify(cleanBanks(b.bank_accounts)), openingOf(b)]);
    await saveSellers(c, rows[0].id, rows[0].kind, b.seller_ids);
    await saveBrands(c, rows[0].id, b.brands ?? (b.brand_name ? [b.brand_name] : []));
    await audit(c, user, 'company.create', 'company', rows[0].id, { name: b.name, kind: rows[0].kind });
    return rows[0];
  });
});
