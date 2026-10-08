import fs from 'node:fs'; import pg from 'pg';
for (const l of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n') : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
await c.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')); console.log('schema ok'); await c.end();
