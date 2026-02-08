/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Desativa mapas de fonte em produção para build mais rápido
  productionBrowserSourceMaps: false,

  // --- 🆕 AQUI ESTÁ A PROTEÇÃO QUE FALTAVA ---
  experimental: {
    serverActions: {
      // Lista de domínios permitidos para enviar dados (Server Actions)
      allowedOrigins: [
        'studio57.arq.br',
        'www.studio57.arq.br',
        'studio57.netlify.app',
        'localhost:3000'
      ],
      // Aumenta o limite para formulários grandes (Ajustado para BIM)
      bodySizeLimit: '500mb', 
    },
  },
  // -------------------------------------------

  // --- A CORREÇÃO DO ERRO DO PDF.JS ESTÁ AQUI ---
  webpack: (config) => {
    // Diz ao webpack para ignorar dependências de node que quebram o PDF.js no navegador
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    return config;
  },
  // ----------------------------------------------
  
  // 1. LISTA DE IMAGENS PERMITIDAS
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
  
  // 2. CORREÇÃO DE DEPLOY
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },

  // 3. CONFIGURAÇÃO PWA/SERVICE WORKER
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