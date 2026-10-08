import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { q } from './db';

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-secret');
const COOKIE = 'ap_session';

export async function setSession(userId) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('12h').sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
}
export function clearSession() { cookies().set(COOKIE, '', { path: '/', maxAge: 0 }); }

export async function getUser() {
  const t = cookies().get(COOKIE)?.value; if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    const { rows } = await q('SELECT id,name,email,role,lead_id,active FROM users WHERE id=$1', [payload.uid]);
    return rows[0]?.active ? rows[0] : null;
  } catch { return null; }
}

/** ids whose records this user may see; null means everything */
export async function visibleIds(user) {
  if (user.role === 'admin') return null;
  if (user.role === 'lead') { const { rows } = await q('SELECT id FROM users WHERE lead_id=$1 AND active', [user.id]); return [user.id, ...rows.map((r) => r.id)]; }
  return [user.id];
}
