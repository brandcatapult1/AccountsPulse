import { q } from './db';
import { visibleIds } from './auth';
import { bad } from './api';

export const LIST_SQL = `SELECT i.*, fc.name AS from_name, tc.name AS to_name, u.name AS created_name,
  (CASE WHEN i.direction='sales' THEN tc.name ELSE fc.name END) AS party_name,
  (CASE WHEN i.direction='sales' THEN i.to_company_id ELSE i.from_company_id END) AS party_id,
  GREATEST(i.total - i.paid, 0) AS due,
  ROUND(GREATEST(i.total - i.paid, 0) * i.fx_rate, 2) AS due_inr,
  (CURRENT_DATE - i.invoice_date) AS age_days
  FROM invoices i LEFT JOIN companies fc ON fc.id=i.from_company_id LEFT JOIN companies tc ON tc.id=i.to_company_id LEFT JOIN users u ON u.id=i.created_by`;

/** load one invoice the user is allowed to see */
export async function loadInvoice(user, id, c = { query: q }) {
  const ids = await visibleIds(user);
  const { rows } = await c.query(`${LIST_SQL} WHERE i.id=$1 AND ($2::int[] IS NULL OR i.created_by = ANY($2))`, [id, ids]);
  if (!rows[0]) bad('Invoice not found.', 404);
  return rows[0];
}
