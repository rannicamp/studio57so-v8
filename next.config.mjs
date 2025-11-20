import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // MUDANÇA AQUI: Apontamos para o arquivo na raiz
  swSrc: 'custom-sw.js', 
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'vhuvnutzklhskkwbpxdz.supabase.co' },
    ],
  },
};

export default withPWA(nextConfig);