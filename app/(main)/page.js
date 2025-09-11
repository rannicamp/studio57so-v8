"use client";

// MUDANÇA AQUI: o caminho agora é 'painel'
import RhSection from '@/components/painel/RhSection';
import { useAuth } from '@/contexts/AuthContext';

// MUDANÇA AQUI: o nome do componente agora é PainelPage
export default function PainelPage() {
    const { userData } = useAuth();
    
    const nameToDisplay = userData?.nome_completo || `${userData?.nome || ''} ${userData?.sobrenome || ''}`.trim() || 'Usuário';

    return (
        <div className="flex-1 p-4 md:p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">
                Painel de Controle
            </h1>
            <p className="text-lg text-gray-600 mb-8">
                Olá, <span className="font-semibold">{nameToDisplay}</span>! Aqui está um resumo do Studio 57.
            </p>
            
            {/* Seção de Recursos Humanos */}
            <RhSection />

            {/* No futuro, adicionaremos outras seções aqui */}

        </div>
    );
}