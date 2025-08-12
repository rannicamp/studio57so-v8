import withPWA from 'next-pwa';

// As configurações do seu PWA (Progressive Web App)
const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Desativa o PWA em modo de desenvolvimento
};

// As configurações do seu Next.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suas outras configurações do Next.js podem vir aqui
};

// O código abaixo une as duas configurações para você
export default withPWA(pwaConfig)(nextConfig);