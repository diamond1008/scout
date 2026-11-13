/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress punycode deprecation warning
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;
