import bcrypt from 'bcryptjs';
import { route, bad, audit } from '@/lib/api';
import { q, tx } from '@/lib/db';

export const GET = route(async ({ user }) => {
  if (user.role === 'admin') return (await q('SELECT id,name,email,role,lead_id,active,created_at FROM users ORDER BY name')).rows;
  if (user.role === 'lead') return (await q('SELECT id,name,email,role,lead_id,active,created_at FROM users WHERE id=$1 OR lead_id=$1 ORDER BY name', [user.id])).rows;
  return (await q('SELECT id,name,email,role,lead_id,active,created_at FROM users WHERE id=$1', [user.id])).rows;
});

export const POST = route(async ({ req, user }) => {
  const b = await req.json();
  if (!b.name?.trim() || !b.email?.trim()) bad('Name and email are required.');
  if (!b.password || b.password.length < 8) bad('Password must be at least 8 characters.');
  if (!['member', 'lead', 'admin'].includes(b.role)) bad('Pick a role.');
  return tx(async (c) => {
    const { rows } = await c.query('INSERT INTO users (name,email,password_hash,role,lead_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,lead_id,active',
      [b.name.trim(), b.email.toLowerCase().trim(), await bcrypt.hash(b.password, 10), b.role, b.role === 'member' ? b.lead_id || null : null]);
    await audit(c, user, 'user.create', 'user', rows[0].id, { email: b.email, role: b.role });
    return rows[0];
  });
}, { roles: ['admin'] });
