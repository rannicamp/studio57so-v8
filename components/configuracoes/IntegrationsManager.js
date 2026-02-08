"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faKey, faSave, faLink, faUnlink, faBuildingColumns } from '@fortawesome/free-solid-svg-icons';
import { faFacebook } from '@fortawesome/free-brands-svg-icons';
import { useSession, signIn, signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePersistentState } from '../../hooks/usePersistentState'; // <--- IMPORTAMOS O SEU HOOK LINDO AQUI

export default function IntegrationsManager({ empresas, initialConfigs, organizacaoId }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: session, status } = useSession();

    // Estado local para controle de seleção de empresa (WhatsApp)
    const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
    const [whatsappFormData, setWhatsappFormData] = useState({});
    
    // --- ATUALIZAÇÃO: PERSISTÊNCIA MÁGICA ---
    // Usamos usePersistentState com uma chave única para não perder os dados se a página atualizar
    const [belvoFormData, setBelvoFormData] = usePersistentState('belvo_config_draft', {
        secret_id: '',
        secret_password: '',
        environment: 'sandbox'
    });

    // Ref para controlar se já sincronizamos com o banco pelo menos uma vez
    const hasSyncedRef = useRef(false);

    // --- 1. GESTÃO DE DADOS (WhatsApp) ---
    useEffect(() => {
        if (selectedEmpresaId) {
            const existingConfig = initialConfigs?.find(c => c.empresa_id == selectedEmpresaId);
            setWhatsappFormData(existingConfig || { empresa_id: selectedEmpresaId });
        } else {
            setWhatsappFormData({});
        }
    }, [selectedEmpresaId, initialConfigs]);

    useEffect(() => {
        if (empresas && empresas.length === 1 && !selectedEmpresaId) {
            setSelectedEmpresaId(empresas[0].id);
        }
    }, [empresas, selectedEmpresaId]);

    const saveWhatsappMutation = useMutation({
        mutationFn: async (dataToSave) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            delete dataToSave.id; 
            const { data, error } = await supabase
                .from('configuracoes_whatsapp')
                .upsert({ ...dataToSave, organizacao_id: organizacaoId }, { onConflict: 'empresa_id' })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success('Configurações do WhatsApp salvas com sucesso!');
        },
        onError: (err) => {
            toast.error(`Erro ao salvar WhatsApp: ${err.message}`);
        }
    });

    // --- 2. GESTÃO DE DADOS (Belvo) ---
    
    const { data: belvoConfig, isLoading: loadingBelvoData } = useQuery({
        queryKey: ['belvoConfig', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return null;
            const { data, error } = await supabase
                .from('configuracoes_belvo')
                .select('*')
                .eq('organizacao_id', organizacaoId)
                .single();
            
            if (error && error.code !== 'PGRST116') { 
                console.error('Erro ao buscar Belvo:', error);
            }
            return data || null;
        },
        enabled: !!organizacaoId, 
    });

    // LÓGICA DE SINCRONIZAÇÃO INTELIGENTE
    useEffect(() => {
        // Só rodamos se tivermos dados do banco E se ainda não tivermos sincronizado
        if (belvoConfig && !hasSyncedRef.current) {
            // Verificamos se o rascunho local está "vazio" (sem dados importantes)
            const isDraftEmpty = !belvoFormData.secret_id && !belvoFormData.secret_password;
            
            // Se o rascunho estiver vazio, carregamos do banco.
            // Se o usuário já tiver digitado algo (rascunho), MANTEMOS O QUE ELE DIGITOU (prioridade ao local).
            if (isDraftEmpty) {
                setBelvoFormData({
                    secret_id: belvoConfig.secret_id || '',
                    secret_password: belvoConfig.secret_password || '',
                    environment: belvoConfig.environment || 'sandbox'
                });
            }
            
            // Marcamos como sincronizado para não sobrescrever mais o que o usuário digitar
            hasSyncedRef.current = true;
        }
    }, [belvoConfig, belvoFormData, setBelvoFormData]);

    const saveBelvoMutation = useMutation({
        mutationFn: async (dataToSave) => {
            if (!organizacaoId) throw new Error("Organização não identificada. Recarregue a página.");

            const payload = {
                organizacao_id: organizacaoId,
                secret_id: dataToSave.secret_id,
                secret_password: dataToSave.secret_password,
                environment: dataToSave.environment
            };

            const { data, error } = await supabase
                .from('configuracoes_belvo')
                .upsert(payload, { onConflict: 'organizacao_id' })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success('Credenciais da Belvo salvas com sucesso!');
            queryClient.invalidateQueries(['belvoConfig']);
            // Opcional: Limpar o rascunho ou atualizar com os dados retornados
            // Mas manter os dados no form é bom UX.
        },
        onError: (err) => {
            toast.error(`Erro ao salvar Belvo: ${err.message}`);
        }
    });

    const handleWhatsappChange = (e) => {
        const { name, value } = e.target;
        setWhatsappFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBelvoChange = (e) => {
        const { name, value } = e.target;
        setBelvoFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveWhatsapp = (e) => {
        e.preventDefault();
        if (!selectedEmpresaId) return toast.error("Selecione uma empresa.");
        saveWhatsappMutation.mutate({ ...whatsappFormData, empresa_id: selectedEmpresaId });
    };

    const handleSaveBelvo = (e) => {
        e.preventDefault();
        saveBelvoMutation.mutate(belvoFormData);
    };

    return (
        <div className="space-y-8 pb-10">
            {/* --- SEÇÃO 1: WHATSAPP --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faKey} className="text-green-600" />
                    API do WhatsApp (Meta)
                </h2>
                <form onSubmit={handleSaveWhatsapp} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Selecione a Empresa</label>
                        <select 
                            onChange={(e) => setSelectedEmpresaId(e.target.value)} 
                            value={selectedEmpresaId} 
                            className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            <option value="">-- Escolha uma empresa --</option>
                            {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.razao_social}</option>)}
                        </select>
                    </div>
                    
                    {selectedEmpresaId && (
                        <div className="space-y-4 pt-4 border-t animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600">Phone Number ID</label>
                                    <input type="text" name="whatsapp_phone_number_id" value={whatsappFormData.whatsapp_phone_number_id || ''} onChange={handleWhatsappChange} className="mt-1 w-full p-2 border rounded-md" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600">Business Account ID</label>
                                    <input type="text" name="whatsapp_business_account_id" value={whatsappFormData.whatsapp_business_account_id || ''} onChange={handleWhatsappChange} className="mt-1 w-full p-2 border rounded-md" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Token de Acesso Permanente</label>
                                <input type="password" name="whatsapp_permanent_token" value={whatsappFormData.whatsapp_permanent_token || ''} onChange={handleWhatsappChange} className="mt-1 w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Token de Verificação (Webhook)</label>
                                <input type="text" name="verify_token" value={whatsappFormData.verify_token || ''} onChange={handleWhatsappChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Crie uma senha para o webhook" />
                            </div>
                            <div className="text-right">
                                <button type="submit" disabled={saveWhatsappMutation.isPending} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors">
                                    {saveWhatsappMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faSave} /> Salvar WhatsApp</>}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* --- SEÇÃO 2: OPEN FINANCE (BELVO) --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faBuildingColumns} className="text-blue-600" />
                    Open Finance (Belvo)
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    Configure as credenciais da API da Belvo para permitir a conciliação bancária automática.
                </p>

                {loadingBelvoData && !belvoFormData.secret_id ? (
                    <div className="text-center py-4 text-gray-500"><FontAwesomeIcon icon={faSpinner} spin /> Carregando configurações...</div>
                ) : (
                    <form onSubmit={handleSaveBelvo} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Secret ID</label>
                                <input 
                                    type="text" 
                                    name="secret_id" 
                                    value={belvoFormData.secret_id} 
                                    onChange={handleBelvoChange} 
                                    className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder="Ex: c05cf08a-..."
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Environment (Ambiente)</label>
                                <select 
                                    name="environment" 
                                    value={belvoFormData.environment} 
                                    onChange={handleBelvoChange} 
                                    className="mt-1 w-full p-2 border rounded-md bg-white"
                                >
                                    <option value="sandbox">Sandbox (Testes)</option>
                                    <option value="development">Development</option>
                                    <option value="production">Production (Produção)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Secret Password</label>
                            <input 
                                type="password" 
                                name="secret_password" 
                                value={belvoFormData.secret_password} 
                                onChange={handleBelvoChange} 
                                className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none" 
                                placeholder="Cole a senha secreta aqui"
                                required 
                            />
                        </div>

                        <div className="text-right pt-2">
                            <button type="submit" disabled={saveBelvoMutation.isPending} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {saveBelvoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faSave} /> Salvar Credenciais Belvo</>}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* --- SEÇÃO 3: META/FACEBOOK ADS --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faFacebook} className="text-blue-700" />
                    Leads da Meta (Facebook/Instagram)
                </h2>
                <p className="text-sm text-gray-600 mt-2 mb-4">
                    Conecte sua conta da Meta para capturar leads automaticamente.
                </p>
                
                {status === 'loading' && (
                    <div className="text-center p-4">
                        <FontAwesomeIcon icon={faSpinner} spin /> Verificando conexão...
                    </div>
                )}

                {status === 'authenticated' && session && (
                    <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between border border-green-200">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faLink} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                                Conectado como: {session.user.email}
                            </span>
                        </div>
                        <button onClick={() => signOut()} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUnlink} />
                            Desconectar
                        </button>
                    </div>
                )}

                {status === 'unauthenticated' && (
                    <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-200">
                        <span className="text-sm font-medium text-gray-700">
                            Nenhuma conta conectada.
                        </span>
                        <button onClick={() => signIn('facebook')} className="bg-blue-800 text-white px-4 py-2 rounded-md hover:bg-blue-900 flex items-center gap-2 transition-colors">
                            <FontAwesomeIcon icon={faFacebook} />
                            Conectar com Facebook
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}