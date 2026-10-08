import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';
export const POST = route(async ({ req, user, params }) => {
  const b = await req.json(); const id = +params.id;
  if (!b.note?.trim()) bad('Write a short note about the follow-up.');
  return tx(async (c) => {
    const inv = await loadInvoice(user, id, c);
    const { rows } = await c.query('INSERT INTO followups (invoice_id,channel,note,promised_date,by_user) VALUES ($1,$2,$3,$4,$5) RETURNING *', [id, b.channel || 'Call', b.note.trim(), b.promised_date || null, user.id]);
    if (b.promised_date && inv.stage !== 'received' && inv.stage !== 'part') await c.query(`UPDATE invoices SET promised_date=$1, stage='promised' WHERE id=$2`, [b.promised_date, id]);
    await audit(c, user, 'followup.add', 'invoice', id);
    return rows[0];
  });
});
