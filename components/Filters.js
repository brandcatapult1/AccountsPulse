'use client';
import { fyOf, fyRange, coLabel } from '@/lib/client';
export const Seg = ({ value, onChange, options }) => <div className="seg">{options.map(([v, l]) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
export const Sel = ({ label, value, onChange, children, id }) => <div className="fld" style={{ minWidth: 130 }}><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></div>;
export function FySelect({ value, onChange }) {
  const cur = fyOf(); const years = [cur + 1, cur, cur - 1, cur - 2];
  return <Sel id="fy" label="Financial year" value={value} onChange={(v) => onChange(+v)}>{years.map((y) => <option key={y} value={y}>{fyRange(y).label}</option>)}</Sel>;
}
export const CompanySelect = ({ companies, value, onChange, label = 'Company', all = 'All companies', id = 'co' }) =>
  <Sel id={id} label={label} value={value} onChange={onChange}><option value="">{all}</option>{(companies || []).map((c) => <option key={c.id} value={c.id}>{coLabel(c)}</option>)}</Sel>;
export function OwnerSelect({ user, team, value, onChange }) {
  if (!user || user.role === 'member') return null;
  return <Sel id="own" label="Owner" value={value} onChange={onChange}><option value="">{user.role === 'admin' ? 'Everyone' : 'My team'}</option><option value="me">Mine</option>{(team || []).filter((t) => t.id !== user.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Sel>;
}
