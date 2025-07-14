import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script'; // 1. Importamos o componente de Script

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão Integrada',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {/* 2. Usamos o componente Script em vez da tag normal */}
        <Script src="/lame.min.js" strategy="beforeInteractive" />
        
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}