// Caminho: components/bim/BimNotesList.js
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faExclamationCircle, faCamera, 
    faUser, faClock, faMapMarkerAlt 
} from '@fortawesome/free-solid-svg-icons';

// Função auxiliar para data relativa
function timeAgo(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " anos atrás";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses atrás";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " dias atrás";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h atrás";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m atrás";
    return "agora mesmo";
}

export default function BimNotesList({ onSelectNote }) {
    const supabase = createClient();
    const { organizacao_id } = useAuth();

    const { data: notes = [], isLoading } = useQuery({
        queryKey: ['bimNotes', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];
            
            // AGORA SIM: Buscando dados da tabela 'usuarios' corretamente
            const { data, error } = await supabase
                .from('bim_notas')
                .select(`
                    *,
                    usuario:usuarios (
                        nome,
                        sobrenome,
                        avatar_url,
                        email
                    ),
                    atividade:activities(nome)
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

    if (isLoading) return <div className="p-8 text-center text-gray-400 text-xs"><FontAwesomeIcon icon={faSpinner} spin /> Carregando feed...</div>;

    if (notes.length === 0) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-300">
            <div className="bg-gray-50 p-4 rounded-full mb-3">
                <FontAwesomeIcon icon={faCamera} className="text-2xl" />
            </div>
            <p className="text-sm font-medium text-gray-400">Nenhuma nota registrada</p>
        </div>
    );

    return (
        <div className="p-3 space-y-4 bg-gray-50/50 min-h-full">
            {notes.map(note => {
                // Lógica de fallback para dados do usuário
                const userObj = note.usuario || {};
                const fullName = userObj.nome ? `${userObj.nome} ${userObj.sobrenome || ''}` : "Usuário";
                const avatarUrl = userObj.avatar_url;
                const email = userObj.email || "";
                
                // Iniciais para avatar se não tiver foto
                const initials = userObj.nome 
                    ? userObj.nome.substring(0, 1).toUpperCase() 
                    : (email.substring(0, 2).toUpperCase() || "U");

                return (
                    <div 
                        key={note.id} 
                        onClick={() => onSelectNote && onSelectNote(note)}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all overflow-hidden group"
                    >
                        {/* --- CABEÇALHO DO CARD (Usuário Real) --- */}
                        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50 bg-white">
                            <div className="flex items-center gap-3">
                                {/* Avatar: Foto ou Iniciais */}
                                <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden border border-gray-100 shadow-sm">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold">
                                            {initials}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[120px]">
                                        {fullName}
                                    </span>
                                    <span className="text-[9px] text-gray-400 flex items-center gap-1">
                                        <FontAwesomeIcon icon={faClock} className="text-[8px]" /> {timeAgo(note.criado_em)}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Status Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                note.status === 'aberta' 
                                    ? 'bg-red-50 text-red-600 border border-red-100' 
                                    : 'bg-green-50 text-green-600 border border-green-100'
                            }`}>
                                {note.status}
                            </span>
                        </div>

                        {/* --- CORPO DO CARD --- */}
                        <div className="p-4 pt-3">
                            <h4 className="text-sm font-bold text-gray-800 mb-1 leading-snug group-hover:text-purple-600 transition-colors">
                                {note.titulo}
                            </h4>
                            
                            {note.descricao && (
                                <p className="text-xs text-gray-500 mb-3 line-clamp-3 leading-relaxed">
                                    {note.descricao}
                                </p>
                            )}

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {note.prioridade === 'critica' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-[9px] font-bold">
                                        <FontAwesomeIcon icon={faExclamationCircle} /> Crítica
                                    </span>
                                )}
                                {note.atividade && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-[9px] font-medium border border-blue-100 max-w-full truncate">
                                        <FontAwesomeIcon icon={faMapMarkerAlt} /> {note.atividade.nome}
                                    </span>
                                )}
                            </div>

                            {/* Snapshot Grande */}
                            {note.snapshot && (
                                <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative group-hover:border-purple-200 transition-colors mt-2">
                                    <img 
                                        src={note.snapshot} 
                                        alt="Vista do modelo" 
                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out" 
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm transition-all transform translate-y-2 group-hover:translate-y-0">
                                            <FontAwesomeIcon icon={faCamera} className="mr-1" /> Ver no Modelo
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}