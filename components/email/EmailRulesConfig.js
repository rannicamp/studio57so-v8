'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSave, faSpinner, faArrowRight, faEdit, faPlay, faStop, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function EmailRulesConfig({ prefillData }) { 
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Estados deep scan
    const [runningRuleId, setRunningRuleId] = useState(null);
    const [progress, setProgress] = useState({ total: 0, current: 0, moved: 0 });
    const [abortController, setAbortController] = useState(null); 

    const [formData, setFormData] = useState({
        nome: '',
        account_id: '', // Importante: Controla qual conta a regra pertence
        condicoes: [{ campo: 'from', operador: 'contains', valor: '' }],
        acoes: [{ tipo: 'move', pasta: '' }] 
    });

    // 1. BUSCAR CONTAS DISPONÍVEIS (Para o Dropdown)
    const { data: accounts } = useQuery({
        queryKey: ['emailAccountsConfig'],
        queryFn: async () => {
            const { data } = await supabase.from('email_configuracoes').select('id, email, conta_apelido').eq('user_id', user.id);
            return data || [];
        }
    });

    // 2. BUSCAR REGRAS (Usando a nova API para garantir que venha o nome da conta)
    const { data: regras, isLoading } = useQuery({
        queryKey: ['emailRules', user?.id],
        queryFn: async () => {
            const res = await fetch('/api/email/rules');
            if (!res.ok) throw new Error('Falha ao carregar regras');
            return res.json();
        },
        enabled: !!user
    });

    // 3. BUSCAR PASTAS DA CONTA SELECIONADA
    // Só busca se o usuário selecionou uma conta no formulário
    const { data: foldersData, isLoading: isLoadingFolders } = useQuery({
        queryKey: ['emailFoldersRule', formData.account_id],
        queryFn: async () => {
            if (!formData.account_id) return { folders: [] };
            const res = await fetch(`/api/email/folders?accountId=${formData.account_id}`);
            if (!res.ok) return { folders: [] };
            return res.json();
        },
        enabled: !!formData.account_id,
        staleTime: 1000 * 60 // Cache de 1 min
    });

    // 4. LÓGICA DE ÁRVORE DE PASTAS (Visual bonito igual Sidebar)
    const processedFolders = useMemo(() => {
        if (!foldersData?.folders || foldersData.folders.length === 0) return [];
        
        const folderList = foldersData.folders;
        const childrenMap = {}; 
        const roots = [];       
        const allPaths = new Set(folderList.map(f => f.path));

        folderList.forEach(folder => {
            const separator = folder.delimiter || '/';
            const lastIndex = folder.path.lastIndexOf(separator);
            const parentPath = lastIndex > -1 ? folder.path.substring(0, lastIndex) : null;
            const parentExists = parentPath && allPaths.has(parentPath);

            if (folder.level === 0 || !parentExists) {
                roots.push(folder);
            } else {
                if (!childrenMap[parentPath]) childrenMap[parentPath] = [];
                childrenMap[parentPath].push(folder);
            }
        });

        const specialOrder = ['INBOX', 'ENTRADA', 'SENT', 'ENVIADOS', 'DRAFTS', 'RASCUNHOS', 'TRASH', 'LIXEIRA', 'JUNK', 'SPAM'];
        
        const sortList = (list) => list.sort((a, b) => {
            const getPriority = (f) => {
                const name = (f.name || '').toUpperCase();
                const display = (f.displayName || '').toUpperCase();
                const byName = specialOrder.findIndex(key => name.includes(key));
                if (byName !== -1) return byName;
                return specialOrder.findIndex(key => display.includes(key));
            };
            const indexA = getPriority(a);
            const indexB = getPriority(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return (a.displayName || a.name).localeCompare(b.displayName || b.name);
        });

        const flattenTree = (list, level = 0) => {
            let result = [];
            const sortedList = sortList(list);
            
            sortedList.forEach(folder => {
                // Cria indentação visual com caracteres invisíveis e símbolos
                const prefix = level > 0 ? '\u00A0\u00A0'.repeat(level) + '└ ' : '';
                const visualName = prefix + (folder.displayName || folder.name);
                
                result.push({ ...folder, visualName, level });
                
                const children = childrenMap[folder.path] || [];
                if (children.length > 0) {
                    result = result.concat(flattenTree(children, level + 1));
                }
            });
            return result;
        };

        return flattenTree(roots);
    }, [foldersData]);

    // Preenchimento automático (ao clicar "Criar Regra" no e-mail)
    useEffect(() => {
        if (prefillData) {
            setFormData({
                nome: prefillData.nome || '',
                // Tenta usar a conta do e-mail selecionado ou a primeira disponível
                account_id: prefillData.account_id || (accounts?.[0]?.id) || '',
                condicoes: prefillData.condicoes || [{ campo: 'from', operador: 'contains', valor: '' }],
                acoes: prefillData.acoes || [{ tipo: 'move', pasta: '' }]
            });
            setEditingId(null); 
            setIsEditing(true); 
        }
    }, [prefillData, accounts]);

    // --- MUTAÇÕES ---
    const mutation = useMutation({
        mutationFn: async (data) => {
            // Usa a API que criamos no passo 1
            const res = await fetch('/api/email/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    ...data,
                    // Garante que a ordem seja mantida se for novo
                    ordem: editingId ? undefined : (regras?.length || 0) + 1
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Erro ao salvar regra');
            return result;
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
            const res = await fetch(`/api/email/rules?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao excluir');
            }
        },
        onSuccess: () => {
            toast.success("Regra excluída.");
            queryClient.invalidateQueries(['emailRules']);
        }
    });

    // --- DEEP SCAN ---
    const runDeepScan = async (ruleId) => {
        setRunningRuleId(ruleId);
        setProgress({ total: 0, current: 0, moved: 0 });
        const controller = new AbortController();
        setAbortController(controller);
        let cursor = 0; 
        let done = false;
        let totalMoved = 0;

        try {
            toast.info("Iniciando varredura...");
            while (!done && !controller.signal.aborted) {
                const res = await fetch('/api/email/rules/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ruleId, cursor, limit: 50 }), 
                    signal: controller.signal
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro');
                
                totalMoved += data.moved;
                cursor = data.nextCursor;
                done = data.done;

                setProgress({ total: data.totalMessages, current: cursor, moved: totalMoved });
            }
            if (!controller.signal.aborted) toast.success(`Concluído! ${totalMoved} e-mails movidos.`);
        } catch (error) {
            if (error.name !== 'AbortError') toast.error("Erro: " + error.message);
        } finally {
            setRunningRuleId(null);
            setAbortController(null);
        }
    };

    const stopDeepScan = () => { if (abortController) abortController.abort(); };

    const resetForm = () => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
            nome: '',
            account_id: accounts?.[0]?.id || '',
            condicoes: [{ campo: 'from', operador: 'contains', valor: '' }],
            acoes: [{ tipo: 'move', pasta: '' }]
        });
    };

    const handleEdit = (regra) => {
        setFormData({
            nome: regra.nome,
            account_id: regra.account_id || accounts?.[0]?.id || '', // Se for null (antiga), sugere a primeira conta
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

    // --- MODO LISTA (VISUALIZAÇÃO) ---
    if (!isEditing) {
        return (
            <div className="space-y-4 animate-fade-in h-full flex flex-col">
                <div className="flex justify-between items-center pb-4 border-b">
                    <h3 className="text-sm font-bold text-gray-700">Minhas Regras</h3>
                    <button onClick={() => setIsEditing(true)} disabled={!!runningRuleId} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
                        <FontAwesomeIcon icon={faPlus} /> Nova Regra
                    </button>
                </div>

                {runningRuleId && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 animate-slide-down shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-blue-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faSpinner} spin /> Processando...
                            </span>
                            <span className="text-xs font-semibold text-blue-600">
                                Movidos: {progress.moved}
                            </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mb-2 overflow-hidden">
                            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0}%` }}></div>
                        </div>
                        <button onClick={stopDeepScan} className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1"><FontAwesomeIcon icon={faStop} /> Cancelar</button>
                    </div>
                )}

                <div className="flex-grow overflow-y-auto space-y-3 custom-scrollbar">
                    {isLoading ? <div className="text-center text-gray-400 py-4"><FontAwesomeIcon icon={faSpinner} spin /></div> : 
                     regras?.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg"><p className="text-sm">Nenhuma regra criada.</p></div>
                     ) : (
                        regras.map((regra) => {
                            // Verifica se a regra é "Órfã" (antiga, sem conta vinculada)
                            const contaNome = regra.email_configuracoes 
                                ? (regra.email_configuracoes.conta_apelido || regra.email_configuracoes.email) 
                                : 'Regra Antiga / Todas';

                            return (
                                <div key={regra.id} className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group ${runningRuleId === regra.id ? 'ring-2 ring-blue-400' : ''}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${regra.ativo ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                            <h4 className="font-bold text-gray-800 text-sm">{regra.nome}</h4>
                                            {!regra.account_id && (
                                                <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded border border-orange-200" title="Esta regra foi criada antes da atualização de multi-contas. Edite-a para vincular a uma conta específica.">
                                                    <FontAwesomeIcon icon={faExclamationTriangle} /> Atualizar
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-gray-600">
                                                {contaNome}
                                            </span>
                                            • {regra.condicoes.length} condições &#8594; {regra.acoes.length} ações
                                        </p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <button onClick={() => runDeepScan(regra.id)} disabled={!!runningRuleId} className="text-gray-400 hover:text-green-600 p-2 border border-transparent hover:border-green-100 rounded transition-all disabled:opacity-30" title="Executar regra agora">
                                            {runningRuleId === regra.id ? <FontAwesomeIcon icon={faSpinner} spin className="text-green-600" /> : <FontAwesomeIcon icon={faPlay} />}
                                        </button>
                                        <div className="h-4 w-px bg-gray-200 mx-1"></div>
                                        <button onClick={() => handleEdit(regra)} disabled={!!runningRuleId} className="text-gray-400 hover:text-blue-600 p-2 disabled:opacity-30"><FontAwesomeIcon icon={faEdit} /></button>
                                        <button onClick={() => deleteMutation.mutate(regra.id)} disabled={!!runningRuleId} className="text-gray-400 hover:text-red-600 p-2 disabled:opacity-30"><FontAwesomeIcon icon={faTrash} /></button>
                                    </div>
                                </div>
                            );
                        })
                     )}
                </div>
            </div>
        );
    }

    // --- MODO EDIÇÃO (FORMULÁRIO) ---
    return (
        <div className="space-y-6 animate-fade-in pb-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-gray-700">{editingId ? 'Editar Regra' : 'Criar Nova Regra'}</h3>
                <button onClick={resetForm} className="text-xs text-gray-500 hover:underline">Cancelar</button>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Regra</label>
                        <input type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full border rounded-md p-2 text-sm" placeholder="Ex: Mover Notas Fiscais" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Aplicar na Conta</label>
                        <select 
                            value={formData.account_id} 
                            onChange={e => {
                                // Ao mudar a conta, limpamos a pasta selecionada para evitar erros de ID
                                const newActs = [...formData.acoes].map(a => a.tipo === 'move' ? { ...a, pasta: '' } : a);
                                setFormData({...formData, account_id: e.target.value, acoes: newActs});
                            }}
                            className="w-full border rounded-md p-2 text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="" disabled>Selecione...</option>
                            {accounts?.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.conta_apelido || acc.email}</option>
                            ))}
                        </select>
                        {!formData.account_id && (
                            <p className="text-[10px] text-red-500 mt-1">* Obrigatório selecionar uma conta</p>
                        )}
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                    <p className="text-xs font-bold text-blue-800 uppercase">SE (Condições)</p>
                    {formData.condicoes.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <select value={cond.campo} onChange={e => updateCondition(idx, 'campo', e.target.value)} className="w-1/4 text-xs p-2 border rounded bg-white">
                                <option value="from">Remetente</option>
                                <option value="subject">Assunto</option>
                                <option value="to">Para</option>
                            </select>
                            <select value={cond.operador} onChange={e => updateCondition(idx, 'operador', e.target.value)} className="w-1/4 text-xs p-2 border rounded bg-white">
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

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-3">
                    <p className="text-xs font-bold text-orange-800 uppercase">ENTÃO (Ações)</p>
                    {formData.acoes.map((acao, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <select value={acao.tipo} onChange={e => updateAction(idx, 'tipo', e.target.value)} className="w-1/3 text-xs p-2 border rounded bg-white">
                                <option value="move">Mover para</option>
                                <option value="markRead">Marcar como Lido</option>
                                <option value="delete">Excluir</option>
                            </select>
                            
                            {acao.tipo === 'move' && (
                                <div className="flex-grow relative">
                                    <select 
                                        value={acao.pasta} 
                                        onChange={e => updateAction(idx, 'pasta', e.target.value)} 
                                        className="w-full text-xs p-2 border rounded bg-white appearance-none"
                                        disabled={!formData.account_id || isLoadingFolders}
                                    >
                                        <option value="">
                                            {!formData.account_id ? 'Selecione uma conta acima primeiro' : 
                                             isLoadingFolders ? 'Carregando pastas...' : 
                                             'Selecione a pasta...'}
                                        </option>
                                        {processedFolders.map(f => (
                                            <option key={f.path} value={f.path}>
                                                {f.visualName}
                                            </option>
                                        ))}
                                    </select>
                                    {isLoadingFolders && (
                                        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                            <FontAwesomeIcon icon={faSpinner} spin />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-4 flex justify-end gap-2">
                    <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
                    <button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending || !formData.nome || !formData.account_id} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50">
                        {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        Salvar Regra
                    </button>
                </div>
            </div>
        </div>
    );
}