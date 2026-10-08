import { NextResponse } from 'next/server';
import { getUser } from './auth';

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const bad = (m, s = 400) => { throw new HttpError(s, m); };

/** wrap a route handler: auth, optional role check, uniform errors */
export function route(fn, { roles } = {}) {
  return async (req, ctx) => {
    try {
      const user = await getUser();
      if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      if (roles && !roles.includes(user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      const out = await fn({ req, user, params: (await ctx?.params) || {} });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e?.code === '23505') return NextResponse.json({ error: 'That already exists (duplicate invoice number or GSTIN).' }, { status: 409 });
      console.error(e);
      return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500 });
    }
  };
}
export async function audit(c, user, action, entity, entityId, detail) {
  await c.query('INSERT INTO audit_log (user_id,action,entity,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [user.id, action, entity, entityId, detail ? JSON.stringify(detail) : null]);
}
