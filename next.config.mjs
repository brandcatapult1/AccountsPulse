/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'pg', 'bcryptjs'],
  poweredByHeader: false,
};
export default nextConfig;
