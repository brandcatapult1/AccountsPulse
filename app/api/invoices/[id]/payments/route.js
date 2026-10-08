import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';
import { postPayment, stageFor } from '@/lib/ledger';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const MODES = ['Bank account', 'UPI', 'Cash', 'Cheque'];

async function recompute(c, id) {
  const inv = (await c.query('SELECT total FROM invoices WHERE id=$1', [id])).rows[0];
  const paid = Number((await c.query('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE invoice_id=$1 AND NOT voided', [id])).rows[0].s);
  const stage = stageFor(Number(inv.total), paid);
  await c.query(`UPDATE invoices SET paid=$1, stage=COALESCE($2, CASE WHEN promised_date IS NOT NULL THEN 'promised' ELSE 'pending' END) WHERE id=$3`, [paid, stage, id]);
}

export const POST = route(async ({ req, user, params }) => {
  const b = await req.json(); const id = +params.id;
  if (!MODES.includes(b.mode)) bad('Choose how the payment was received.');
  const amount = r2(b.amount); if (!(amount > 0)) bad('Enter the amount received.');
  if (!b.paid_on) bad('Enter the date received.');
  return tx(async (c) => {
    const inv = await loadInvoice(user, id, c);
    if (inv.status !== 'approved') bad('Approve the invoice before recording a payment.', 409);
    const due = r2(inv.total - inv.paid);
    if (amount > due + 0.01) bad(`Amount is more than the ${due} still due.`);
    const tds = r2(b.tds);
    const inr = b.amount_inr != null && b.amount_inr !== '' ? r2(b.amount_inr) : r2(amount * Number(inv.fx_rate) - tds);
    const bounced = b.mode === 'Cheque' && b.details?.status === 'Bounced';
    const { rows } = await c.query(
      `INSERT INTO payments (invoice_id,paid_on,amount,amount_inr,tds,mode,details,note,voided,recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, b.paid_on, amount, inr, tds, b.mode, JSON.stringify(b.details || {}), b.note || null, bounced, user.id]);
    if (!bounced) await postPayment(c, inv, rows[0], { advance: inv.doc_type === 'proforma' });
    await recompute(c, id);
    await audit(c, user, 'payment.record', 'invoice', id, { amount, mode: b.mode });
    return rows[0];
  });
});

/** bounce a cheque (any user with access) or void a payment (Super Admin) */
export const PUT = route(async ({ req, user, params }) => {
  const { payment_id, action } = await req.json(); const id = +params.id;
  if (action === 'void' && user.role !== 'admin') bad('Only Super Admin can void a payment.', 403);
  return tx(async (c) => {
    await loadInvoice(user, id, c);
    const p = (await c.query('SELECT * FROM payments WHERE id=$1 AND invoice_id=$2 AND NOT voided', [payment_id, id])).rows[0];
    if (!p) bad('Payment not found.', 404);
    if (action === 'bounce' && p.mode !== 'Cheque') bad('Only cheques can bounce.');
    await c.query('DELETE FROM ledger_entries WHERE payment_id=$1', [payment_id]);
    await c.query(`UPDATE payments SET voided=true, details = details || $2::jsonb WHERE id=$1`, [payment_id, JSON.stringify(action === 'bounce' ? { status: 'Bounced' } : { voidedBy: user.id })]);
    await recompute(c, id);
    await audit(c, user, `payment.${action}`, 'invoice', id, { payment_id });
    return { ok: true };
  });
});
