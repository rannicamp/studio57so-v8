// app/(main)/contatos/page.js

"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import ContatoList from '../../../components/ContatoList';
import ContatoImporter from '../../../components/ContatoImporter';
import KpiCard from '../../../components/KpiCard'; 
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faCopy, faSpinner, faWandMagicSparkles, faUsers, faGlobeAmericas, faPhoneSlash, faFileExport } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ContatoDetalhesSidebar from '../../../components/ContatoDetalhesSidebar';
// CORREÇÃO AQUI: Ajustamos o caminho para o correto, conforme você indicou
import ActivityModal from '../../../components/AtividadeModal';

const fetchContatos = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contatos')
      .select('*, telefones ( id, telefone, country_code ), emails ( id, email )')
      .order('nome');

    if (error) {
        throw new Error(error.message);
    }
    return data || [];
};

export default function GerenciamentoContatosPage() {
    const { setPageTitle } = useLayout();
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);
    const [selectedContato, setSelectedContato] = useState(null);
    const queryClient = useQueryClient();

    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [currentContactForActivity, setCurrentContactForActivity] = useState(null);


    const { data: contatos = [], isLoading, error } = useQuery({
        queryKey: ['contatos'],
        queryFn: fetchContatos,
        onError: (err) => {
            toast.error(`Erro ao carregar contatos: ${err.message}`);
        }
    });
    
    useState(() => {
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
        const total = contatos.length;
        const semTelefone = contatos.filter(c => !c.telefones || c.telefones.length === 0).length;
        const comTelefoneBrasil = contatos.filter(c => c.telefones?.some(t => t.country_code === '+55')).length;
        const comTelefoneEUA = contatos.filter(c => c.telefones?.some(t => t.country_code === '+1')).length;
        return { total, semTelefone, comTelefoneBrasil, comTelefoneEUA };
    }, [contatos]);
    
    const handleActionComplete = () => {
        queryClient.invalidateQueries({ queryKey: ['contatos'] });
        if (selectedContato) {
            const updatedContact = contatos.find(c => c.id === selectedContato.id);
            if (updatedContact) {
                setSelectedContato(updatedContact);
            }
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
        setCurrentContactForActivity(contatos.find(c => c.id === activity.contato_id));
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
                    onSuccess={handleActivitySuccess}
                    contato={currentContactForActivity}
                    initialData={editingActivity}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Total de Contatos" value={kpiData.total} icon={faUsers} color="blue" />
                <KpiCard title="Contatos do Brasil" value={kpiData.comTelefoneBrasil} icon={faGlobeAmericas} color="green" />
                <KpiCard title="Contatos dos EUA" value={kpiData.comTelefoneEUA} icon={faGlobeAmericas} color="yellow" />
                <KpiCard title="Contatos sem Telefone" value={kpiData.semTelefone} icon={faPhoneSlash} color="red" />
            </div>

            <div className="flex justify-end items-center gap-4 flex-wrap">
                <button onClick={() => setIsImporterOpen(true)} disabled={isExporting} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400"> <FontAwesomeIcon icon={faFileImport} /> Importar CSV </button>
                <button onClick={handleExportToGoogle} disabled={isExporting} className="bg-gray-700 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-800 flex items-center gap-2 disabled:bg-gray-400"> <FontAwesomeIcon icon={isExporting ? faSpinner : faFileExport} spin={isExporting} /> Exportar para Google </button>
                <Link href="/contatos/duplicatas" className="bg-orange-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-orange-600 flex items-center gap-2"> <FontAwesomeIcon icon={faCopy} /> Mesclar </Link>
                <Link href="/contatos/formatar-telefones" className="bg-purple-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-purple-600 flex items-center gap-2"> <FontAwesomeIcon icon={faWandMagicSparkles} /> Padronizar </Link>
                <Link href="/contatos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600"> + Novo Contato </Link>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <ContatoList 
                    initialContatos={contatos} 
                    onActionComplete={handleActionComplete}
                    onRowClick={handleViewContatoDetails}
                />
            </div>
        </div>
    );
}