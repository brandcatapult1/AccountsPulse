# Accounts Pulse

Invoices, ledgers, payments and follow-ups for the accounts team. Next.js + Postgres (Neon). Invoices are read by fixed rules, no AI.

## Run locally
```
cp .env.example .env.local   # fill in values
npm install
npm run migrate              # creates tables
npm run seed                 # creates the Super Admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                  # http://localhost:3100
```
Test the reader on any PDF: `npm run extract -- path/to/invoice.pdf`

## Deploy on Hostinger (Node.js app, accounts.brandcatapult.in)
1. hPanel > Websites > Add website > Node.js Apps, import this GitHub repo, choose Node 20 or 22.
2. Build command `npm run build`, start command `npm start`, entry/framework Next.js.
3. Environment variables (hPanel > Node.js > Environment): `DATABASE_URL`, `AUTH_SECRET` (long random string), `UPLOAD_DIR`, `NODE_ENV=production`.
4. Set `UPLOAD_DIR` to a folder **outside** the web root, for example `/home/<user>/accounts-storage/invoices`. Uploaded invoices live there on Hostinger and are only served through the signed-in `/api/invoices/:id/file` route.
5. Point the subdomain `accounts.brandcatapult.in` at the app and enable SSL.
6. Run `npm run migrate` and `npm run seed` once (hPanel terminal/SSH, with the env vars set).

## Roles
- **Accounts**: sees only records they entered.
- **Account Lead**: also sees everything their team members entered.
- **Super Admin**: sees everything, manages users, can reopen or delete.

Secrets never go in this repo (`.env*` is ignored). The repo is public.
