"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faSearch, faInfoCircle, faTimes, faCog, faWrench, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

const COLUNAS = [
    { id: 'Novo', label: 'Novos', icon: faInfoCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'Em Análise', label: 'Em Análise', icon: faSearch, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'Implementado', label: 'Implementados', icon: faCheck, color: 'text-green-500', bg: 'bg-green-50' },
    { id: 'Recusado', label: 'Recusados', icon: faTimes, color: 'text-red-500', bg: 'bg-red-50' },
];

export default function FeedbackKanban({ initialFeedbacks, isReadOnly = false }) {
    const [feedbacks, setFeedbacks] = useState(initialFeedbacks || []);
    const supabase = createClient();

    const { mutate: changeStatus } = useMutation({
        mutationFn: async ({ id, novoStatus }) => {
            const { error } = await supabase
                .from('feedback')
                .update({ status: novoStatus })
                .eq('id', id);

            if (error) throw error;
            return { id, novoStatus };
        },
        onMutate: async ({ id, novoStatus }) => {
            // Optimistic Update
            setFeedbacks(prev => 
                prev.map(f => f.id === id ? { ...f, status: novoStatus } : f)
            );
        },
        onSuccess: () => {
             toast.success('Status atualizado! 🎉');
        },
        onError: (err, { id }, context) => {
             toast.error('Erro ao mover o card.');
             // Você poderia reverter o optimistic update aqui usando o context
        }
    });

    const getColumnFeedbacks = (statusNome) => {
        return feedbacks.filter(f => (f.status || 'Novo') === statusNome);
    };

    return (
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
            <div className="flex items-start gap-6 min-w-max p-2">
                {COLUNAS.map(coluna => {
                    const cards = getColumnFeedbacks(coluna.id);

                    return (
                        <div key={coluna.id} className="w-80 flex flex-col gap-4">
                            {/* Cabeçalho Limpo */}
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${coluna.bg} ${coluna.color}`}>
                                        <FontAwesomeIcon icon={coluna.icon} size="xs" />
                                    </div>
                                    {coluna.label}
                                </h3>
                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {cards.length}
                                </span>
                            </div>

                            {/* Cartões */}
                            <div className="flex flex-col gap-3 min-h-[500px] bg-gray-50/30 p-2 rounded-xl border border-dashed border-gray-200">
                                {cards.map(fb => (
                                    <div key={fb.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                ID #{fb.id}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(fb.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        
                                        <p className="text-sm text-gray-800 font-medium mb-3 line-clamp-4">
                                            "{fb.descricao}"
                                        </p>

                                        {fb.link_opcional && (
                                            <a href={fb.link_opcional} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-500 hover:text-blue-600 mb-3 truncate font-medium bg-blue-50/50 p-1.5 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors">
                                                🔗 {fb.link_opcional}
                                            </a>
                                        )}

                                        {fb.imagem_url && (
                                            <div className="mb-3 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center h-24 relative hover:opacity-90 transition-opacity cursor-pointer group/img" onClick={() => window.open(fb.imagem_url, '_blank')}>
                                                <img src={fb.imagem_url} alt="Print do Anexo" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                    <span className="text-white text-xs font-bold">Ver Ampliado</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-t pt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold font-khand shadow-inner">
                                                    {fb.usuario?.nome?.[0] || '?'}
                                                </div>
                                                <span className="text-xs text-gray-700 font-semibold truncate max-w-[100px]">
                                                    {fb.usuario?.nome || 'Anônimo'}
                                                </span>
                                            </div>

                                            {/* Minimalist actions (Hidden se isReadOnly for true) */}
                                            {!isReadOnly && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                     {coluna.id === 'Novo' && (
                                                         <button onClick={() => changeStatus({ id: fb.id, novoStatus: 'Em Análise' })} className="text-gray-400 hover:text-amber-500 p-1 transition-colors" title="Mover para Análise">
                                                             <FontAwesomeIcon icon={faSearch} size="sm" />
                                                         </button>
                                                     )}
                                                     {coluna.id === 'Em Análise' && (
                                                         <>
                                                            <button onClick={() => changeStatus({ id: fb.id, novoStatus: 'Recusado' })} className="text-gray-400 hover:text-red-500 p-1 transition-colors" title="Recusar">
                                                                 <FontAwesomeIcon icon={faTimes} size="sm" />
                                                            </button>
                                                            <button onClick={() => changeStatus({ id: fb.id, novoStatus: 'Implementado' })} className="text-gray-400 hover:text-green-500 p-1 transition-colors" title="Marcar como Implementado">
                                                                 <FontAwesomeIcon icon={faCheck} size="sm" />
                                                            </button>
                                                         </>
                                                     )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {cards.length === 0 && (
                                    <div className="flex items-center justify-center h-full text-sm font-medium text-gray-400 p-4text-center">
                                        Nenhum ticket aqui.
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
