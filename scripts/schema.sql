CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','lead','admin')),
  lead_id INT REFERENCES users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'client' CHECK (kind IN ('own','client','vendor')),
  gstin TEXT, pan TEXT, tax_id TEXT, address TEXT, state TEXT, contact TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  credit_days INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS companies_gstin_uq ON companies (gstin) WHERE gstin IS NOT NULL AND gstin <> '';
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  direction TEXT NOT NULL DEFAULT 'sales' CHECK (direction IN ('sales','purchase')),
  doc_type TEXT NOT NULL DEFAULT 'tax' CHECK (doc_type IN ('tax','proforma')),
  status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review','approved','rejected','converted')),
  invoice_no TEXT, invoice_date DATE, due_date DATE,
  from_company_id INT REFERENCES companies(id),
  to_company_id INT REFERENCES companies(id),
  currency TEXT NOT NULL DEFAULT 'INR',
  fx_rate NUMERIC(14,6) NOT NULL DEFAULT 1,
  fx_date DATE,
  subtotal NUMERIC(16,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(16,2) NOT NULL DEFAULT 0,
  sgst NUMERIC(16,2) NOT NULL DEFAULT 0,
  igst NUMERIC(16,2) NOT NULL DEFAULT 0,
  total NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_inr NUMERIC(16,2) NOT NULL DEFAULT 0,
  paid NUMERIC(16,2) NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'pending' CHECK (stage IN ('pending','promised','part','received')),
  promised_date DATE,
  file_name TEXT, file_path TEXT, file_mime TEXT,
  extracted JSONB, flags JSONB,
  linked_proforma_id INT REFERENCES invoices(id),
  notes TEXT,
  created_by INT REFERENCES users(id),
  approved_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_no_uq ON invoices (from_company_id, invoice_no, doc_type) WHERE status <> 'rejected' AND invoice_no IS NOT NULL;
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sl INT, description TEXT, hsn TEXT,
  qty NUMERIC(14,3) NOT NULL DEFAULT 1,
  rate NUMERIC(16,2) NOT NULL DEFAULT 0,
  amount NUMERIC(16,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  paid_on DATE NOT NULL,
  amount NUMERIC(16,2) NOT NULL,
  amount_inr NUMERIC(16,2) NOT NULL,
  tds NUMERIC(16,2) NOT NULL DEFAULT 0,
  mode TEXT NOT NULL CHECK (mode IN ('Bank account','UPI','Cash','Cheque')),
  details JSONB NOT NULL DEFAULT '{}',
  note TEXT,
  voided BOOLEAN NOT NULL DEFAULT false,
  recorded_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ledger_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  account TEXT NOT NULL,
  company_id INT REFERENCES companies(id),
  invoice_id INT REFERENCES invoices(id) ON DELETE CASCADE,
  payment_id INT REFERENCES payments(id) ON DELETE CASCADE,
  debit NUMERIC(16,2) NOT NULL DEFAULT 0,
  credit NUMERIC(16,2) NOT NULL DEFAULT 0,
  narration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_company_idx ON ledger_entries (company_id, entry_date);
CREATE TABLE IF NOT EXISTS followups (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'Call',
  note TEXT, promised_date DATE,
  by_user INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT, entity_id INT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2: brand names, contacts, sellers, reviewer
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contacts JSONB NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS company_sellers (
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  seller_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, seller_id)
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
UPDATE invoices SET reviewed_by = approved_by, reviewed_at = approved_at WHERE reviewed_by IS NULL AND approved_by IS NOT NULL;
INSERT INTO company_sellers (company_id, seller_id)
  SELECT DISTINCT CASE WHEN direction='sales' THEN to_company_id ELSE from_company_id END,
                  CASE WHEN direction='sales' THEN from_company_id ELSE to_company_id END
  FROM invoices WHERE from_company_id IS NOT NULL AND to_company_id IS NOT NULL
  ON CONFLICT DO NOTHING;
