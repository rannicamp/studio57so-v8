// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Adicione esta seção para expor a variável de ambiente para a API
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
};

export default nextConfig;