// Caminho: app/(bim)/layout.js
import { Inter } from 'next/font/google';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider } from '../../contexts/EmpreendimentoContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { Toaster } from 'sonner';

// Importa estilos globais e FontAwesome (igual ao main)
import '../globals.css'; 
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57 - BIM Manager',
  description: 'Gestão de Projetos e Modelos 3D',
};

export default function BimLayout({ children }) {
  return (
    <AuthProvider>
        <LayoutProvider>
            <EmpreendimentoProvider>
                <div className={`${inter.className} h-screen w-screen overflow-hidden bg-white text-gray-900`}>
                    {/* Toaster para notificações (Sucesso/Erro upload) */}
                    <Toaster position="top-right" richColors />
                    
                    {/* O conteúdo da página BIM (que já tem seu próprio sidebar) */}
                    {children}
                </div>
            </EmpreendimentoProvider>
        </LayoutProvider>
    </AuthProvider>
  );
}