/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = {
  // Suas outras configurações do Next.js podem vir aqui
};

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Desativa o PWA em modo de desenvolvimento para evitar problemas de cache
});

export default pwaConfig(nextConfig);