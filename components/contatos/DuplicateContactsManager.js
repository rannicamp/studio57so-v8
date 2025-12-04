// components/contatos/DuplicateContactsManager.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { formatPhoneNumber } from '../../utils/formatters';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faIdCard, faBuilding, faPhone, faEnvelope, faSpinner, faLink, faBolt, faStore } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
// 1. IMPORTAR O MODAL DE UNIR
import MergeModal from './MergeModal';

export default function DuplicateContactsManager() {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // 2. ESTADOS PARA O MODAL
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [contactsToMerge, setContactsToMerge] = useState([]);

    // Estado para "Mesclar Tudo" (automático)
    const [isMergingAll, setIsMergingAll] = useState(false);

    const fetchDuplicates = useCallback(() => {
        if (!organizacaoId) return;
        setLoading(true);

        const promise = fetch('/api/contatos/duplicates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizacaoId }),
            cache: 'no-store' 
        })
          .then(res => {
              if (!res.ok) {
                  return res.json().then(err => { throw new Error(err.error || 'Erro na resposta da API') });
              }
              return res.json();
          })
          .then(data => {
            setDuplicateGroups(data);
            return data.length > 0 ? `${data.length} grupos de duplicatas encontrados.` : 'Nenhuma duplicata encontrada!';
          });
        
        toast.promise(promise, {
            loading: 'Buscando contatos duplicados...',
            success: (message) => message,
            error: (err) => `Falha ao carregar: ${err.message}`,
            finally: () => setLoading(false)
        });
    }, [organizacaoId]);

    useEffect(() => {
        fetchDuplicates();
    }, [fetchDuplicates]);

    const getIconForType = (type) => {
        switch (type) {
            case 'CPF':
            case 'CNPJ': return faIdCard;
            case 'Nome': return faUsers;
            case 'Razão Social': return faBuilding;
            case 'Nome Fantasia': return faStore;
            case 'Telefone': return faPhone;
            case 'E-mail': return faEnvelope;
            default: return faUsers;
        }
    };

    // 3. AÇÃO DE ABRIR O MODAL (em vez de mesclar direto)
    const handleOpenMergeModal = (group) => {
        setContactsToMerge(group.contatos);
        setIsMergeModalOpen(true);
    };

    const handleMergeComplete = () => {
        setIsMergeModalOpen(false);
        setContactsToMerge([]);
        fetchDuplicates(); // Recarrega a lista para ver se sumiu
    };

    const handleMergeAll = () => {
        toast("Confirmar Fusão de Todos os Grupos", {
            description: `Tem certeza que deseja mesclar TODOS os ${duplicateGroups.length} grupos AUTOMATICAMENTE? O sistema escolherá o contato mais antigo como principal. Para ter controle, use a fusão individual.`,
            action: {
                label: "Confirmar e Mesclar Tudo",
                onClick: () => {
                    setIsMergingAll(true);
                    const mergeAllPromise = (async () => {
                        for (let i = 0; i < duplicateGroups.length; i++) {
                            const group = duplicateGroups[i];
                            const contactIds = group.contatos.map(c => c.id);
                            // Aqui mantemos a RPC automática para processamento em lote
                            // pois abrir 50 modais seria inviável.
                            const { error } = await supabase.rpc('auto_merge_contacts_and_relink', { 
                                p_contact_ids: contactIds,
                                p_organizacao_id: organizacaoId
                            });
                            if (error) {
                                throw new Error(`Erro no grupo "${group.value}": ${error.message}. Operação interrompida.`);
                            }
                        }
                        return `Todos os ${duplicateGroups.length} grupos foram processados!`;
                    })();

                    toast.promise(mergeAllPromise, {
                        loading: 'Processando fusão automática...',
                        success: (message) => {
                            fetchDuplicates();
                            return message;
                        },
                        error: (err) => err.message,
                        finally: () => setIsMergingAll(false)
                    });
                }
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
                <p className="mt-4 text-gray-500">Analisando sua base de contatos com IA...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 4. INSERIR O MODAL NO COMPONENTE */}
            <MergeModal
                isOpen={isMergeModalOpen}
                onClose={() => setIsMergeModalOpen(false)}
                contactsToMerge={contactsToMerge}
                onMergeComplete={handleMergeComplete}
            />

            {duplicateGroups.length > 0 && !loading && (
                <div className="p-4 bg-yellow-50 rounded-lg flex flex-col sm:flex-row items-center justify-between border border-yellow-200">
                    <div className="flex items-center gap-3 mb-2 sm:mb-0">
                        <FontAwesomeIcon icon={faBolt} className="text-yellow-600 text-xl" />
                        <div>
                            <p className="text-gray-800 font-bold">
                                Encontrados {duplicateGroups.length} grupos de duplicatas
                            </p>
                            <p className="text-xs text-gray-600">
                                Sugerimos revisar cada grupo clicando em "Revisar e Unir".
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleMergeAll}
                        disabled={isMergingAll}
                        className="bg-purple-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <FontAwesomeIcon icon={isMergingAll ? faSpinner : faBolt} spin={isMergingAll} />
                        {isMergingAll ? 'Processando...' : 'Fusão Automática (Cuidado)'}
                    </button>
                </div>
            )}

            {duplicateGroups.length === 0 && !loading ? (
                <div className="text-center p-16 bg-white rounded-lg shadow border border-green-100">
                    <FontAwesomeIcon icon={faUsers} className="text-green-200 text-6xl mb-4" />
                    <h2 className="text-2xl font-bold text-green-600">Base limpa e organizada!</h2>
                    <p className="mt-2 text-gray-600">O sistema não encontrou nenhuma duplicata nos seus contatos.</p>
                </div>
            ) : (
                duplicateGroups.map((group, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 pb-4 border-b gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <FontAwesomeIcon icon={getIconForType(group.type)} className="text-blue-500" />
                                    Duplicata por {group.type}: 
                                    <span className="ml-2 font-mono bg-blue-50 text-blue-800 px-2 py-1 rounded text-base">
                                        {group.type === 'Telefone' ? formatPhoneNumber(group.value) : group.value}
                                    </span>
                                </h2>
                                <p className="text-sm text-gray-500 mt-1 ml-6">
                                    {group.contatos.length} registros conflitantes encontrados.
                                </p>
                            </div>
                            {/* BOTÃO ATUALIZADO PARA ABRIR MODAL */}
                            <button 
                                onClick={() => handleOpenMergeModal(group)}
                                disabled={isMergingAll}
                                className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 whitespace-nowrap"
                            >
                                <FontAwesomeIcon icon={faLink} />
                                Revisar e Unir
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.contatos.map(contato => (
                            <div key={contato.id} className="border p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                <h3 className="font-bold text-gray-800 mb-2 truncate" title={contato.nome || contato.razao_social}>
                                    {contato.nome || contato.razao_social || 'Sem Nome'}
                                </h3>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p className="flex items-center gap-2">
                                        <span className="w-20 font-semibold text-xs uppercase text-gray-400">Tipo</span>
                                        {contato.tipo_contato || '-'}
                                    </p>
                                    {(contato.cpf || contato.cnpj) && (
                                        <p className="flex items-center gap-2">
                                            <span className="w-20 font-semibold text-xs uppercase text-gray-400">Doc</span>
                                            {contato.cpf || contato.cnpj}
                                        </p>
                                    )}
                                    {contato.telefones && contato.telefones.length > 0 && (
                                        <div className="flex items-start gap-2">
                                            <span className="w-20 font-semibold text-xs uppercase text-gray-400 mt-1">Tel</span>
                                            <div className="flex-1">
                                                {contato.telefones.slice(0, 2).map((tel, i) => (
                                                    <span key={i} className="block">{formatPhoneNumber(tel.telefone)}</span>
                                                ))}
                                                {contato.telefones.length > 2 && <span className="text-xs text-gray-400">+{contato.telefones.length - 2} outros</span>}
                                            </div>
                                        </div>
                                    )}
                                     {contato.emails && contato.emails.length > 0 && (
                                        <div className="flex items-start gap-2">
                                            <span className="w-20 font-semibold text-xs uppercase text-gray-400 mt-1">E-mail</span>
                                            <div className="flex-1 overflow-hidden">
                                                {contato.emails.slice(0, 1).map((em, i) => (
                                                    <span key={i} className="block truncate" title={em.email}>{em.email}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}