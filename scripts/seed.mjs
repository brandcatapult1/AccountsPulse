import fs from 'node:fs'; import pg from 'pg'; import bcrypt from 'bcryptjs';
for (const l of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n') : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
await c.query(`INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'admin') ON CONFLICT (email) DO UPDATE SET password_hash=$3, role='admin', active=true`, [ADMIN_NAME || 'Super Admin', ADMIN_EMAIL.toLowerCase(), hash]);
console.log('admin ready:', ADMIN_EMAIL); await c.end();
