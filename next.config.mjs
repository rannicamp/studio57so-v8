// Caminho do arquivo: next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  // AQUI ESTÁ A CONFIGURAÇÃO NECESSÁRIA:
  // Estamos dizendo ao sistema que ele tem permissão para otimizar
  // e carregar imagens que vêm do seu banco de dados da Supabase.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vhuvnutzklhskkwbpxdz.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;