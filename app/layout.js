import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão Integrada',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {/* Adicionado para conversão de áudio para MP3 */}
        <script src="/lame.min.js"></script>
        
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}