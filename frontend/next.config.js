/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['your-supabase-storage-domain.supabase.co'],
  },
  // Add configuration to suppress hydration warnings for DarkReader attributes
  compiler: {
    styledComponents: true,
  },
  // Suppress specific hydration warnings related to DarkReader extension
  experimental: {
    runtime: 'nodejs',
    serverComponents: true,
    suppressHydrationWarning: true,
  },
};

module.exports = nextConfig;