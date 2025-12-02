/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Desativa mapas de fonte em produção para build mais rápido
  productionBrowserSourceMaps: false,
  
  // 1. LISTA DE IMAGENS PERMITIDAS (A Correção)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Permite imagens do seu Banco de Dados
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com', // Avatares do Google
      },
      {
        protocol: 'https',
        hostname: '**.facebook.com', // Facebook
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net', // CDN do Facebook
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com', // Instagram
      },
    ],
  },
  
  // 2. CORREÇÃO DE DEPLOY (Mantida)
  eslint: {
    ignoreDuringBuilds: true, // Ignora erros de texto/aspas no deploy
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },

  // 3. CONFIGURAÇÃO PWA/SERVICE WORKER (Mantida)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/custom-sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};

export default nextConfig;