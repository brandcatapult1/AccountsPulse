import pg from 'pg';
pg.types.setTypeParser(1082, (v) => v); // keep DATE columns as plain YYYY-MM-DD strings, no timezone shift
const g = globalThis;
export const pool = g.__pgpool || (g.__pgpool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 20000 }));
export const q = (text, params) => pool.query(text, params);
export async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
