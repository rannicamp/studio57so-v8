// Caminho do arquivo: /next.config.mjs

import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Atualizando para a propriedade 'remotePatterns', que é mais segura e moderna.
    remotePatterns: [
      // Seus domínios antigos foram mantidos aqui:
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      // E aqui adicionamos o novo domínio do Supabase:
      {
        protocol: 'https',
        hostname: 'vhuvnutzklhskkwbpxdz.supabase.co',
      },
    ],
  },
};

export default withPWA(nextConfig);