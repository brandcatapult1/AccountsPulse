/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['pdfjs-dist', 'pg', 'bcryptjs'] },
  poweredByHeader: false,
};
export default nextConfig;
