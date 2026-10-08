import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';
export const POST = route(async ({ req, user, params }) => {
  const id = +params.id; const { reason } = await req.json().catch(() => ({}));
  return tx(async (c) => {
    const inv = await loadInvoice(user, id, c);
    if (inv.status !== 'review') bad('Only invoices in review can be rejected.', 409);
    await c.query(`UPDATE invoices SET status='rejected', notes=COALESCE($1,notes), reviewed_by=$3, reviewed_at=now() WHERE id=$2`, [reason || null, id, user.id]);
    await audit(c, user, 'invoice.reject', 'invoice', id, { reason });
    return { ok: true };
  });
});
