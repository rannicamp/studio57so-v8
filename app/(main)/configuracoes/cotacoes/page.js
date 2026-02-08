// Local do Arquivo: app/(main)/configuracoes/cotacoes/page.js
"use client";

import CotacoesManager from '@/components/configuracoes/CotacoesManager';
import { useAuth } from '@/contexts/AuthContext';

export default function PaginaConfiguracaoCotacoes() {
    // Usamos o useAuth para pegar os dados do usuário logado
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Carregando informações do usuário...</div>;
    }
    
    // Se por algum motivo não encontrar o usuário, exibe uma mensagem
    if (!user) {
        return <div>Usuário não encontrado. Por favor, faça login novamente.</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Configurações de Cotações</h1>
            {/* Renderiza o componente de gerenciamento, passando os dados do usuário para ele */}
            <CotacoesManager user={user} />
        </div>
    );
}