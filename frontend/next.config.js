/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      'your-supabase-storage-domain.supabase.co',
      'wwseluouwhayabrgghyn.supabase.co', // Supabase storage domain for trip cover photos
    ],
  },
  // Add configuration to suppress hydration warnings for DarkReader attributes
  compiler: {
    styledComponents: true,
  },
};

module.exports = nextConfig;