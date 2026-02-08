'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Importando os componentes originais (ajuste o caminho conforme sua estrutura real)
// Baseado no seu arquivo anterior, eles parecem estar na raiz de components/
import JornadaManager from '@/components/rh/JornadaManager';
import FeriadoManager from '@/components/rh/FeriadoManager';

export default function JornadasSection() {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacao_id = user?.organizacao_id;

    // Buscar Jornadas
    const { data: jornadas = [], isLoading: loadingJornadas } = useQuery({
        queryKey: ['jornadas', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];
            const { data, error } = await supabase
                .from('jornadas')
                .select(`*, detalhes:jornada_detalhes(*)`)
                .eq('organizacao_id', organizacao_id)
                .order('nome_jornada');
            if (error) throw error;
            return data;
        },
        enabled: !!organizacao_id
    });

    // Buscar Feriados
    const { data: feriados = [], isLoading: loadingFeriados } = useQuery({
        queryKey: ['feriados', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];
            const { data, error } = await supabase
                .from('feriados')
                .select('*')
                .eq('organizacao_id', organizacao_id)
                .order('data_feriado');
            if (error) throw error;
            return data;
        },
        enabled: !!organizacao_id
    });

    if (loadingJornadas || loadingFeriados) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                <p>Carregando configurações de jornada...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Seção de Jornadas */}
            <div className="space-y-4">
                <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-gray-800">Gerenciar Jornadas de Trabalho</h2>
                    <p className="text-sm text-gray-500">
                        Defina os horários padrão de entrada, saída e intervalos da sua equipe.
                    </p>
                </div>
                {/* Renderiza o componente existente passando os dados carregados */}
                <JornadaManager initialJornadas={jornadas} />
            </div>

            {/* Seção de Feriados */}
            <div className="space-y-4 pt-6">
                <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-gray-800">Gerenciar Feriados</h2>
                    <p className="text-sm text-gray-500">
                        Adicione feriados para que não sejam contabilizados como falta no ponto.
                    </p>
                </div>
                {/* Renderiza o componente existente passando os dados carregados */}
                <FeriadoManager initialFeriados={feriados} />
            </div>
        </div>
    );
}