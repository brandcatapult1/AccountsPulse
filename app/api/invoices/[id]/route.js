import { route, bad, audit } from '@/lib/api';
import { q, tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const GET = route(async ({ user, params }) => {
  const inv = await loadInvoice(user, +params.id);
  const [items, pays, fups, from, to] = await Promise.all([
    q('SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY sl,id', [inv.id]),
    q(`SELECT p.*, u.name AS by_name FROM payments p LEFT JOIN users u ON u.id=p.recorded_by WHERE p.invoice_id=$1 ORDER BY p.paid_on, p.id`, [inv.id]),
    q(`SELECT f.*, u.name AS by_name FROM followups f LEFT JOIN users u ON u.id=f.by_user WHERE f.invoice_id=$1 ORDER BY f.created_at DESC`, [inv.id]),
    inv.from_company_id ? q('SELECT * FROM companies WHERE id=$1', [inv.from_company_id]) : { rows: [] },
    inv.to_company_id ? q('SELECT * FROM companies WHERE id=$1', [inv.to_company_id]) : { rows: [] },
  ]);
  const proforma = inv.linked_proforma_id ? (await q('SELECT id,invoice_no FROM invoices WHERE id=$1', [inv.linked_proforma_id])).rows[0] : null;
  const converted = (await q('SELECT id,invoice_no FROM invoices WHERE linked_proforma_id=$1', [inv.id])).rows[0] || null;
  return { ...inv, items: items.rows, payments: pays.rows, followups: fups.rows, from: from.rows[0], to: to.rows[0], proforma, converted_to: converted };
});

/** edit while in review (or by Super Admin after approval before any payment) */
export const PUT = route(async ({ req, user, params }) => {
  const b = await req.json(); const id = +params.id;
  return tx(async (c) => {
    const inv = await loadInvoice(user, id, c);
    if (inv.status !== 'review') bad('Only invoices in review can be edited. Super Admin can reopen an approved one.', 409);
    const fx = b.currency === 'INR' ? 1 : +b.fx_rate;
    if (!(fx > 0)) bad('Enter the exchange rate.');
    const items = (b.items || []).map((i, n) => ({ sl: n + 1, description: i.description || '', hsn: i.hsn || '', qty: +i.qty || 1, rate: r2(i.rate), amount: r2(i.amount) }));
    const subtotal = r2(b.subtotal ?? items.reduce((s, i) => s + i.amount, 0));
    const total = r2(b.total ?? subtotal + r2(b.cgst) + r2(b.sgst) + r2(b.igst));
    await c.query(
      `UPDATE invoices SET direction=$1,doc_type=$2,invoice_no=$3,invoice_date=$4,due_date=$5,from_company_id=$6,to_company_id=$7,currency=$8,fx_rate=$9,fx_date=$10,
        subtotal=$11,cgst=$12,sgst=$13,igst=$14,total=$15,total_inr=$16,linked_proforma_id=$17,notes=$18 WHERE id=$19`,
      [b.direction, b.doc_type, b.invoice_no?.trim() || null, b.invoice_date || null, b.due_date || null, b.from_company_id || null, b.to_company_id || null, (b.currency || 'INR').toUpperCase(), fx, b.fx_date || null,
       subtotal, r2(b.cgst), r2(b.sgst), r2(b.igst), total, r2(total * fx), b.linked_proforma_id || null, b.notes || null, id]);
    await c.query('DELETE FROM invoice_items WHERE invoice_id=$1', [id]);
    for (const i of items) await c.query('INSERT INTO invoice_items (invoice_id,sl,description,hsn,qty,rate,amount) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, i.sl, i.description, i.hsn, i.qty, i.rate, i.amount]);
    await audit(c, user, 'invoice.edit', 'invoice', id);
    return { ok: true };
  });
});

export const DELETE = route(async ({ user, params }) => {
  const id = +params.id;
  return tx(async (c) => {
    const p = await c.query('SELECT COUNT(*)::int n FROM payments WHERE invoice_id=$1 AND NOT voided', [id]);
    if (p.rows[0].n) bad('Void its payments first.', 409);
    await c.query('DELETE FROM invoices WHERE id=$1', [id]);
    await audit(c, user, 'invoice.delete', 'invoice', id);
    return { ok: true };
  });
}, { roles: ['admin'] });
