import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão Integrada',
  manifest: '/manifest.json', // Adiciona o manifesto ao metadata
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
        {/* Adiciona a cor do tema para a barra de status em celulares */}
        <meta name="theme-color" content="#0288d1" />
      </head>
      <body className={inter.className}>
        <Script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js" strategy="beforeInteractive" />
        
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}