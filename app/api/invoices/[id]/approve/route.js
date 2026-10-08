import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';
import { postInvoice, convertAdvance, stageFor } from '@/lib/ledger';

export const POST = route(async ({ user, params }) => {
  const id = +params.id;
  return tx(async (c) => {
    const inv = await loadInvoice(user, id, c);
    if (inv.status !== 'review') bad('This invoice is not in review.', 409);
    if (!inv.invoice_no) bad('Invoice number is required.');
    if (!inv.invoice_date) bad('Invoice date is required.');
    if (!inv.from_company_id || !inv.to_company_id) bad('Choose both the From and To company.');
    if (!(Number(inv.total) > 0)) bad('Total must be above zero.');
    if (inv.currency !== 'INR' && !(Number(inv.fx_rate) > 0 && Number(inv.fx_rate) !== 1)) bad('Enter the exchange rate for this foreign-currency invoice.');
    const items = (await c.query('SELECT COALESCE(SUM(amount),0) s FROM invoice_items WHERE invoice_id=$1', [id])).rows[0].s;
    if (Math.abs(Number(items) - Number(inv.subtotal)) > 0.5) bad(`Line items add up to ${items} but the subtotal is ${inv.subtotal}.`);
    if (Math.abs(Number(inv.subtotal) + Number(inv.cgst) + Number(inv.sgst) + Number(inv.igst) - Number(inv.total)) > 1) bad('Subtotal + tax does not match the total.');
    await c.query(`UPDATE invoices SET status='approved', approved_by=$1, approved_at=now(), reviewed_by=$1, reviewed_at=now() WHERE id=$2`, [user.id, id]);
    if (inv.doc_type === 'tax') {
      await postInvoice(c, inv);
      if (inv.linked_proforma_id) {
        const pf = (await c.query('SELECT * FROM invoices WHERE id=$1', [inv.linked_proforma_id])).rows[0];
        if (pf) {
          const moved = await convertAdvance(c, inv, pf);
          await c.query(`UPDATE invoices SET status='converted', paid=0, stage='received' WHERE id=$1`, [pf.id]);
          if (moved > 0) await c.query('UPDATE invoices SET paid=$1, stage=$2 WHERE id=$3', [moved, stageFor(inv.total, moved) || 'pending', id]);
          await audit(c, user, 'proforma.convert', 'invoice', pf.id, { to: inv.invoice_no });
        }
      }
    }
    await audit(c, user, 'invoice.approve', 'invoice', id, { docType: inv.doc_type });
    return { ok: true };
  });
});
