import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  compress: true,
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: '/(.*)',
      },
    ];
  },
  poweredByHeader: false,
  reactCompiler: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) return [];

    return [
      {
        destination: `${backendUrl}/:path*`,
        source: '/backend/:path*',
      },
    ];
  },
};

export default nextConfig;
