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
                <div className={`${inter.className} h-screen w-screen overflow-hidden bg-white text-gray-900 relative`}>
                    {/* Botão flutuante e Menu Envelopado. O Absolute/Z-index garante sobreposição sem re-render */}
                    <BimSidebarWrapper />

                    {/* Toaster para notificações (Sucesso/Erro upload) */}
                    <Toaster position="top-right" richColors />
                    
                    {/* O conteúdo da página BIM (Visualizadores, sem ser atrapalhado por Flexbox root) */}
                    {children}
                </div>
            </EmpreendimentoProvider>
        </LayoutProvider>
    </AuthProvider>
  );
}