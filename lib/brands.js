/** SQL fragment: invoice (alias i) belongs to brand in parameter $n, either on the invoice or on any of its item lines. */
export const brandSql = (n, alias = 'i') => `($${n}::int IS NULL OR ${alias}.brand_id=$${n} OR EXISTS (SELECT 1 FROM invoice_items bi WHERE bi.invoice_id=${alias}.id AND bi.brand_id=$${n}))`;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Save the brand list for a company (names). Keeps ids of brands that stay, removes the rest, and mirrors the names into companies.brand_name for search and labels. */
export async function saveBrands(c, companyId, names) {
  const want = []; for (const raw of Array.isArray(names) ? names : []) { const n = String(typeof raw === 'string' ? raw : raw?.name || '').trim(); if (n && !want.some((w) => w.toLowerCase() === n.toLowerCase())) want.push(n); }
  const have = (await c.query('SELECT id, name FROM company_brands WHERE company_id=$1', [companyId])).rows;
  for (const b of have) if (!want.some((w) => w.toLowerCase() === b.name.toLowerCase())) await c.query('DELETE FROM company_brands WHERE id=$1', [b.id]);
  for (const w of want) {
    const h = have.find((b) => b.name.toLowerCase() === w.toLowerCase());
    if (h) { if (h.name !== w) await c.query('UPDATE company_brands SET name=$1 WHERE id=$2', [w, h.id]); }
    else await c.query('INSERT INTO company_brands (company_id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [companyId, w]);
  }
  await c.query('UPDATE companies SET brand_name=$1 WHERE id=$2', [want.join(', ') || null, companyId]);
}

/** Tag each item with the brand whose name appears in its description or extra lines. Returns the single brand shared by the tagged items, or null. */
export function detectBrands(brands, items) {
  const bs = brands.filter((b) => norm(b.name).length >= 3);
  const found = new Set();
  const tagged = items.map((it) => {
    const text = norm(`${it.description || ''} ${it.details || ''}`);
    const hit = bs.filter((b) => text.includes(norm(b.name)));
    // prefer the longest name when brands overlap ("Nukkad" inside "Nukkad Cafe")
    const best = hit.sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
    if (best) found.add(best.id);
    return { ...it, brand_id: best?.id ?? null };
  });
  return { items: tagged, invoiceBrand: found.size === 1 ? [...found][0] : null };
}
