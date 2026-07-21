/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Proxy: todas las peticiones /api/v1/* se reenvían al backend NestJS
  // Esto resuelve el problema de CORS y conecta frontend ↔ backend
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
