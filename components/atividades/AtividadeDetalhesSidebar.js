//components\atividades\AtividadeDetalhesSidebar.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPenToSquare, faCalendarAlt, faUser, faBuilding, faClipboardList, faAlignLeft, faPaperclip, faDownload, faSpinner, faFileZipper, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';

// Componente InfoField para exibir informações
const InfoField = ({ icon, label, value, isLink = false, onClick }) => {
    if (!value) return null;
    return (
        <div>
            <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
                <FontAwesomeIcon icon={icon} />
                {label}
            </dt>
            {isLink ? (
                <dd onClick={onClick} className="mt-1 text-sm text-blue-600 hover:text-blue-800 cursor-pointer hover:underline">{value}</dd>
            ) : (
                <dd className="mt-1 text-sm text-gray-900">{value}</dd>
            )}
        </div>
    );
};

// Função de busca de dados isolada para useQuery
const fetchActivityDetails = async (activityId) => {
    if (!activityId) return null;
    const supabase = createClient();
    const { data, error } = await supabase
        .from('activities')
        .select('*, empreendimentos(nome), funcionario:funcionario_id(full_name), anexos:activity_anexos(*), atividade_pai:atividade_pai_id(id, nome), sub_tarefas:activities(id, nome, status)')
        .eq('id', activityId)
        .single();

    if (error) {
        toast.error("Erro ao carregar dados da atividade.");
        console.error("Erro ao buscar detalhes da atividade:", error);
        throw new Error(error.message);
    }
    return data;
};


export default function AtividadeDetalhesSidebar({ open, onClose, activity, onEditActivity }) {
    const supabase = createClient();
    const [isZipping, setIsZipping] = useState(false);

    // Otimização: Usando useQuery para buscar e gerenciar os dados da atividade
    const { data: fullActivityData, isLoading: loading, isError } = useQuery({
        queryKey: ['activityDetails', activity?.id],
        queryFn: () => fetchActivityDetails(activity?.id),
        enabled: !!open && !!activity?.id, // A query só é executada se o sidebar estiver aberto e houver uma atividade
        staleTime: 5 * 60 * 1000, // Cache de 5 minutos
    });

    const handleDownload = async (anexo) => {
        const { data, error } = await supabase.storage.from('activity-anexos').download(anexo.file_path);
        if (error) {
            toast.error('Erro ao baixar o anexo: ' + error.message);
            return;
        }
        const blob = new Blob([data], { type: anexo.file_type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = anexo.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadAll = async () => {
        if (!fullActivityData?.anexos || fullActivityData.anexos.length === 0) {
            toast.info("Não há anexos para baixar.");
            return;
        }
        setIsZipping(true);
        const toastId = toast.loading("Preparando arquivos para download...");
        try {
            const zip = new JSZip();
            const downloadPromises = fullActivityData.anexos.map(anexo =>
                supabase.storage.from('activity-anexos').download(anexo.file_path)
            );
            
            const results = await Promise.all(downloadPromises);
            
            results.forEach((result, index) => {
                if (!result.error && result.data) {
                    const anexo = fullActivityData.anexos[index];
                    zip.file(anexo.file_name, result.data);
                }
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = window.URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Anexos_Atividade_${fullActivityData.id}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            toast.success("Download iniciado!", { id: toastId });
        } catch (error) {
            console.error("Erro ao criar ZIP:", error);
            toast.error("Ocorreu um erro ao preparar os arquivos.", { id: toastId });
        } finally {
            setIsZipping(false);
        }
    };

    if (!open) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    
    return (
        <div className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
                <header className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Detalhes da Atividade</h3>
                        {fullActivityData && <p className="text-xs text-gray-500">ID #{fullActivityData.id}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </header>
                
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : isError || !fullActivityData ? (
                        <p className="text-center text-gray-500">Não foi possível carregar os detalhes da atividade.</p>
                    ) : (
                        <>
                            <section>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xl font-semibold text-gray-900">{fullActivityData.nome}</h4>
                                    <button onClick={() => onEditActivity(fullActivityData)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                        <FontAwesomeIcon icon={faPenToSquare} /> Editar
                                    </button>
                                </div>
                                <dl className="grid grid-cols-1 gap-y-4">
                                    {fullActivityData.atividade_pai && (
                                        <InfoField 
                                            icon={faSitemap} 
                                            label="Sub-tarefa de" 
                                            value={fullActivityData.atividade_pai.nome}
                                            isLink={true}
                                            onClick={() => alert(`Abrir detalhes da atividade #${fullActivityData.atividade_pai.id}`)} // Ação futura
                                        />
                                    )}
                                    <InfoField icon={faAlignLeft} label="Descrição" value={fullActivityData.descricao} />
                                    <InfoField icon={faBuilding} label="Empreendimento" value={fullActivityData.empreendimentos?.nome} />
                                    <InfoField icon={faUser} label="Responsável" value={fullActivityData.funcionario?.full_name} />
                                    <div>
                                        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={faClipboardList} /> Status</dt>
                                        <dd className="mt-1 text-sm font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded-full inline-block">{fullActivityData.status}</dd>
                                    </div>
                                </dl>
                            </section>
                            
                            <section className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} /> Datas e Prazos</h4>
                                <dl className="grid grid-cols-2 gap-4">
                                    <InfoField label="Início Previsto" value={formatDate(fullActivityData.data_inicio_prevista)} />
                                    <InfoField label="Fim Previsto" value={formatDate(fullActivityData.data_fim_prevista)} />
                                    <InfoField label="Início Real" value={formatDate(fullActivityData.data_inicio_real)} />
                                    <InfoField label="Fim Real" value={formatDate(fullActivityData.data_fim_real)} />
                                </dl>
                            </section>

                            {fullActivityData.sub_tarefas && fullActivityData.sub_tarefas.length > 0 && (
                                <section className="border-t pt-4">
                                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faSitemap} rotation={90} /> 
                                        Sub-tarefas ({fullActivityData.sub_tarefas.length})
                                    </h4>
                                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                        {fullActivityData.sub_tarefas.map(subtarefa => (
                                            <div key={subtarefa.id} className="p-2 bg-white rounded-md text-sm border flex justify-between items-center">
                                                <p className="font-medium truncate" title={subtarefa.nome}>{subtarefa.nome}</p>
                                                <span className="text-xs font-semibold px-2 py-1 bg-gray-200 text-gray-700 rounded-full">{subtarefa.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                            
                            {fullActivityData.anexos && fullActivityData.anexos.length > 0 && (
                                <section className="border-t pt-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faPaperclip} /> 
                                            Anexos ({fullActivityData.anexos.length})
                                        </h4>
                                        <button 
                                            onClick={handleDownloadAll} 
                                            disabled={isZipping}
                                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            {isZipping ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileZipper} />}
                                            Baixar Todos
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                        {fullActivityData.anexos.map(anexo => (
                                            <div key={anexo.id} className="p-2 bg-white rounded-md text-sm border flex justify-between items-center">
                                                <p className="font-medium truncate" title={anexo.file_name}>{anexo.file_name}</p>
                                                <button onClick={() => handleDownload(anexo)} className="text-blue-600 hover:text-blue-800" title="Baixar anexo">
                                                    <FontAwesomeIcon icon={faDownload} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}