import fs from 'node:fs';
import { extractInvoice } from '../lib/extract.js';
for (const f of process.argv.slice(2)) {
  const r = await extractInvoice(fs.readFileSync(f));
  delete r.rawText;
  console.log('==', f); console.log(JSON.stringify(r, null, 1));
}
