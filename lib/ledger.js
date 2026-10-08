// Double-entry postings. All amounts in INR, rounded to paise.
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const add = (c, e) => c.query(
  'INSERT INTO ledger_entries (entry_date,account,company_id,invoice_id,payment_id,debit,credit,narration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
  [e.date, e.account, e.company_id ?? null, e.invoice_id ?? null, e.payment_id ?? null, r2(e.debit || 0), r2(e.credit || 0), e.narration || null]);

/** Tax invoice approved. Sales: Dr Receivable, Cr Income + GST payable. Purchase: Dr Expense + Input GST, Cr Payable. */
export async function postInvoice(c, inv) {
  const fx = Number(inv.fx_rate) || 1;
  const sub = r2(inv.subtotal * fx), cg = r2(inv.cgst * fx), sg = r2(inv.sgst * fx), ig = r2(inv.igst * fx);
  const total = r2(inv.total_inr);
  const gst = r2(cg + sg + ig);
  const base = { date: inv.invoice_date, invoice_id: inv.id, narration: `${inv.invoice_no}${inv.currency !== 'INR' ? ` (${inv.currency} ${inv.total} @ ${fx})` : ''}` };
  if (inv.direction === 'sales') {
    const party = inv.to_company_id;
    await add(c, { ...base, account: 'Receivable', company_id: party, debit: total });
    await add(c, { ...base, account: inv.currency !== 'INR' ? 'Export income' : 'Sales income', company_id: party, credit: r2(total - gst) });
    if (cg) await add(c, { ...base, account: 'CGST payable', credit: cg });
    if (sg) await add(c, { ...base, account: 'SGST payable', credit: sg });
    if (ig) await add(c, { ...base, account: 'IGST payable', credit: ig });
  } else {
    const party = inv.from_company_id;
    await add(c, { ...base, account: 'Purchases / expenses', company_id: party, debit: r2(total - gst) });
    if (cg) await add(c, { ...base, account: 'CGST input', debit: cg });
    if (sg) await add(c, { ...base, account: 'SGST input', debit: sg });
    if (ig) await add(c, { ...base, account: 'IGST input', debit: ig });
    await add(c, { ...base, account: 'Payable', company_id: party, credit: total });
  }
}

const CASHACC = { 'Bank account': 'Bank', UPI: 'Bank (UPI)', Cash: 'Cash in hand', Cheque: 'Cheques in hand' };

/**
 * Payment against an approved tax invoice (or an advance against a proforma).
 * booked = share of the invoice's booked INR value this payment clears; the gap against cash received is exchange gain/loss.
 */
export async function postPayment(c, inv, pay, { advance = false } = {}) {
  const party = inv.direction === 'sales' ? inv.to_company_id : inv.from_company_id;
  const base = { date: pay.paid_on, invoice_id: inv.id, payment_id: pay.id, narration: `${pay.mode} against ${inv.invoice_no}` };
  const cash = r2(pay.amount_inr), tds = r2(pay.tds || 0);
  const fx = Number(inv.fx_rate) || 1;
  const booked = advance ? r2(cash + tds) : r2(pay.amount * fx);
  const sales = inv.direction === 'sales';
  const target = advance ? (sales ? 'Customer advances' : 'Vendor advances') : (sales ? 'Receivable' : 'Payable');
  if (sales) {
    await add(c, { ...base, account: CASHACC[pay.mode], debit: cash });
    if (tds) await add(c, { ...base, account: 'TDS receivable', debit: tds });
    await add(c, { ...base, account: target, company_id: party, credit: booked });
    const diff = r2(cash + tds - booked);
    if (!advance && diff > 0) await add(c, { ...base, account: 'Exchange gain', credit: diff });
    if (!advance && diff < 0) await add(c, { ...base, account: 'Exchange loss', debit: -diff });
  } else {
    await add(c, { ...base, account: target, company_id: party, debit: booked });
    await add(c, { ...base, account: CASHACC[pay.mode], credit: cash });
    const diff = r2(booked - cash);
    if (!advance && diff > 0) await add(c, { ...base, account: 'Exchange gain', credit: diff });
    if (!advance && diff < 0) await add(c, { ...base, account: 'Exchange loss', debit: -diff });
  }
}

/** Payments taken on a proforma become payments on the tax invoice that replaces it. */
export async function convertAdvance(c, taxInv, proforma) {
  const party = taxInv.direction === 'sales' ? taxInv.to_company_id : taxInv.from_company_id;
  const { rows } = await c.query('SELECT * FROM payments WHERE invoice_id=$1 AND NOT voided', [proforma.id]);
  for (const p of rows) {
    const amt = r2(Number(p.amount_inr) + Number(p.tds));
    const adv = taxInv.direction === 'sales' ? 'Customer advances' : 'Vendor advances';
    const ar = taxInv.direction === 'sales' ? 'Receivable' : 'Payable';
    const base = { date: taxInv.invoice_date, invoice_id: taxInv.id, payment_id: p.id, narration: `Advance from ${proforma.invoice_no} applied to ${taxInv.invoice_no}` };
    if (taxInv.direction === 'sales') { await add(c, { ...base, account: adv, company_id: party, debit: amt }); await add(c, { ...base, account: ar, company_id: party, credit: amt }); }
    else { await add(c, { ...base, account: ar, company_id: party, debit: amt }); await add(c, { ...base, account: adv, company_id: party, credit: amt }); }
    await c.query('UPDATE payments SET invoice_id=$1 WHERE id=$2', [taxInv.id, p.id]);
  }
  return rows.reduce((s, p) => s + Number(p.amount), 0);
}

export function stageFor(total, paid) { return paid <= 0 ? null : paid + 0.005 >= total ? 'received' : 'part'; }
