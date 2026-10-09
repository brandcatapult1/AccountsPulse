import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadInvoice } from '@/lib/invoices';

/** Fix item wording (head + extra lines) on an approved invoice. Amounts and the ledger are not touched. */
export const PUT = route(async ({ req, user, params }) => {
  const { items, brand_id } = await req.json(); const id = +params.id;
  if (!Array.isArray(items)) bad('Nothing to save.');
  return tx(async (c) => {
    await loadInvoice(user, id, c);
    for (const it of items) await c.query('UPDATE invoice_items SET description=$1, details=$2, brand_id=$5 WHERE id=$3 AND invoice_id=$4', [String(it.description || '').trim(), String(it.details || '').trim(), +it.id, id, +it.brand_id || null]);
    if (brand_id !== undefined) await c.query('UPDATE invoices SET brand_id=$1 WHERE id=$2', [+brand_id || null, id]);
    await audit(c, user, 'invoice.descriptions', 'invoice', id, { lines: items.length });
    return { ok: true };
  });
}, { roles: ['admin', 'lead'] });
