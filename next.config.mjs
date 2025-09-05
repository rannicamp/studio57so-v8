// next.config.mjs

import withPWA from 'next-pwa';

// Configuração do PWA
const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
};

// Configuração principal do Next.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com', 'firebasestorage.googleapis.com'],
  },
};

// Une as duas configurações
const withPWAConfig = withPWA(pwaConfig);
export default withPWAConfig(nextConfig);