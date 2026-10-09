import fs from 'node:fs/promises';
import path from 'node:path';
import { route, bad, audit } from '@/lib/api';
import { q, tx } from '@/lib/db';
import { visibleIds } from '@/lib/auth';

export const DELETE = route(async ({ user, params }) => {
  const id = +params.id, ids = await visibleIds(user);
  const file = await tx(async (c) => {
    const v = (await c.query('SELECT * FROM vouchers WHERE id=$1 AND ($2::int[] IS NULL OR created_by = ANY($2))', [id, ids])).rows[0];
    if (!v) bad('Entry not found.', 404);
    await c.query('DELETE FROM vouchers WHERE id=$1', [id]);
    await audit(c, user, 'voucher.delete', 'voucher', id, { kind: v.kind, amount: v.amount, category: v.category, description: v.description });
    return v.file_path;
  });
  if (file) await fs.unlink(path.join(path.resolve(process.env.UPLOAD_DIR || './storage/invoices'), 'vouchers', path.basename(file))).catch(() => {});
  return { ok: true };
});
