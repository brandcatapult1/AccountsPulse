'use client';
import { useApi } from '@/lib/client';
export default function Audit() {
  const { data, error } = useApi('/audit');
  return <><div className="bar"><h2>Audit log</h2></div>{error && <div className="err-box">{error}</div>}
    <div className="card scroll"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>Detail</th></tr></thead><tbody>
      {(data || []).map((a) => <tr key={a.id}><td className="mono">{new Date(a.created_at).toLocaleString('en-IN')}</td><td>{a.user_name}</td><td>{a.action}</td><td className="mono">{a.entity} #{a.entity_id}</td><td className="note">{a.detail ? JSON.stringify(a.detail) : ''}</td></tr>)}</tbody></table></div></>;
}
