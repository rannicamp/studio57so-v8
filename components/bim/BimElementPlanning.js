'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client'; // Ajustei o caminho para @ (padrão Next.js)
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faLink, faUnlink, faCalendarAlt, 
    faTasks, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimElementPlanning({ 
    elementExternalId, 
    projetoBimId, 
    elementName,
    onOpenLink, 
    onOpenCreate 
}) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth(); // Geralmente o ID da organização está nos metadados do usuário
    
    // Recupera o ID da organização (tenta direto ou via metadata)
    const organizacaoId = user?.user_metadata?.organizacao_id || user?.organizacao_id;

    // 1. Busca Atividades Vinculadas a este Elemento
    const { data: vinculos = [], isLoading } = useQuery({
        queryKey: ['bimElementLinks', elementExternalId, projetoBimId],
        queryFn: async () => {
            if (!elementExternalId || !projetoBimId || !organizacaoId) return [];

            const { data, error } = await supabase
                .from('atividades_elementos') // Tabela correta (Link)
                .select(`
                    id,
                    atividade:activities (   
                        id, nome, status, data_inicio_prevista, data_fim_prevista
                    )
                `)
                .eq('projeto_bim_id', projetoBimId)
                .eq('external_id', elementExternalId)
                .eq('organizacao_id', organizacaoId);

            if (error) {
                console.error("Erro ao buscar vínculos:", error);
                throw error;
            }
            return data || [];
        },
        // Só executa se tiver todos os IDs necessários
        enabled: !!elementExternalId && !!projetoBimId && !!organizacaoId
    });

    // 2. Função para Desvincular
    const { mutate: desvincular, isPending: isUnlinking } = useMutation({
        mutationFn: async (vinculoId) => {
            const { error } = await supabase
                .from('atividades_elementos')
                .delete()
                .eq('id', vinculoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Atividade desvinculada!");
            queryClient.invalidateQueries(['bimElementLinks']);
            // Opcional: Atualizar gráfico de Gantt se necessário
            queryClient.invalidateQueries(['bimActivities']); 
        },
        onError: (err) => toast.error("Erro ao desvincular: " + err.message)
    });

    // --- HANDLERS SEGUROS ---
    const handleLink = () => {
        console.log("🔗 Tentando abrir modal de vínculo para:", elementExternalId);
        if (onOpenLink) {
            onOpenLink({
                externalId: elementExternalId,
                projetoBimId: projetoBimId,
                elementName: elementName
            });
        } else {
            console.error("❌ Função onOpenLink não foi passada para o componente!");
        }
    };

    const handleCreate = () => {
        if (onOpenCreate) {
            onOpenCreate({
                externalId: elementExternalId,
                projetoBimId: projetoBimId,
                elementName: elementName
            });
        }
    };
    // ---------------------------------------------------------------------

    const getStatusColor = (status) => {
        // Normaliza para minúsculas para evitar erros de digitação
        const s = String(status || '').toLowerCase();
        
        if (s.includes('conclu') || s.includes('execut')) return 'bg-green-100 text-green-700 border-green-200';
        if (s.includes('anda') || s.includes('inici')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (s.includes('atras') || s.includes('bloq')) return 'bg-red-100 text-red-700 border-red-200';
        
        return 'bg-gray-100 text-gray-600 border-gray-200';
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            {/* Header Interno */}
            <div className="p-4 border-b bg-white">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Elemento</h4>
                <p className="text-xs font-bold text-gray-800 break-all" title={elementName}>
                    {elementName || elementExternalId || 'Sem seleção'}
                </p>
            </div>

            {/* Botões de Ação */}
            <div className="p-3 grid grid-cols-2 gap-2 bg-white border-b shadow-sm z-10">
                <button 
                    onClick={handleLink}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-all group"
                >
                    <FontAwesomeIcon icon={faLink} className="mb-1 text-sm group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-bold uppercase">Vincular</span>
                </button>
                <button 
                    onClick={handleCreate}
                    className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-green-200 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-300 transition-all group"
                >
                    <FontAwesomeIcon icon={faPlus} className="mb-1 text-sm group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-bold uppercase">Criar Nova</span>
                </button>
            </div>

            {/* Lista de Atividades */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center py-10 text-blue-500"><FontAwesomeIcon icon={faSpinner} spin /></div>
                ) : vinculos.length > 0 ? (
                    vinculos.map((v) => {
                        // Verifica se o objeto atividade veio corretamente do JOIN
                        const act = v.atividade;
                        if (!act) return null;

                        return (
                            <div key={v.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusColor(act.status).split(' ')[0].replace('100', '500')}`} />
                                <div className="pl-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <h5 className="font-bold text-xs text-gray-800 leading-tight line-clamp-2">{act.nome}</h5>
                                        <button 
                                            onClick={() => { if(confirm("Desvincular atividade?")) desvincular(v.id) }}
                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                            title="Desvincular"
                                            disabled={isUnlinking}
                                        >
                                            <FontAwesomeIcon icon={faUnlink} className="text-[10px]" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${getStatusColor(act.status)}`}>
                                            {act.status || 'Não Iniciado'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] text-gray-400">
                                        <FontAwesomeIcon icon={faCalendarAlt} />
                                        <span>
                                            {act.data_inicio_prevista ? new Date(act.data_inicio_prevista).toLocaleDateString('pt-BR') : 'S/D'} 
                                            {' -> '} 
                                            {act.data_fim_prevista ? new Date(act.data_fim_prevista).toLocaleDateString('pt-BR') : 'S/D'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-center text-gray-400 opacity-60">
                        <FontAwesomeIcon icon={faTasks} className="text-2xl mb-2" />
                        <p className="text-[10px] font-medium">Nenhuma atividade vinculada.</p>
                    </div>
                )}
            </div>
        </div>
    );
}