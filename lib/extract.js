// Rule-based invoice reader. No AI: reads the PDF text layer with positions and applies fixed patterns.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const num = (s) => { const n = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/(\d{1,2})[-\/ .]([A-Za-z]{3})[a-z]*[-\/ .,]*(\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    let y = +m[3]; if (y < 100) y += 2000;
    return iso(y, MONTHS[m[2].toLowerCase()], +m[1]);
  }
  m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2] - 1, +m[1]); }
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}
const addDays = (isoDate, n) => { const d = new Date(isoDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function readLines(buf) {
  // Load the worker ourselves so pdf.js never has to locate pdf.worker.mjs on disk (it is missing from some hosted builds).
  if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
  const lines = []; let width = 600;
  const pages = Math.min(doc.numPages, 3);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 }); if (p === 1) width = vp.width;
    const tc = await page.getTextContent();
    const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str.trim(), x: i.transform[4], w: i.width, y: vp.height - i.transform[5] + (p - 1) * 2000 }));
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    let cur = null;
    for (const it of items) {
      if (cur && Math.abs(it.y - cur.y) <= 3) cur.items.push(it);
      else { cur = { y: it.y, items: [it] }; lines.push(cur); }
    }
  }
  for (const l of lines) { l.items.sort((a, b) => a.x - b.x); l.text = l.items.map((i) => i.s).join(' '); }
  return { lines, width };
}

function parseParty(lines) {
  const text = lines.join('\n');
  const gstin = (text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/) || [])[0] || '';
  const pan = (text.match(/PAN\s*:?\s*([A-Z]{5}\d{4}[A-Z])/) || [])[1] || (gstin ? gstin.slice(2, 12) : '');
  const state = ((text.match(/State\s*:\s*(.+)/i) || [])[1] || '').trim();
  const rest = lines.filter((l) => !/GSTIN|PAN\s*:|^State\s*:/i.test(l));
  return { name: rest[0] || '', address: rest.slice(1).join(' ').replace(/,\s*,/g, ','), gstin, pan, state };
}

