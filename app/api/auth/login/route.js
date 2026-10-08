import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  const { rows } = await q('SELECT * FROM users WHERE email=$1 AND active', [String(email || '').toLowerCase().trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) return NextResponse.json({ error: 'Wrong email or password.' }, { status: 401 });
  await setSession(u.id);
  return NextResponse.json({ ok: true });
}
