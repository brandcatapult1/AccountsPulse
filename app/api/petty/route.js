import { route } from '@/lib/api';
import { q } from '@/lib/db';
import { visibleIds } from '@/lib/auth';

/** Petty cash book and expense list, limited to the entries the signed-in person can see. */
export const GET = route(async ({ req, user }) => {
  const u = new URL(req.url).searchParams, ids = await visibleIds(user);
  const from = u.get('from') || '1900-01-01', to = u.get('to') || '2999-12-31', seller = u.get('seller_id') || null, cat = u.get('category') || null, by = u.get('user_id') || null;
  const scope = `($1::int[] IS NULL OR v.created_by = ANY($1)) AND ($2::int IS NULL OR v.seller_id=$2)`;
  const open = await q(`SELECT COALESCE(SUM(CASE WHEN v.kind='petty_in' THEN v.amount WHEN v.source='Petty cash' THEN -v.amount ELSE 0 END),0) AS b FROM vouchers v WHERE ${scope} AND v.voucher_date < $3`, [ids, seller, from]);
  const { rows } = await q(
    `SELECT v.*, c.name AS vendor_name, u.name AS by_name, s.name AS seller_name FROM vouchers v LEFT JOIN companies c ON c.id=v.vendor_id LEFT JOIN users u ON u.id=v.created_by LEFT JOIN companies s ON s.id=v.seller_id
     WHERE ${scope} AND v.voucher_date BETWEEN $3 AND $4 AND ($5::text IS NULL OR v.category=$5) AND ($6::int IS NULL OR v.created_by=$6) ORDER BY v.voucher_date, v.id`, [ids, seller, from, to, cat, by]);
  let bal = Number(open.rows[0].b), inn = 0, spentPetty = 0, spentOther = 0; const byCat = {};
  const entries = rows.map((v) => {
    const amt = Number(v.amount);
    if (v.kind === 'petty_in') { bal += amt; inn += amt; }
    else { if (v.source === 'Petty cash') { bal -= amt; spentPetty += amt; } else spentOther += amt; byCat[v.category || 'Miscellaneous'] = (byCat[v.category || 'Miscellaneous'] || 0) + amt; }
    return { ...v, balance: Math.round(bal * 100) / 100 };
  });
  // roll-ups by day, week (Monday start) or month, and by team member
  const group = ['day', 'week', 'month'].includes(u.get('group')) ? u.get('group') : 'month';
  const keyOf = (d) => { const x = new Date(String(d).slice(0, 10) + 'T00:00:00Z');
    if (group === 'month') return x.toISOString().slice(0, 7);
    if (group === 'week') { const w = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - w); }
    return x.toISOString().slice(0, 10); };
  const per = new Map(), ppl = new Map();
  for (const v of rows) {
    const k = keyOf(v.voucher_date); const g = per.get(k) || { period: k, received: 0, spent: 0, count: 0 }; per.set(k, g);
    const a = Number(v.amount); g.count++; if (v.kind === 'petty_in') g.received += a; else g.spent += a;
    if (v.kind === 'expense') { const pp = ppl.get(v.created_by) || { name: v.by_name || 'Unknown', spent: 0, count: 0 }; pp.spent += a; pp.count++; ppl.set(v.created_by, pp); }
  }
  const periods = [...per.values()].sort((a, b) => (a.period < b.period ? 1 : -1));
  const by_person = [...ppl.values()].sort((a, b) => b.spent - a.spent);
  const cats = (await q(`SELECT DISTINCT category FROM vouchers WHERE category IS NOT NULL ORDER BY 1`)).rows.map((r) => r.category);
  const people = (await q(`SELECT DISTINCT u.id, u.name FROM vouchers v JOIN users u ON u.id=v.created_by WHERE ${scope} ORDER BY u.name`, [ids, seller])).rows;
  return { opening: Number(open.rows[0].b), closing: bal, received: inn, spent_petty: spentPetty, spent_other: spentOther,
    group, periods, by_person, by_category: Object.entries(byCat).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount), entries, categories: cats, people };
});
