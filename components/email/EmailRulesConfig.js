'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSave, faSpinner, faArrowRight, faEdit, faPlay, faStop } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function EmailRulesConfig() {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Estados para o Deep Scan (Execução da Regra)
    const [runningRuleId, setRunningRuleId] = useState(null);
    const [progress, setProgress] = useState({ total: 0, current: 0, moved: 0 });
    const [abortController, setAbortController] = useState(null); // Para cancelar se precisar

    const [formData, setFormData] = useState({
        nome: '',
        condicoes: [{ campo: 'from', operador: 'contains', valor: '' }],
        acoes: [{ tipo: 'move', pasta: 'INBOX' }]
    });

    const { data: foldersData } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: async () => {
            const res = await fetch('/api/email/folders');
            if (!res.ok) return { folders: [] };
            return res.json();
        },
        staleTime: 1000 * 60 * 5
    });

    const { data: regras, isLoading } = useQuery({
        queryKey: ['emailRules', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('email_regras')
                .select('*')
                .eq('user_id', user.id)
                .order('ordem', { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!user
    });

    const mutation = useMutation({
        mutationFn: async (data) => {
            const orgId = organizacao_id ? parseInt(organizacao_id) : null;
            const payload = {
                user_id: user.id,
                organizacao_id: orgId,
                nome: data.nome,
                condicoes: data.condicoes,
                acoes: data.acoes,
                ...(editingId ? {} : { ordem: (regras?.length || 0) + 1 })
            };
            
            let result;
            if (editingId) {
                result = await supabase.from('email_regras').update(payload).eq('id', editingId);
            } else {
                result = await supabase.from('email_regras').insert(payload);
            }
            if (result.error) throw new Error(result.error.message);
        },
        onSuccess: () => {
            toast.success(editingId ? "Regra atualizada!" : "Regra criada com sucesso!");
            queryClient.invalidateQueries(['emailRules']);
            resetForm();
        },
        onError: (err) => toast.error(`Erro: ${err.message}`)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('email_regras').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Regra excluída.");
            queryClient.invalidateQueries(['emailRules']);
        }
    });

    // --- LÓGICA DO DEEP SCAN (Loop Recursivo) ---
    const runDeepScan = async (ruleId) => {
        setRunningRuleId(ruleId);
        setProgress({ total: 0, current: 0, moved: 0 });
        
        // Controller para permitir cancelar o loop
        const controller = new AbortController();
        setAbortController(controller);

        let cursor = null; // null significa "começar do topo"
        let done = false;
        let totalMoved = 0;
        let totalScanned = 0;

        try {
            toast.info("Iniciando varredura completa da caixa de entrada...");

            while (!done && !controller.signal.aborted) {
                const res = await fetch('/api/email/rules/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ruleId, cursor, limit: 100 }), // Lotes de 100
                    signal: controller.signal
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.error || 'Erro na execução');

                // Atualiza contadores
                totalMoved += data.moved;
                totalScanned += data.matched; // matched aqui é quantos foram lidos no lote
                
                // Na primeira rodada, definimos o total baseado na resposta da API
                // Depois apenas incrementamos o que foi lido
                // Usamos o 'totalMessages' da API para estimativa visual
                const estimatedTotal = data.totalMessages;
                
                // Atualiza Cursor e Estado de loop
                cursor = data.nextCursor;
                done = data.done;

                // Atualiza UI
                setProgress({ 
                    total: estimatedTotal, 
                    current: estimatedTotal - (cursor || 0), // Onde estamos (aproximado)
                    moved: totalMoved 
                });
            }

            if (!controller.signal.aborted) {
                toast.success(`Varredura concluída! ${totalMoved} e-mails processados/movidos.`);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                toast.warning("Execução cancelada pelo usuário.");
            } else {
                console.error(error);
                toast.error("Erro na execução: " + error.message);
            }
        } finally {
            setRunningRuleId(null);
            setAbortController(null);
        }
    };

    const stopDeepScan = () => {
        if (abortController) {
            abortController.abort();
        }
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
            nome: '',
            condicoes: [{ campo: 'from', operador: 'contains', valor: '' }],
            acoes: [{ tipo: 'move', pasta: 'INBOX' }]
        });
    };

    const handleEdit = (regra) => {
        setFormData({
            nome: regra.nome,
            condicoes: regra.condicoes,
            acoes: regra.acoes
        });
        setEditingId(regra.id);
        setIsEditing(true);
    };

    // (Funções updateCondition e updateAction mantidas iguais)
    const updateCondition = (index, field, value) => {
        const newCond = [...formData.condicoes];
        newCond[index][field] = value;
        setFormData({ ...formData, condicoes: newCond });
    };
    const addCondition = () => setFormData({ ...formData, condicoes: [...formData.condicoes, { campo: 'subject', operador: 'contains', valor: '' }] });
    const removeCondition = (index) => {
        if (formData.condicoes.length === 1) return;
        const newCond = formData.condicoes.filter((_, i) => i !== index);
        setFormData({ ...formData, condicoes: newCond });
    };
    const updateAction = (index, field, value) => {
        const newActs = [...formData.acoes];
        newActs[index][field] = value;
        setFormData({ ...formData, acoes: newActs });
    };

    if (!isEditing) {
        return (
            <div className="space-y-4 animate-fade-in h-full flex flex-col">
                <div className="flex justify-between items-center pb-4 border-b">
                    <h3 className="text-sm font-bold text-gray-700">Minhas Regras</h3>
                    <button onClick={() => setIsEditing(true)} disabled={!!runningRuleId} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
                        <FontAwesomeIcon icon={faPlus} /> Nova Regra
                    </button>
                </div>

                {/* BARRA DE PROGRESSO GLOBAL (Aparece quando roda uma regra) */}
                {runningRuleId && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 animate-slide-down shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-blue-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faSpinner} spin /> 
                                Processando caixa de entrada...
                            </span>
                            <span className="text-xs font-semibold text-blue-600">
                                {progress.current} / {progress.total} verificados
                            </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mb-2 overflow-hidden">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500">
                                Ações aplicadas: <strong>{progress.moved}</strong>
                            </span>
                            <button onClick={stopDeepScan} className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1">
                                <FontAwesomeIcon icon={faStop} /> Cancelar
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-grow overflow-y-auto space-y-3 custom-scrollbar">
                    {isLoading ? <div className="text-center text-gray-400 py-4"><FontAwesomeIcon icon={faSpinner} spin /></div> : 
                     regras?.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg">
                            <p className="text-sm">Nenhuma regra criada.</p>
                        </div>
                     ) : (
                        regras.map((regra) => (
                            <div key={regra.id} className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group ${runningRuleId === regra.id ? 'ring-2 ring-blue-400' : ''}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${regra.ativo ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                        <h4 className="font-bold text-gray-800 text-sm">{regra.nome}</h4>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {regra.condicoes.length} condições &#8594; {regra.acoes.length} ações
                                    </p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {/* Botão EXECUTAR DEEP SCAN */}
                                    <button 
                                        onClick={() => runDeepScan(regra.id)} 
                                        disabled={!!runningRuleId}
                                        className="text-gray-400 hover:text-green-600 p-2 border border-transparent hover:border-green-100 rounded transition-all disabled:opacity-30"
                                        title="Executar regra em TODA a caixa de entrada"
                                    >
                                        {runningRuleId === regra.id ? 
                                            <FontAwesomeIcon icon={faSpinner} spin className="text-green-600" /> : 
                                            <FontAwesomeIcon icon={faPlay} />
                                        }
                                    </button>
                                    
                                    <div className="h-4 w-px bg-gray-200 mx-1"></div>

                                    <button onClick={() => handleEdit(regra)} disabled={!!runningRuleId} className="text-gray-400 hover:text-blue-600 p-2 disabled:opacity-30"><FontAwesomeIcon icon={faEdit} /></button>
                                    <button onClick={() => deleteMutation.mutate(regra.id)} disabled={!!runningRuleId} className="text-gray-400 hover:text-red-600 p-2 disabled:opacity-30"><FontAwesomeIcon icon={faTrash} /></button>
                                </div>
                            </div>
                        ))
                     )}
                </div>
            </div>
        );
    }

    // (Retorna o JSX do Formulário de Edição igualzinho ao anterior)
    return (
        <div className="space-y-6 animate-fade-in pb-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-gray-700">{editingId ? 'Editar Regra' : 'Criar Nova Regra'}</h3>
                <button onClick={resetForm} className="text-xs text-gray-500 hover:underline">Cancelar</button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Regra</label>
                    <input type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full border rounded-md p-2 text-sm" placeholder="Ex: Mover Notas Fiscais" />
                </div>

                {/* CONDIÇÕES */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                    <p className="text-xs font-bold text-blue-800 uppercase">SE (Condições)</p>
                    {formData.condicoes.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <select value={cond.campo} onChange={e => updateCondition(idx, 'campo', e.target.value)} className="w-1/4 text-xs p-2 border rounded">
                                <option value="from">Remetente</option>
                                <option value="subject">Assunto</option>
                            </select>
                            <select value={cond.operador} onChange={e => updateCondition(idx, 'operador', e.target.value)} className="w-1/4 text-xs p-2 border rounded">
                                <option value="contains">Contém</option>
                                <option value="not_contains">Não Contém</option>
                                <option value="equals">É igual a</option>
                            </select>
                            <input type="text" value={cond.valor} onChange={e => updateCondition(idx, 'valor', e.target.value)} className="flex-grow text-xs p-2 border rounded" placeholder="Valor..." />
                            <button onClick={() => removeCondition(idx)} className="text-red-400 hover:text-red-600 px-2"><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                    ))}
                    <button onClick={addCondition} className="text-xs text-blue-600 font-bold hover:underline">+ Adicionar Condição</button>
                </div>

                <div className="flex justify-center"><FontAwesomeIcon icon={faArrowRight} className="text-gray-300 text-xl" /></div>

                {/* AÇÕES */}
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-3">
                    <p className="text-xs font-bold text-orange-800 uppercase">ENTÃO (Ações)</p>
                    {formData.acoes.map((acao, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <select value={acao.tipo} onChange={e => updateAction(idx, 'tipo', e.target.value)} className="w-1/3 text-xs p-2 border rounded">
                                <option value="move">Mover para</option>
                                <option value="markRead">Marcar como Lido</option>
                                <option value="delete">Excluir</option>
                            </select>
                            
                            {acao.tipo === 'move' && (
                                <select value={acao.pasta} onChange={e => updateAction(idx, 'pasta', e.target.value)} className="flex-grow text-xs p-2 border rounded">
                                    <option value="">Selecione a pasta...</option>
                                    {foldersData?.folders?.map(f => (
                                        <option key={f.path} value={f.path}>{f.displayName || f.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-4 flex justify-end gap-2">
                    <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
                    <button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending || !formData.nome} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50">
                        {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        Salvar Regra
                    </button>
                </div>
            </div>
        </div>
    );
}