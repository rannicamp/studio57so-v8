// Caminho: app/(bim)/layout.js
import { Inter } from 'next/font/google';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider } from '../../contexts/EmpreendimentoContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { Toaster } from 'sonner';
import BimSidebarWrapper from '@/components/bim/BimSidebarWrapper';

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
                <div className={`${inter.className} h-screen w-screen bg-white text-gray-900 flex overflow-hidden`}>
                    
                    {/* O Wrapper agora funciona empurrando o layout quando aberto, integrado nativamente (Flex Item 1) */}
                    <BimSidebarWrapper />

                    {/* Conteúdo Dinâmico do BIM Manager (Flex Item 2) */}
                    <div className="flex-1 h-screen relative overflow-hidden transition-all duration-300">
                        {/* Toaster para notificações (Sucesso/Erro upload) */}
                        <Toaster position="top-right" richColors />
                        
                        {/* O conteúdo da página BIM (Visualizadores web GL) */}
                        {children}
                    </div>
                </div>
            </EmpreendimentoProvider>
        </LayoutProvider>
    </AuthProvider>
  );
}