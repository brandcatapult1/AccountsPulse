import './globals.css';
import { Manrope, IBM_Plex_Mono } from 'next/font/google';
const body = Manrope({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });
export const metadata = { title: 'Accounts Pulse', description: 'Invoices, ledgers and payments for the accounts team' };
export default function RootLayout({ children }) {
  return <html lang="en" className={`${body.variable} ${mono.variable}`}><body style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}>{children}</body></html>;
}
