"use client"; // Necessário para usar hooks como useAuth e useEffect

import { useEffect, useState } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import EmpreendimentoList from '../../../components/EmpreendimentoList';
import { useAuth } from '../../../contexts/AuthContext'; // Importa o hook de autenticação
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

export default function GerenciamentoEmpreendimentosPage() {
    const supabase = createClient();
    const router = useRouter();
    
    // Usa o hook central para obter permissões e estado de carregamento
    const { hasPermission, loading: authLoading } = useAuth();

    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Permissões agora são lidas diretamente do contexto
    const canView = hasPermission('empreendimentos', 'pode_ver');
    const canCreate = hasPermission('empreendimentos', 'pode_criar');

    useEffect(() => {
        // Se o contexto de autenticação ainda está carregando, não faz nada
        if (authLoading) {
            return;
        }

        // Se o usuário não pode ver a página, redireciona
        if (!canView) {
            router.push('/');
            return;
        }

        // Se pode ver, busca os dados
        const fetchEmpreendimentos = async () => {
            setLoadingData(true);
            const { data, error } = await supabase
                .from('empreendimentos')
                .select(`
                    id,
                    nome,
                    status,
                    empresa_proprietaria:empresa_proprietaria_id ( razao_social )
                `)
                .order('nome');

            if (error) {
                console.error('Erro ao buscar empreendimentos:', error);
            } else {
                setEmpreendimentos(data || []);
            }
            setLoadingData(false);
        };

        fetchEmpreendimentos();
    }, [canView, authLoading, router, supabase]);

    // Tela de carregamento enquanto o contexto ou os dados carregam
    if (authLoading || loadingData) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <p className="mt-2">Carregando...</p>
            </div>
        );
    }
    
    // Tela de acesso negado se o usuário não tiver permissão
    if (!canView) {
        return (
             <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para visualizar esta página.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Empreendimentos</h1>
                {/* O botão de "Novo Empreendimento" só aparece se o usuário tiver permissão para criar */}
                {canCreate && (
                    <Link href="/empreendimentos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
                        + Novo Empreendimento
                    </Link>
                )}
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
                <EmpreendimentoList initialEmpreendimentos={empreendimentos} />
            </div>
        </div>
    );
}