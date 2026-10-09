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
  (CURRENT_DATE - i.invoice_date) AS age_days,
  (SELECT string_agg(DISTINCT b.name, ', ') FROM company_brands b WHERE b.id=i.brand_id OR b.id IN (SELECT ii.brand_id FROM invoice_items ii WHERE ii.invoice_id=i.id)) AS brand_label
  FROM invoices i LEFT JOIN companies fc ON fc.id=i.from_company_id LEFT JOIN companies tc ON tc.id=i.to_company_id LEFT JOIN users u ON u.id=i.created_by LEFT JOIN users r ON r.id=i.reviewed_by`;

/**
 * The seller filter and the brand filter travel in one parameter: "12" (seller 12), "12:7" (seller 12, brand 7) or ":7" (any seller, brand 7).
 * Build it with scopeParam(searchParams) and pass it where sellerSql($n) is used.
 */
export const scopeParam = (u) => { const s = u.get('seller_id') || '', b = u.get('brand_id') || ''; return s || b ? `${s}:${b}` : null; };
export const sellerOf = (u) => u.get('seller_id') || null;
export const sellerSql = (n, alias = 'i') => {
  const S = `NULLIF(split_part($${n}::text, ':', 1), '')::int`, B = `NULLIF(split_part($${n}::text, ':', 2), '')::int`;
  return `((${S} IS NULL OR (${alias}.direction='sales' AND ${alias}.from_company_id=${S}) OR (${alias}.direction='purchase' AND ${alias}.to_company_id=${S}))
    AND (${B} IS NULL OR ${alias}.brand_id=${B} OR EXISTS (SELECT 1 FROM invoice_items bi WHERE bi.invoice_id=${alias}.id AND bi.brand_id=${B})))`;
};

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
