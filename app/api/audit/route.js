import { route } from '@/lib/api';
import { q } from '@/lib/db';

/** Dates and times are read as Indian time (IST). A time range is a daily window, e.g. 09:00 to 18:00 on each day in the date range. */
export const GET = route(async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const val = (k) => u.get(k) || null;
  const params = [val('from'), val('to'), val('from_time'), val('to_time'), val('user_id'), val('action'), val('q')];
  const size = Math.min(Math.max(+u.get('page_size') || 25, 1), 100), page = Math.max(+u.get('page') || 1, 1);
  const where = `($1::date IS NULL OR (a.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date)
    AND ($2::date IS NULL OR (a.created_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date)
    AND ($3::time IS NULL OR (a.created_at AT TIME ZONE 'Asia/Kolkata')::time >= $3::time)
    AND ($4::time IS NULL OR (a.created_at AT TIME ZONE 'Asia/Kolkata')::time <= ($4::time + interval '59 seconds'))
    AND ($5::int IS NULL OR a.user_id=$5::int) AND ($6::text IS NULL OR a.action LIKE $6::text || '%')
    AND ($7::text IS NULL OR a.detail::text ILIKE '%'||$7::text||'%' OR a.entity_id::text=$7::text)`;
  const [rows, count, users, actions] = await Promise.all([
    q(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE ${where} ORDER BY a.id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, params),
    q(`SELECT COUNT(*)::int AS n FROM audit_log a WHERE ${where}`, params),
    q(`SELECT id, name FROM users ORDER BY name`),
    q(`SELECT DISTINCT split_part(action,'.',1) AS a FROM audit_log ORDER BY 1`),
  ]);
  return { rows: rows.rows, page, size, total: count.rows[0].n, users: users.rows, actions: actions.rows.map((r) => r.a) };
}, { roles: ['admin'] });
