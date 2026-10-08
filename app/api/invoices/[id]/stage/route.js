import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';

/** board drag between Pending and Promised */
export const POST = route(async ({ req, user, params }) => {
  const { stage, promised_date } = await req.json(); const id = +params.id;
  if (!['pending', 'promised'].includes(stage)) bad('Use the payment form to move a card to Part paid or Received.');
  return tx(async (c) => {
    const inv = await loadInvoice(user, id, c);
    if (inv.status !== 'approved') bad('Only approved invoices are on the board.', 409);
    if (inv.stage === 'received') bad('This invoice is fully paid.', 409);
    const next = Number(inv.paid) > 0 && stage === 'pending' ? 'part' : Number(inv.paid) > 0 ? 'part' : stage;
    await c.query('UPDATE invoices SET stage=$1, promised_date=$2 WHERE id=$3', [next, stage === 'promised' ? promised_date || null : null, id]);
    await audit(c, user, 'invoice.stage', 'invoice', id, { stage, promised_date });
    return { ok: true, stage: next };
  });
});
