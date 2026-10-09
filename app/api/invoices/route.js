import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
import { LIST_SQL, sellerSql } from '@/lib/invoices';

export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams;
  const ids = await visibleIds(user);
  const owner = u.get('owner'); // 'me' | user id | null
  const W = `($1::int[] IS NULL OR i.created_by = ANY($1))
      AND ($2::text IS NULL OR i.status=$2) AND ($3::text IS NULL OR i.doc_type=$3) AND ($4::text IS NULL OR i.direction=$4)
      AND ($5::int IS NULL OR i.from_company_id=$5 OR i.to_company_id=$5)
      AND ($6::int IS NULL OR i.created_by=$6)
      AND ($7::text IS NULL OR i.stage=$7) AND ($8::date IS NULL OR i.invoice_date>=$8) AND ($9::date IS NULL OR i.invoice_date<=$9)
      AND ($10::text IS NULL OR i.invoice_no ILIKE '%'||$10||'%' OR fc.name ILIKE '%'||$10||'%' OR tc.name ILIKE '%'||$10||'%' OR fc.brand_name ILIKE '%'||$10||'%' OR tc.brand_name ILIKE '%'||$10||'%')
      AND ${sellerSql(11)}`;
  const P = [ids, u.get('status'), u.get('doc_type'), u.get('direction'), u.get('company_id') || null, owner === 'me' ? user.id : owner || null, u.get('stage'), u.get('from') || null, u.get('to') || null, u.get('q'), u.get('seller_id') || null];
  if (u.get('paged') === '1') {
    const size = Math.min(Math.max(+u.get('page_size') || 25, 1), 100), page = Math.max(+u.get('page') || 1, 1);
    const [rows, count] = await Promise.all([
      q(`${LIST_SQL} WHERE ${W} ORDER BY i.created_at DESC, i.id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, P),
      q(`SELECT COUNT(*)::int AS n FROM invoices i LEFT JOIN companies fc ON fc.id=i.from_company_id LEFT JOIN companies tc ON tc.id=i.to_company_id WHERE ${W}`, P),
    ]);
    return { rows: rows.rows, total: count.rows[0].n, page, size };
  }
  const { rows } = await q(`${LIST_SQL} WHERE ${W} ORDER BY i.created_at DESC LIMIT 500`, P);
  return rows;
});
