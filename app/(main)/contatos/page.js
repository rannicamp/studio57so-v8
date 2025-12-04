// app/(main)/contatos/page.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import ContatoList from '../../../components/contatos/ContatoList';
import ContatoImporter from '../../../components/contatos/ContatoImporter';
import KpiCard from '../../../components/KpiCard'; 
import { useLayout } from '../../../contexts/LayoutContext';
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faCopy, faSpinner, faWandMagicSparkles, faUsers, faGlobeAmericas, faPhoneSlash, faFileExport } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import ContatoDetalhesSidebar from '../../../components/contatos/ContatoDetalhesSidebar';
import ActivityModal from '../../../components/atividades/AtividadeModal';

// Função de busca otimizada
const fetchContatosPage = async ({ pageParam = 0, queryKey }) => {
    const supabase = createClient();
    const [, organizacaoId] = queryKey;
    if (!organizacaoId) return { data: [], nextCursor: null };

    const PAGE_SIZE = 50; 
    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // 1. Busca Contatos Paginados
    const { data: contatos, error: contatosError, count } = await supabase
        .from('contatos')
        .select('*', { count: 'exact' })
        .eq('organizacao_id', organizacaoId)
        .order('nome', { ascending: true }) 
        .range(from, to);

    if (contatosError) throw new Error(contatosError.message);

    if (!contatos || contatos.length === 0) {
        return { data: [], nextCursor: null, total: count };
    }

    // 2. Busca Telefones e Emails APENAS para os contatos desta página
    const contatoIds = contatos.map(c => c.id);

    const { data: telefones } = await supabase
        .from('telefones')
        .select('contato_id, id, telefone, country_code')
        .in('contato_id', contatoIds)
        .eq('organizacao_id', organizacaoId);

    const { data: emails } = await supabase
        .from('emails')
        .select('contato_id, id, email')
        .in('contato_id', contatoIds)
        .eq('organizacao_id', organizacaoId);

    // 3. Monta o objeto final
    const contatosMap = new Map(contatos.map(c => [c.id, { ...c, telefones: [], emails: [] }]));

    if (telefones) {
        telefones.forEach(t => {
            if (contatosMap.has(t.contato_id)) contatosMap.get(t.contato_id).telefones.push(t);
        });
    }

    if (emails) {
        emails.forEach(e => {
            if (contatosMap.has(e.contato_id)) contatosMap.get(e.contato_id).emails.push(e);
        });
    }

    const finalData = Array.from(contatosMap.values());
    
    // Verifica se tem mais páginas
    const nextCursor = (from + PAGE_SIZE) < count ? pageParam + 1 : null;

    return { data: finalData, nextCursor, total: count };
};

