import fs from 'node:fs/promises';
import path from 'node:path';
import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';
import { extractInvoice } from '@/lib/extract';
import { linkParty } from '@/lib/invoices';

export const runtime = 'nodejs';
const DIR = () => path.resolve(process.env.UPLOAD_DIR || './storage/invoices');
const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

async function findOrCreateCompany(c, p, kind, user) {
  if (p?.gstin) { const r = await c.query('SELECT id FROM companies WHERE gstin=$1', [p.gstin]); if (r.rows[0]) return r.rows[0].id; }
  if (p?.name) { const r = await c.query('SELECT id FROM companies WHERE lower(name)=lower($1) AND NOT archived', [p.name]); if (r.rows[0]) return r.rows[0].id; }
  if (!p?.name) return null;
  const r = await c.query(`INSERT INTO companies (name,kind,gstin,pan,address,state,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [p.name, kind, p.gstin || null, p.pan || null, p.address || null, p.state || null, user.id]);
  return r.rows[0].id;
}

export const POST = route(async ({ req, user }) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') bad('Choose a file to upload.');
  const ext = path.extname(file.name).toLowerCase();
  if (!MIME[ext]) bad('Only PDF, PNG and JPG files are accepted.');
  if (file.size > 10 * 1024 * 1024) bad('File is larger than 10 MB.');
  const direction = form.get('direction') === 'purchase' ? 'purchase' : 'sales';
  const buf = Buffer.from(await file.arrayBuffer());
  let ex;
  if (ext === '.pdf') { try { ex = await extractInvoice(buf); } catch (e) { console.error('extract failed', e); bad('Could not read this PDF (' + String(e.message).slice(0, 200) + '). Nothing was saved. Try again, or contact support if it keeps happening.', 422); } }
  else ex = { flags: [{ field: 'file', level: 'red', msg: 'Photos cannot be read automatically yet. Enter the details by hand.' }], items: [], taxes: {}, needsManual: true };

  const docType = form.get('doc_type') || ex.docType || 'tax';
  return tx(async (c) => {
    // own company is the seller on sales invoices and the buyer on purchase invoices
    const [fromC, toC] = direction === 'sales'
      ? [await findOrCreateCompany(c, ex.from, 'own', user), await findOrCreateCompany(c, ex.to, 'client', user)]
      : [await findOrCreateCompany(c, ex.from, 'vendor', user), await findOrCreateCompany(c, ex.to, 'own', user)];
    const fromId = +form.get('from_company_id') || fromC, toId = +form.get('to_company_id') || toC;
    const chosen = +form.get('seller_id') || null; const sellerOnInvoice = direction === 'sales' ? fromId : toId;
    if (chosen && sellerOnInvoice && chosen !== sellerOnInvoice) {
      const nm = (await c.query('SELECT name FROM companies WHERE id IN ($1,$2)', [chosen, sellerOnInvoice])).rows;
      (ex.flags ||= []).push({ field: 'parties', level: 'yellow', msg: `This invoice is for a different seller than the one selected in the sidebar (${nm.map((n) => n.name).join(' vs ')}). Check the From / To companies.` });
    }
    if (ex.invoiceNo && fromId) {
      const d = await c.query(`SELECT i.id, u.name FROM invoices i LEFT JOIN users u ON u.id=i.created_by WHERE i.from_company_id=$1 AND i.invoice_no=$2 AND i.doc_type=$3 AND i.status<>'rejected'`, [fromId, ex.invoiceNo, docType]);
      if (d.rows[0]) bad(`Duplicate: ${ex.invoiceNo} is already uploaded${d.rows[0].name ? ' by ' + d.rows[0].name : ''}.`, 409);
    }
    await fs.mkdir(DIR(), { recursive: true });
    const stored = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
    await fs.writeFile(path.join(DIR(), stored), buf);
    const cur = ex.currency || 'INR';
    const t = ex.taxes || {};
    const { rows } = await c.query(
      `INSERT INTO invoices (direction,doc_type,status,invoice_no,invoice_date,due_date,from_company_id,to_company_id,currency,fx_rate,subtotal,cgst,sgst,igst,total,total_inr,file_name,file_path,file_mime,extracted,flags,created_by)
       VALUES ($1,$2,'review',$3,$4,$5,$6,$7,$8,1,$9,$10,$11,$12,$13,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [direction, docType, ex.invoiceNo || null, ex.invoiceDate || null, ex.dueDate || null, fromId || null, toId || null, cur, ex.subtotal || 0, t.cgst || 0, t.sgst || 0, t.igst || 0, ex.total || 0,
       file.name, stored, MIME[ext], JSON.stringify({ ...ex, rawText: undefined }), JSON.stringify(ex.flags || []), user.id]);
    const id = rows[0].id;
    for (const [n, it] of (ex.items || []).entries()) await c.query('INSERT INTO invoice_items (invoice_id,sl,description,details,hsn,qty,rate,amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, n + 1, it.description, it.details || '', it.hsn, it.qty ?? 1, it.rate ?? 0, it.amount ?? 0]);
    await linkParty(c, direction, fromId, toId);
    await audit(c, user, 'invoice.upload', 'invoice', id, { file: file.name, docType });
    return { id, invoice_no: ex.invoiceNo, doc_type: docType, flags: ex.flags || [], total: ex.total, currency: cur };
  });
});
