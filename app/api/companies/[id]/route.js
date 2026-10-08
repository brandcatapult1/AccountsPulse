import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { cleanContacts, cleanBanks, saveSellers } from '@/lib/companies';

export const PUT = route(async ({ req, user, params }) => {
  const b = await req.json(); const id = +params.id;
  if (!b.name?.trim()) bad('Legal name is required.');
  return tx(async (c) => {
    const { rows } = await c.query(
      `UPDATE companies SET name=$1,kind=$2,gstin=$3,pan=$4,tax_id=$5,address=$6,state=$7,contacts=$8,currency=$9,credit_days=$10,brand_name=$11,bank_accounts=$13 WHERE id=$12 RETURNING *`,
      [b.name.trim(), b.kind || 'client', b.gstin?.trim().toUpperCase() || null, b.pan?.trim().toUpperCase() || null, b.tax_id || null, b.address || null, b.state || null, JSON.stringify(cleanContacts(b.contacts)), (b.currency || 'INR').toUpperCase(), +b.credit_days || 0, b.brand_name?.trim() || null, id, JSON.stringify(cleanBanks(b.bank_accounts))]);
    if (!rows[0]) bad('Company not found.', 404);
    await saveSellers(c, id, rows[0].kind, b.seller_ids);
    await audit(c, user, 'company.update', 'company', id, { name: b.name });
    return rows[0];
  });
});

/** Team can delete a company nobody has used; Super Admin can archive a used one. */
export const DELETE = route(async ({ user, params }) => {
  const id = +params.id;
  return tx(async (c) => {
    const { rows } = await c.query('SELECT COUNT(*)::int n FROM invoices WHERE from_company_id=$1 OR to_company_id=$1', [id]);
    if (rows[0].n === 0) { await c.query('DELETE FROM companies WHERE id=$1', [id]); await audit(c, user, 'company.delete', 'company', id); return { ok: true, deleted: true }; }
    if (user.role !== 'admin') bad('This company has invoices, so only Super Admin can archive it.', 403);
    await c.query('UPDATE companies SET archived=true WHERE id=$1', [id]); await audit(c, user, 'company.archive', 'company', id);
    return { ok: true, archived: true };
  });
});
