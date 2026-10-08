import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';
export const POST = route(async ({ req, user, params }) => {
  const id = +params.id; const { reason } = await req.json().catch(() => ({}));
  if (!reason?.trim()) bad('Give a reason for reopening.');
  return tx(async (c) => {
    const inv = await loadInvoice(user, id, c);
    if (inv.status !== 'approved') bad('Only approved invoices can be reopened.', 409);
    const p = await c.query('SELECT COUNT(*)::int n FROM payments WHERE invoice_id=$1 AND NOT voided', [id]);
    if (p.rows[0].n) bad('This invoice has payments. Void them first.', 409);
    await c.query('DELETE FROM ledger_entries WHERE invoice_id=$1', [id]);
    await c.query(`UPDATE invoices SET status='review', approved_by=NULL, approved_at=NULL WHERE id=$1`, [id]);
    await audit(c, user, 'invoice.reopen', 'invoice', id, { reason });
    return { ok: true };
  });
}, { roles: ['admin'] });