export default function GerenciamentoContatosPage() {
    const { setPageTitle } = useLayout();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);
    const [selectedContato, setSelectedContato] = useState(null);
    const queryClient = useQueryClient();

    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [currentContactForActivity, setCurrentContactForActivity] = useState(null);

    // --- INFINITE QUERY ---
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error,
        isRefetching
    } = useInfiniteQuery({
        queryKey: ['contatos-infinito', organizacaoId],
        queryFn: fetchContatosPage,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5, 
        refetchOnWindowFocus: false, 
    });

    const allContatos = useMemo(() => {
        return data?.pages.flatMap(page => page.data) || [];
    }, [data]);

    const totalContatosReais = data?.pages[0]?.total || 0;

    useEffect(() => {
        setPageTitle('Gerenciamento de Contatos');
    }, [setPageTitle]);

    const handleExportToGoogle = async () => {
        setIsExporting(true);
        const exportPromise = new Promise(async (resolve, reject) => {
            try {
                const response = await fetch('/api/contatos/export');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Falha ao gerar o arquivo de exportação.');
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'contatos_google.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                resolve('Arquivo CSV gerado com sucesso!');
            } catch (error) {
                reject(error);
            }
        });

        toast.promise(exportPromise, {
            loading: 'Gerando arquivo de exportação...',
            success: (message) => message,
            error: (err) => `Erro na exportação: ${err.message}`,
            finally: () => setIsExporting(false)
        });
    };

    const kpiData = useMemo(() => {
        const total = totalContatosReais; 
        const semTelefone = allContatos.filter(c => !c.telefones || c.telefones.length === 0).length;
        const comTelefoneBrasil = allContatos.filter(c => c.telefones?.some(t => t.country_code === '+55')).length;
        const comTelefoneEUA = allContatos.filter(c => c.telefones?.some(t => t.country_code === '+1')).length;
        return { total, semTelefone, comTelefoneBrasil, comTelefoneEUA };
    }, [allContatos, totalContatosReais]);
    
    const handleActionComplete = () => {
        queryClient.invalidateQueries({ queryKey: ['contatos-infinito', organizacaoId] });
        if (selectedContato) {
            handleCloseDetailsSidebar();
        }
    };

    const handleViewContatoDetails = (contato) => {
        setSelectedContato(contato);
        setIsDetailsSidebarOpen(true);
    };

    const handleCloseDetailsSidebar = () => {
        setIsDetailsSidebarOpen(false);
        setTimeout(() => setSelectedContato(null), 300);
    };

    const handleAddActivity = (contato) => {
        setCurrentContactForActivity(contato);
        setEditingActivity(null);
        setIsActivityModalOpen(true);
    };

    const handleEditActivity = (activity) => {
        setCurrentContactForActivity(allContatos.find(c => c.id === activity.contato_id));
        setEditingActivity(activity);
        setIsActivityModalOpen(true);
    };
    
    const handleCloseActivityModal = () => {
        setIsActivityModalOpen(false);
        setEditingActivity(null);
        setCurrentContactForActivity(null);
    };

    const handleActivitySuccess = () => {
        handleCloseActivityModal();
        handleActionComplete(); 
    };

    if (isLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" /><p className="mt-3 text-gray-600">Carregando contatos...</p></div>
    }
    
    if (error) {
        return <div className="text-center p-10 bg-red-50 text-red-700 rounded-lg"><p>Não foi possível carregar os contatos.</p><p className="text-sm">{error.message}</p></div>
    }

    return (
        <div className="space-y-6">
            <ContatoImporter isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)} onImportComplete={handleActionComplete} />
            <ContatoDetalhesSidebar open={isDetailsSidebarOpen} onClose={handleCloseDetailsSidebar} contato={selectedContato} onActionComplete={handleActionComplete} onAddActivity={handleAddActivity} onEditActivity={handleEditActivity} />
            
            {isActivityModalOpen && (
                <ActivityModal
                    isOpen={isActivityModalOpen}
                    onClose={handleCloseActivityModal}
                    onActivityAdded={handleActivitySuccess}
                    activityToEdit={editingActivity}
                    initialContatoId={currentContactForActivity?.id}
                />
            )}

            {/* KPI GRID ATUALIZADO (Sem o card inútil) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Total no Banco" value={kpiData.total} icon={faUsers} color="blue" />
                <KpiCard title="Contatos do Brasil" value={kpiData.comTelefoneBrasil} icon={faGlobeAmericas} color="green" />
                <KpiCard title="Contatos dos EUA" value={kpiData.comTelefoneEUA} icon={faGlobeAmericas} color="yellow" />
                <KpiCard title="Sem Telefone" value={kpiData.semTelefone} icon={faPhoneSlash} color="red" />
            </div>

            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-2 h-8">
                    {isRefetching && !isFetchingNextPage && (
                        <span className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full animate-pulse">
                            <FontAwesomeIcon icon={faSpinner} spin /> Atualizando lista...
                        </span>
                    )}
                </div>

                <div className="flex justify-end items-center gap-4 flex-wrap">
                    <button onClick={() => setIsImporterOpen(true)} disabled={isExporting} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400"> <FontAwesomeIcon icon={faFileImport} /> Importar CSV </button>
                    <button onClick={handleExportToGoogle} disabled={isExporting} className="bg-gray-700 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-800 flex items-center gap-2 disabled:bg-gray-400"> <FontAwesomeIcon icon={isExporting ? faSpinner : faFileExport} spin={isExporting} /> Exportar para Google </button>
                    <Link href="/contatos/duplicatas" className="bg-orange-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-orange-600 flex items-center gap-2"> <FontAwesomeIcon icon={faCopy} /> Mesclar </Link>
                    <Link href="/contatos/formatar-telefones" className="bg-purple-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-purple-600 flex items-center gap-2"> <FontAwesomeIcon icon={faWandMagicSparkles} /> Padronizar </Link>
                    <Link href="/contatos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600"> + Novo Contato </Link>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 h-[calc(100vh-300px)] flex flex-col">
                <ContatoList 
                    initialContatos={allContatos} 
                    onActionComplete={handleActionComplete}
                    onRowClick={handleViewContatoDetails}
                    fetchNextPage={fetchNextPage}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                />
            </div>
        </div>
    );
}