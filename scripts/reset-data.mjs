// Dev helper: wipes invoices, payments, ledger, follow-ups and companies. Keeps users.
import fs from 'node:fs'; import pg from 'pg';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
await c.query('TRUNCATE ledger_entries, followups, payments, invoice_items, invoices, companies, audit_log RESTART IDENTITY CASCADE');
console.log('data cleared'); await c.end();
