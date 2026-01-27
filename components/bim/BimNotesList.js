// Caminho: components/bim/BimNotesList.js
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationCircle, faCamera } from '@fortawesome/free-solid-svg-icons';

export default function BimNotesList({ onSelectNote }) {
    const supabase = createClient();
    const { organizacao_id } = useAuth();

    const { data: notes = [], isLoading } = useQuery({
        queryKey: ['bimNotes', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];
            
            // Query simplificada para evitar erros de join por enquanto
            const { data, error } = await supabase
                .from('bim_notas')
                .select(`
                    id, 
                    titulo, 
                    descricao, 
                    status, 
                    prioridade, 
                    snapshot, 
                    camera_state,
                    elemento_vinculado_id
                `)
                .eq('organizacao_id', organizacao_id)
                .order('criado_em', { ascending: false });
            
            if (error) {
                console.error("Erro ao buscar notas:", error);
                throw error;
            }
            return data;
        },
        enabled: !!organizacao_id
    });

    if (isLoading) return <div className="p-8 text-center text-gray-400 text-xs"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>;

    if (notes.length === 0) return (
        <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
            <FontAwesomeIcon icon={faCamera} className="text-2xl opacity-20" />
            <p className="text-xs">Nenhuma nota criada.</p>
        </div>
    );

    return (
        <div className="p-2 space-y-2">
            {notes.map(note => (
                <div 
                    key={note.id} 
                    onClick={() => onSelectNote && onSelectNote(note)}
                    className="bg-white border border-gray-100 rounded-lg p-3 hover:shadow-md hover:border-purple-200 cursor-pointer transition-all group"
                >
                    <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 bg-gray-100 rounded-md shrink-0 overflow-hidden border border-gray-200 mt-1">
                            {note.snapshot ? (
                                <img src={note.snapshot} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="Vista" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300"><FontAwesomeIcon icon={faCamera} className="text-[10px]" /></div>
                            )}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h4 className="text-[11px] font-bold text-gray-800 truncate pr-2">{note.titulo}</h4>
                                <span className={`text-[8px] px-1.5 rounded-full font-bold uppercase ${
                                    note.status === 'aberta' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                }`}>
                                    {note.status}
                                </span>
                            </div>
                            
                            <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{note.descricao || 'Sem descrição.'}</p>
                            
                            <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-400">
                                <span className={`flex items-center gap-1 ${note.prioridade === 'critica' ? 'text-red-500 font-bold' : ''}`}>
                                    <FontAwesomeIcon icon={faExclamationCircle} /> {note.prioridade}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}