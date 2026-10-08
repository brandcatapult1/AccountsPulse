import { q } from './db';
import { visibleIds } from './auth';
import { bad } from './api';

export const LIST_SQL = `SELECT i.*, fc.name AS from_name, tc.name AS to_name, u.name AS created_name, r.name AS reviewed_name,
  (CASE WHEN i.direction='sales' THEN tc.name ELSE fc.name END) AS party_name,
  (CASE WHEN i.direction='sales' THEN tc.brand_name ELSE fc.brand_name END) AS party_brand,
  (CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END) AS party_id,
  (CASE WHEN i.direction='sales' THEN i.from_company_id ELSE i.to_company_id END) AS seller_id,
  GREATEST(i.total - i.paid, 0) AS due,
  ROUND(GREATEST(i.total - i.paid, 0) * i.fx_rate, 2) AS due_inr,
  (CURRENT_DATE - i.invoice_date) AS age_days
  FROM invoices i LEFT JOIN companies fc ON fc.id=i.from_company_id LEFT JOIN companies tc ON tc.id=i.to_company_id LEFT JOIN users u ON u.id=i.created_by LEFT JOIN users r ON r.id=i.reviewed_by`;

/** SQL fragment: invoice belongs to the seller in parameter $n (our entity is the seller on sales and the buyer on purchases) */
export const sellerSql = (n, alias = 'i') => `($${n}::int IS NULL OR (${alias}.direction='sales' AND ${alias}.from_company_id=$${n}) OR (${alias}.direction='purchase' AND ${alias}.to_company_id=$${n}))`;

/** load one invoice the user is allowed to see */
export async function loadInvoice(user, id, c = { query: q }) {
  const ids = await visibleIds(user);
  const { rows } = await c.query(`${LIST_SQL} WHERE i.id=$1 AND ($2::int[] IS NULL OR i.created_by = ANY($2))`, [id, ids]);
  if (!rows[0]) bad('Invoice not found.', 404);
  return rows[0];
}

/** remember which client/vendor works with which seller */
export async function linkParty(c, direction, fromId, toId) {
  const seller = direction === 'sales' ? fromId : toId, party = direction === 'sales' ? toId : fromId;
  if (seller && party && seller !== party) await c.query('INSERT INTO company_sellers (company_id, seller_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [party, seller]);
}
