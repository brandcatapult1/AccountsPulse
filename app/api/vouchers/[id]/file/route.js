import fs from 'node:fs/promises';
import path from 'node:path';
import { route, bad } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';
export const runtime = 'nodejs';
export const GET = route(async ({ user, params }) => {
  const ids = await visibleIds(user);
  const v = (await q('SELECT * FROM vouchers WHERE id=$1 AND ($2::int[] IS NULL OR created_by = ANY($2))', [+params.id, ids])).rows[0];
  if (!v?.file_path) bad('No attachment.', 404);
  const buf = await fs.readFile(path.join(path.resolve(process.env.UPLOAD_DIR || './storage/invoices'), 'vouchers', path.basename(v.file_path)));
  return new Response(buf, { headers: { 'Content-Type': v.file_mime, 'Content-Disposition': `inline; filename="${String(v.file_name).replace(/"/g, '')}"`, 'Cache-Control': 'private, max-age=60' } });
});
