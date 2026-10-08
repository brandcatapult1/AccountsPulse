/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: { '/api/invoices/upload': ['./node_modules/pdfjs-dist/legacy/build/**/*'] },
  serverExternalPackages: ['pdfjs-dist', 'pg', 'bcryptjs'],
  poweredByHeader: false,
};
export default nextConfig;
