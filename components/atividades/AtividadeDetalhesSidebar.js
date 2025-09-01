// components/atividades/AtividadeDetalhesSidebar.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPenToSquare, faCalendarAlt, faUser, faBuilding, faClipboardList, faAlignLeft, faSync, faPaperclip, faClock } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

const InfoField = ({ icon, label, value }) => {
    if (!value) return null;
    return (
        <div>
            <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
                <FontAwesomeIcon icon={icon} />
                {label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{value}</dd>
        </div>
    );
};

export default function AtividadeDetalhesSidebar({ open, onClose, activity, onEditActivity, onUpdate }) {
    const supabase = createClient();
    const [fullActivityData, setFullActivityData] = useState(activity);

    const fetchData = useCallback(async () => {
        if (!activity?.id) return;
        const { data, error } = await supabase
            .from('activities')
            .select('*, empreendimentos(nome), funcionario:funcionario_id(full_name)')
            .eq('id', activity.id)
            .single();

        if (error) {
            toast.error("Erro ao recarregar dados da atividade.");
        } else {
            setFullActivityData(data);
        }
    }, [activity, supabase]);

    useEffect(() => {
        setFullActivityData(activity);
        if(activity?.id){
            fetchData();
        }
    }, [activity, fetchData]);

    if (!open || !fullActivityData) return null;

    const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    const statusColors = {
        'Em Andamento': 'bg-blue-100 text-blue-800', 'Concluído': 'bg-green-100 text-green-800',
        'Pausado': 'bg-yellow-100 text-yellow-800', 'Cancelado': 'bg-red-100 text-red-800',
        'Não Iniciado': 'bg-gray-100 text-gray-800', 'Aguardando Material': 'bg-purple-100 text-purple-800',
    };

    return (
        <div className={`fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Detalhes da Atividade</h3>
                        <p className="text-xs text-gray-500">ID #{fullActivityData.id}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xl font-semibold text-gray-900">{fullActivityData.nome}</h4>
                            <button onClick={() => onEditActivity(fullActivityData)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"><FontAwesomeIcon icon={faPenToSquare}/> Editar</button>
                        </div>
                        <dl className="grid grid-cols-1 gap-y-4">
                            <InfoField icon={faAlignLeft} label="Descrição" value={fullActivityData.descricao} />
                            <InfoField icon={faBuilding} label="Empreendimento" value={fullActivityData.empreendimentos?.nome} />
                            <InfoField icon={faUser} label="Responsável" value={fullActivityData.funcionario?.full_name} />
                            <div>
                                <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={faClipboardList} /> Status</dt>
                                <dd className={`mt-1 text-sm font-semibold px-2 py-1 rounded-full inline-block ${statusColors[fullActivityData.status] || 'bg-gray-100'}`}>{fullActivityData.status}</dd>
                            </div>
                        </dl>
                    </section>

                    <section className="border-t pt-4">
                         <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} />Prazos</h4>
                         <dl className="grid grid-cols-2 gap-4">
                            <InfoField icon={faCalendarAlt} label="Início Previsto" value={formatDate(fullActivityData.data_inicio_prevista)} />
                            <InfoField icon={faCalendarAlt} label="Fim Previsto" value={formatDate(fullActivityData.data_fim_prevista)} />
                            <InfoField icon={faClock} label="Início Real" value={formatDate(fullActivityData.data_inicio_real)} />
                            <InfoField icon={faClock} label="Fim Real" value={formatDate(fullActivityData.data_fim_real)} />
                         </dl>
                    </section>

                    {fullActivityData.is_recorrente && (
                        <section className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faSync} />Recorrência</h4>
                            <p className="text-sm">Esta tarefa se repete.</p>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}