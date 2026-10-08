import fs from 'node:fs/promises';
import path from 'node:path';
import { route } from '@/lib/api';
import { loadInvoice } from '@/lib/invoices';
export const runtime = 'nodejs';
export const GET = route(async ({ user, params }) => {
  const inv = await loadInvoice(user, +params.id);
  const buf = await fs.readFile(path.join(path.resolve(process.env.UPLOAD_DIR || './storage/invoices'), path.basename(inv.file_path)));
  return new Response(buf, { headers: { 'Content-Type': inv.file_mime || 'application/octet-stream', 'Content-Disposition': `inline; filename="${inv.file_name.replace(/"/g, '')}"`, 'Cache-Control': 'private, max-age=60' } });
});
