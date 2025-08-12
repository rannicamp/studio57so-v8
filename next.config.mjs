const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Desativa o PWA em modo de desenvolvimento
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suas outras configurações do Next.js podem vir aqui
  // Por exemplo: reactStrictMode: true,
};

module.exports = withPWA(nextConfig);