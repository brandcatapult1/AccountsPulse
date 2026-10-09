import fs from 'node:fs/promises';
import path from 'node:path';
import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { postVoucher } from '@/lib/ledger';

export const runtime = 'nodejs';
const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const SOURCES = ['Petty cash', 'Bank account', 'UPI', 'Cash', 'Cheque'];

/** Team members, Account Leads and Super Admin can all make voucher entries: daily expenses and petty cash received. Each person sees their own; a lead also sees their team's. */
export const POST = route(async ({ req, user }) => {
  const f = await req.formData(); const g = (k) => { const v = f.get(k); return typeof v === 'string' ? v.trim() : ''; };
  const kind = g('kind') === 'petty_in' ? 'petty_in' : 'expense';
  const amount = Math.round(Number(g('amount')) * 100) / 100;
  if (!(amount > 0)) bad('Enter the amount.');
  if (!g('voucher_date')) bad('Enter the date.');
  if (!+g('seller_id')) bad('Choose the seller this belongs to.');
  if (kind === 'expense' && !g('category')) bad('Choose or type a category.');
  const source = kind === 'petty_in' ? (SOURCES.includes(g('source')) && g('source') !== 'Petty cash' ? g('source') : 'Cash') : (SOURCES.includes(g('source')) ? g('source') : 'Petty cash');
  const file = f.get('file'); let stored = null, mime = null, name = null;
  return tx(async (c) => {
    if (file && typeof file !== 'string' && file.size) {
      const ext = path.extname(file.name).toLowerCase();
      if (!MIME[ext]) bad('Attach a PDF, PNG or JPG.');
      if (file.size > 10 * 1024 * 1024) bad('The attachment is larger than 10 MB.');
      const dir = path.join(path.resolve(process.env.UPLOAD_DIR || './storage/invoices'), 'vouchers');
      await fs.mkdir(dir, { recursive: true });
      stored = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`; mime = MIME[ext]; name = file.name;
      await fs.writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
    }
    const { rows } = await c.query(
      `INSERT INTO vouchers (kind,voucher_date,seller_id,amount,category,description,source,account,from_name,vendor_id,reference,file_name,file_path,file_mime,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [kind, g('voucher_date'), +g('seller_id'), amount, g('category') || null, g('description') || null, source, g('account') || null, g('from_name') || null, +g('vendor_id') || null, g('reference') || null, name, stored, mime, user.id]);
    await postVoucher(c, rows[0]);
    await audit(c, user, `voucher.${kind}`, 'voucher', rows[0].id, { amount, category: g('category') });
    return rows[0];
  });
});
