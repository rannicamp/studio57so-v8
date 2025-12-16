'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSave, faSpinner, faArrowRight, faCheckCircle, faTimesCircle, faEdit, faPlay } from '@fortawesome/free-solid-svg-icons'; // Adicionei faPlay
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function EmailRulesConfig() {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Estado do Formulário
    const [formData, setFormData] = useState({
        nome: '',
        condicoes: [{ campo: 'from', operador: 'contains', valor: '' }],
        acoes: [{ tipo: 'move', pasta: 'INBOX' }]
    });

    // Buscar Pastas
    const { data: foldersData } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: async () => {
            const res = await fetch('/api/email/folders');
            if (!res.ok) return { folders: [] };
            return res.json();
        },
        staleTime: 1000 * 60 * 5
    });

    // Buscar Regras
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

    // Salvar Regra
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

    // Excluir Regra
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

    // --- NOVA FUNÇÃO: Executar Regra Agora ---
    const runRuleMutation = useMutation({
        mutationFn: async (ruleId) => {
            const res = await fetch('/api/email/rules/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruleId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao executar regra');
            return data;
        },
        onSuccess: (data) => {
            if (data.matched > 0) {
                toast.success(`Sucesso! ${data.matched} e-mails processados.`);
            } else {
                toast.info("Regra executada, mas nenhum e-mail recente correspondeu.");
            }
        },
        onError: (err) => toast.error(err.message)
    });

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
                    <button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPlus} /> Nova Regra
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto space-y-3 custom-scrollbar">
                    {isLoading ? <div className="text-center text-gray-400 py-4"><FontAwesomeIcon icon={faSpinner} spin /></div> : 
                     regras?.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg">
                            <p className="text-sm">Nenhuma regra criada.</p>
                            <p className="text-xs mt-1">Automatize sua caixa de entrada!</p>
                        </div>
                     ) : (
                        regras.map((regra) => (
                            <div key={regra.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
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
                                    {/* Botão EXECUTAR AGORA */}
                                    <button 
                                        onClick={() => runRuleMutation.mutate(regra.id)} 
                                        disabled={runRuleMutation.isPending}
                                        className="text-gray-400 hover:text-green-600 p-2 border border-transparent hover:border-green-100 rounded transition-all"
                                        title="Executar regra agora nos e-mails recentes"
                                    >
                                        {runRuleMutation.isPending && runRuleMutation.variables === regra.id ? 
                                            <FontAwesomeIcon icon={faSpinner} spin className="text-green-600" /> : 
                                            <FontAwesomeIcon icon={faPlay} />
                                        }
                                    </button>
                                    
                                    <div className="h-4 w-px bg-gray-200 mx-1"></div>

                                    <button onClick={() => handleEdit(regra)} className="text-gray-400 hover:text-blue-600 p-2"><FontAwesomeIcon icon={faEdit} /></button>
                                    <button onClick={() => deleteMutation.mutate(regra.id)} className="text-gray-400 hover:text-red-600 p-2"><FontAwesomeIcon icon={faTrash} /></button>
                                </div>
                            </div>
                        ))
                     )}
                </div>
            </div>
        );
    }

    // Formulário de Edição (Mantém o mesmo código de antes)
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