import bcrypt from 'bcryptjs';
import { route, bad, audit } from '@/lib/api';
import { tx } from '@/lib/db';

export const PUT = route(async ({ req, user, params }) => {
  const b = await req.json(); const id = +params.id;
  if (id === user.id && (b.active === false || (b.role && b.role !== 'admin'))) bad('You cannot lock yourself out or change your own role.');
  return tx(async (c) => {
    const cur = (await c.query('SELECT * FROM users WHERE id=$1', [id])).rows[0]; if (!cur) bad('User not found.', 404);
    const role = b.role || cur.role;
    const hash = b.password ? (b.password.length < 8 ? bad('Password must be at least 8 characters.') : await bcrypt.hash(b.password, 10)) : cur.password_hash;
    const { rows } = await c.query('UPDATE users SET name=$1,role=$2,lead_id=$3,active=$4,password_hash=$5 WHERE id=$6 RETURNING id,name,email,role,lead_id,active',
      [b.name ?? cur.name, role, role === 'member' ? (b.lead_id === undefined ? cur.lead_id : b.lead_id || null) : null, b.active ?? cur.active, hash, id]);
    await audit(c, user, 'user.update', 'user', id, { role, active: rows[0].active, passwordChanged: !!b.password });
    return rows[0];
  });
}, { roles: ['admin'] });