export async function extractInvoice(buf) {
  const { lines } = await readLines(buf);
  const all = lines.map((l) => l.text).join('\n');
  const flags = [];
  const out = { rawText: all, flags, items: [], taxes: { cgst: 0, sgst: 0, igst: 0, rate: 0 } };
  if (all.replace(/\s/g, '').length < 40) { flags.push({ field: 'file', level: 'red', msg: 'No readable text in this file (a scan or photo). Enter the details by hand.' }); out.needsManual = true; return out; }

  const head = lines.slice(0, 12).map((l) => l.text).join(' ');
  out.docType = /pro\s*forma/i.test(head) ? 'proforma' : /tax\s+invoice/i.test(head) ? 'tax' : null;
  if (!out.docType) flags.push({ field: 'docType', level: 'yellow', msg: 'Could not tell Proforma from Tax Invoice.' });

  out.invoiceNo = (all.match(/Invoice\s*(?:#|No\.?|Number)\s*:?\s*([A-Za-z0-9\/\-_.]+)/i) || [])[1] || '';
  if (!out.invoiceNo) flags.push({ field: 'invoiceNo', level: 'red', msg: 'Invoice number not found.' });
  out.invoiceDate = parseDate((all.match(/Invoice\s*Date\s*:?\s*([^\n]+)/i) || [])[1]);
  if (!out.invoiceDate) flags.push({ field: 'invoiceDate', level: 'red', msg: 'Invoice date not found.' });
  const terms = (all.match(/Payments?\s*Terms?\s*:?\s*([^\n]+)/i) || [])[1] || '';
  out.terms = terms.trim();
  const net = terms.match(/(\d+)\s*days?/i) || terms.match(/net\s*(\d+)/i);
  out.dueDate = parseDate((all.match(/Due\s*Date\s*:?\s*([^\n]+)/i) || [])[1]) || (out.invoiceDate ? addDays(out.invoiceDate, /today|immediate/i.test(terms) ? 0 : net ? +net[1] : 0) : null);
  if (out.invoiceDate && !terms) flags.push({ field: 'dueDate', level: 'yellow', msg: 'No payment terms found. Due date set to invoice date.' });

  // FROM / TO block, split by the x position of the two headings
  const hi = lines.findIndex((l) => l.items.some((i) => /^FROM$/i.test(i.s)) && l.items.some((i) => /^TO$/i.test(i.s)));
  const ti = lines.findIndex((l) => /Particulars/i.test(l.text));
  if (hi >= 0) {
    const fx = lines[hi].items.find((i) => /^FROM$/i.test(i.s)).x, tx = lines[hi].items.find((i) => /^TO$/i.test(i.s)).x;
    const mid = (fx + tx) / 2, L = [], R = [];
    for (const l of lines.slice(hi + 1, ti > hi ? ti - 0 : hi + 12)) {
      const a = l.items.filter((i) => i.x + i.w / 2 < mid).map((i) => i.s).join(' ').trim();
      const b = l.items.filter((i) => i.x + i.w / 2 >= mid).map((i) => i.s).join(' ').trim();
      if (a) L.push(a); if (b) R.push(b);
    }
    out.from = parseParty(L); out.to = parseParty(R);
  } else { flags.push({ field: 'parties', level: 'red', msg: 'Could not find the FROM / TO block.' }); out.from = {}; out.to = {}; }
  if (!out.from?.gstin) flags.push({ field: 'fromGstin', level: 'yellow', msg: 'Seller GSTIN not found.' });
  if (!out.to?.gstin) flags.push({ field: 'toGstin', level: 'yellow', msg: 'Buyer GSTIN not found.' });

  // Seller bank details printed on the invoice
  const cut = (v) => String(v || '').replace(/\s+(Total\s*Invoice|SUB\s*-?\s*TOTAL|CGST|SGST|IGST|INR)\b.*$/i, '').trim();
  const bank = {
    holder: cut((all.match(/A\/c\s*Holder(?:'s)?\s*Name\s*:?\s*([^\n]+)/i) || [])[1]),
    bank: cut((all.match(/Bank\s*Name\s*:?\s*([^\n]+)/i) || [])[1]),
    account_no: (((all.match(/A\/c\s*No\.?\s*:?\s*([\d ]{6,25})/i) || [])[1]) || '').replace(/\s+/g, ''),
    ifsc: (all.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/) || [])[0] || '',
    branch: ((all.match(/Branch(?:\s*&\s*IFS\w*\s*Code)?\s*:?\s*([^&\n]+?)\s*(?:&|\n|$)/i) || [])[1] || '').trim(),
  };
  if (bank.account_no) out.bank = bank;

  // Currency
  const cur = (all.match(/\b(USD|EUR|GBP|AED|SGD|AUD|CAD)\b/) || [])[1] || (/\$/.test(all) ? 'USD' : /€/.test(all) ? 'EUR' : /£/.test(all) ? 'GBP' : 'INR');
  out.currency = cur;

  // Item table
  if (ti >= 0) {
    const h = lines[ti].items;
    const col = (re) => h.find((i) => re.test(i.s));
    const cDesc = col(/Particulars/i), cHsn = col(/HSN|SAC/i), cQty = col(/Qty|Quantity/i), cRate = col(/per|Rate|Price/i);
    const cAmt = h[h.length - 1];
    const slHead = h[0];
    const endIdx = lines.findIndex((l, i) => i > ti && /SUB\s*-?\s*TOTAL|Payment Details|Total Invoice/i.test(l.text));
    const rows = []; let row = null;
    for (const l of lines.slice(ti + 1, endIdx > ti ? endIdx : undefined)) {
      if (/^No\.?$/i.test(l.text)) continue;
      const first = l.items[0];
      if (first && /^\d{1,3}$/.test(first.s) && first.x < (cDesc?.x ?? 80) - 4) { row = { sl: +first.s, descLines: [], hsn: '', qty: null, rate: null, amount: null }; rows.push(row); l.items = l.items.slice(1); }
      if (!row) continue;
      const dEnd = (cHsn?.x ?? 1e9) - 4;
      const lineParts = [];
      for (const it of l.items) {
        const right = it.x + it.w;
        if (/^\d{4,8}$/.test(it.s) && cHsn && it.x >= cHsn.x - 30 && it.x <= cHsn.x + cHsn.w + 30) row.hsn = it.s;
        else if (/^[\d,]+(\.\d+)?$/.test(it.s) && it.x >= dEnd) {
          const cols = [[cQty, 'qty'], [cRate, 'rate'], [cAmt, 'amount']].filter((c) => c[0]);
          let best = null, bd = 1e9;
          for (const [c, k] of cols) { const d = Math.abs(right - (c.x + c.w)); if (d < bd) { bd = d; best = k; } }
          if (best) row[best] = num(it.s);
        } else if (it.x < dEnd) lineParts.push(it.s);
      }
      if (lineParts.length) row.descLines.push(lineParts.join(' ').replace(/\s+/g, ' ').trim());
    }
    out.items = rows.map((r) => ({ sl: r.sl, description: r.descLines[0] || '', details: r.descLines.slice(1).join('\n'), hsn: r.hsn, qty: r.qty ?? 1, rate: r.rate ?? r.amount, amount: r.amount ?? 0 }));
  }
  if (!out.items.length) flags.push({ field: 'items', level: 'red', msg: 'No line items found.' });

  // Totals
  let subtotal = null, total = null;
  for (const l of lines) {
    const t = l.text;
    let m;
    if ((m = t.match(/SUB\s*-?\s*TOTAL[^\d]*([\d,]+(?:\.\d+)?)/i))) subtotal = num(m[1]);
    if ((m = t.match(/\b(CGST|SGST|UTGST|IGST)\b[^%]*?(\d+(?:\.\d+)?)\s*%[^\d]*([\d,]+\.\d+)\s*$/i))) {
      const k = m[1].toLowerCase() === 'utgst' ? 'sgst' : m[1].toLowerCase();
      out.taxes[k] = num(m[3]); out.taxes.rate = (out.taxes.rate || 0) + (+m[2]);
    }
    if ((m = t.match(/Total\s*Invoice\s*\(?\s*In\s*Figures\s*\)?[^\d]*([\d,]+(?:\.\d+)?)/i)) || (total === null && (m = t.match(/(?:Grand\s*Total|Total\s*Amount|Invoice\s*Total)[^\d]*([\d,]+(?:\.\d+)?)/i)))) total = num(m[1]);
  }
  const itemSum = Math.round(out.items.reduce((s, i) => s + (i.amount || 0), 0) * 100) / 100;
  out.subtotal = subtotal ?? (out.items.length ? itemSum : null);
  const taxSum = (out.taxes.cgst || 0) + (out.taxes.sgst || 0) + (out.taxes.igst || 0);
  out.total = total ?? (out.subtotal != null ? Math.round((out.subtotal + taxSum) * 100) / 100 : null);
  if (total === null) flags.push({ field: 'total', level: 'yellow', msg: 'Total not found; calculated from items and tax.' });
  if (subtotal !== null && out.items.length && Math.abs(itemSum - subtotal) > 0.5) flags.push({ field: 'items', level: 'red', msg: `Line items add to ${itemSum} but subtotal says ${subtotal}.` });
  if (out.subtotal != null && out.total != null && Math.abs(out.subtotal + taxSum - out.total) > 1) flags.push({ field: 'total', level: 'red', msg: `Subtotal + tax = ${(out.subtotal + taxSum).toFixed(2)} but total says ${out.total}.` });
  // tax type from GSTIN states
  out.taxType = out.taxes.igst ? 'IGST' : (out.taxes.cgst || out.taxes.sgst) ? 'CGST+SGST' : 'NONE';
  return out;
}
