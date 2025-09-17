// app/(main)/recursos-humanos/page.js
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { createClient } from '../../../utils/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUsers, faClock } from '@fortawesome/free-solid-svg-icons';
import GerenciamentoFuncionarios from '../../../components/rh/GerenciamentoFuncionarios';
import GerenciamentoPonto from '../../../components/rh/GerenciamentoPonto';

// =================================================================================
// INÍCIO DA CORREÇÃO
// O PORQUÊ: Corrigimos o nome da tabela de 'funcionarios_view' para 'funcionarios',
// que é o nome correto no seu banco de dados. Isso resolverá o erro.
// =================================================================================
const fetchRecursosHumanosData = async (supabase, organizacaoId, permissoes) => {
    if (!organizacaoId) return { funcionarios: [], pontos: [] };

    let funcionarios = [];
    let pontos = [];

    if (permissoes?.funcionarios?.pode_ver) {
        const { data: funcionariosData, error: funcionariosError } = await supabase
            .from('funcionarios') // <-- NOME DA TABELA CORRIGIDO AQUI
            .select('*')
            .eq('organizacao_id', organizacaoId)
            .order('full_name', { ascending: true });
        if (funcionariosError) throw new Error(`Erro ao buscar funcionários: ${funcionariosError.message}`);
        funcionarios = funcionariosData;
    }

    if (permissoes?.ponto?.pode_ver) {
        // Lógica de busca de dados do ponto pode ser adicionada aqui se necessário
    }

    return { funcionarios, pontos };
};
// =================================================================================
// FIM DA CORREÇÃO
// =================================================================================

export default function RecursosHumanosPage() {
    const { permissions } = useAuth();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [activeTab, setActiveTab] = useState('');

    const podeVerFuncionarios = permissions.funcionarios?.pode_ver;
    const podeVerPonto = permissions.ponto?.pode_ver;

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['recursosHumanos', organizacaoId, permissions],
        queryFn: () => fetchRecursosHumanosData(supabase, organizacaoId, permissions),
        enabled: !!organizacaoId && (podeVerFuncionarios || podeVerPonto),
    });

    useEffect(() => {
        if (podeVerFuncionarios) {
            setActiveTab('funcionarios');
        } else if (podeVerPonto) {
            setActiveTab('ponto');
        }
    }, [podeVerFuncionarios, podeVerPonto]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    }

    if (isError) {
        return <div className="text-center text-red-500">Erro ao carregar dados: {error.message}</div>;
    }

    if (!podeVerFuncionarios && !podeVerPonto) {
        return (
            <div className="text-center text-gray-500">
                Você não tem permissão para acessar esta seção.
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            <div>
                <div className="flex border-b">
                    {podeVerFuncionarios && (
                        <button
                            onClick={() => setActiveTab('funcionarios')}
                            className={`py-2 px-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'funcionarios' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <FontAwesomeIcon icon={faUsers} />
                            Funcionários
                        </button>
                    )}
                    {podeVerPonto && (
                        <button
                            onClick={() => setActiveTab('ponto')}
                            className={`py-2 px-4 text-sm font-medium flex items-center gap-2 ${activeTab === 'ponto' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <FontAwesomeIcon icon={faClock} />
                            Controle de Ponto
                        </button>
                    )}
                </div>
            </div>

            <div>
                {activeTab === 'funcionarios' && podeVerFuncionarios && (
                    <GerenciamentoFuncionarios initialFuncionarios={data?.funcionarios || []} />
                )}
                {activeTab === 'ponto' && podeVerPonto && (
                    <GerenciamentoPonto />
                )}
            </div>
        </div>
    );
}