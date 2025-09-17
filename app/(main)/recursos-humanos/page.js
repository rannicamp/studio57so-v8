// app/(main)/recursos-humanos/page.js
"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../../utils/supabase/client';
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faClock, faSpinner } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// INÍCIO DA CORREÇÃO
// O PORQUÊ: Corrigimos o caminho dos imports dos componentes locais. Assim como
// os outros imports, o caminho correto precisa de três '../' para "subir"
// até a pasta 'app' e depois encontrar a pasta 'components'.
// =================================================================================
import GerenciamentoFuncionarios from '../../../components/rh/GerenciamentoFuncionarios';
import GerenciamentoPonto from '../../../components/rh/GerenciamentoPonto';
// =================================================================================
// FIM DA CORREÇÃO
// =================================================================================

const fetchRhData = async (organizacaoId) => {
    if (!organizacaoId) {
        return { funcionarios: [], jornadas: [], feriados: [] };
    }
    const supabase = createClient();
    const [funcionariosRes, jornadasRes, feriadosRes] = await Promise.all([
        supabase.from('funcionarios').select('*, jornada:jornadas(*)').eq('organizacao_id', organizacaoId).order('full_name'),
        supabase.from('jornadas').select('*').eq('organizacao_id', organizacaoId),
        supabase.from('feriados').select('*').eq('organizacao_id', organizacaoId)
    ]);

    if (funcionariosRes.error) throw new Error(funcionariosRes.error.message);
    if (jornadasRes.error) throw new Error(jornadasRes.error.message);
    if (feriadosRes.error) throw new Error(feriadosRes.error.message);

    return {
        funcionarios: funcionariosRes.data || [],
        jornadas: jornadasRes.data || [],
        feriados: feriadosRes.data || [],
    };
};

const TabButton = ({ label, icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm uppercase flex items-center gap-2 ${
            isActive
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
    >
        <FontAwesomeIcon icon={icon} /> {label}
    </button>
);

export default function RecursosHumanosPage() {
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const [activeTab, setActiveTab] = useState('funcionarios');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['rhData', organizacaoId],
        queryFn: () => fetchRhData(organizacaoId),
        enabled: !!organizacaoId,
    });

    if (isLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando dados de RH...</div>;
    }

    if (isError) {
        return <div className="text-center p-10 text-red-600">Erro ao carregar dados: {error.message}</div>;
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 uppercase">Recursos Humanos</h1>
            
            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton 
                        label="Gerenciar Funcionários" 
                        icon={faUsers} 
                        isActive={activeTab === 'funcionarios'} 
                        onClick={() => setActiveTab('funcionarios')} 
                    />
                    <TabButton 
                        label="Folha de Ponto" 
                        icon={faClock} 
                        isActive={activeTab === 'ponto'} 
                        onClick={() => setActiveTab('ponto')} 
                    />
                </nav>
            </div>

            <div className="mt-4">
                {activeTab === 'funcionarios' && (
                    <GerenciamentoFuncionarios 
                        initialFuncionarios={data.funcionarios}
                        jornadas={data.jornadas}
                    />
                )}
                {activeTab === 'ponto' && (
                    <GerenciamentoPonto 
                        funcionarios={data.funcionarios}
                        feriados={data.feriados}
                    />
                )}
            </div>
        </div>
    );
}