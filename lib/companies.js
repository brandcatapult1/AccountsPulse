export function cleanContacts(list) {
  return (Array.isArray(list) ? list : []).map((p) => ({ name: String(p.name || '').trim(), phone: String(p.phone || '').trim(), email: String(p.email || '').trim() })).filter((p) => p.name || p.phone || p.email);
}
export function cleanBanks(list) {
  const t = (v) => String(v || '').trim();
  return (Array.isArray(list) ? list : []).map((b) => ({ holder: t(b.holder), bank: t(b.bank), account_no: t(b.account_no).replace(/\s+/g, ''), ifsc: t(b.ifsc).toUpperCase(), branch: t(b.branch), upi_id: t(b.upi_id) })).filter((b) => b.bank || b.account_no || b.upi_id);
}
/** a client or vendor can work with several of our sellers */
export async function saveSellers(c, companyId, kind, sellerIds) {
  await c.query('DELETE FROM company_sellers WHERE company_id=$1', [companyId]);
  if (kind === 'own') return;
  for (const sid of [...new Set((sellerIds || []).map(Number).filter(Boolean))]) if (sid !== companyId) await c.query('INSERT INTO company_sellers (company_id, seller_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [companyId, sid]);
}
