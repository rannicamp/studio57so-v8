"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { formatPhoneNumber } from '../../utils/formatters';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faIdCard, faBuilding, faPhone, faEnvelope, faSpinner, faLink, faBolt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function DuplicateContactsManager() {
    const supabase = createClient();
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mergingGroupId, setMergingGroupId] = useState(null);
    const [isMergingAll, setIsMergingAll] = useState(false);

    const fetchDuplicates = useCallback(() => {
        setLoading(true);
        const promise = fetch('/api/contatos/duplicates', { cache: 'no-store' })
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
    }, []);

    useEffect(() => {
        fetchDuplicates();
    }, [fetchDuplicates]);

    const handleMerge = async (group) => {
        if (!window.confirm(`Tem certeza que deseja mesclar ${group.contatos.length} contatos encontrados pelo ${group.type}: "${group.value}"? Esta ação não pode ser desfeita.`)) {
            return;
        }
        setMergingGroupId(group.value);
        
        const contactIds = group.contatos.map(c => c.id);

        const promise = supabase.rpc('auto_merge_contacts_and_relink', {
            p_contact_ids: contactIds
        });

        toast.promise(promise, {
            loading: `Mesclando grupo: ${group.value}...`,
            success: (response) => {
                fetchDuplicates();
                return response.data;
            },
            error: (err) => `Erro ao mesclar: ${err.message}`,
            finally: () => setMergingGroupId(null)
        });
    };

    const handleMergeAll = async () => {
        if (!window.confirm(`Tem certeza que deseja mesclar TODOS os ${duplicateGroups.length} grupos de contatos duplicados? Esta ação é irreversível e pode levar alguns segundos.`)) {
            return;
        }
        setIsMergingAll(true);
        
        const mergeAllPromise = (async () => {
            for (let i = 0; i < duplicateGroups.length; i++) {
                const group = duplicateGroups[i];
                const contactIds = group.contatos.map(c => c.id);
                const { error } = await supabase.rpc('auto_merge_contacts_and_relink', { p_contact_ids: contactIds });
                if (error) {
                    throw new Error(`Erro no grupo "${group.value}": ${error.message}. Operação interrompida.`);
                }
            }
            return `Todos os ${duplicateGroups.length} grupos foram mesclados com sucesso!`;
        })();

        toast.promise(mergeAllPromise, {
            loading: 'Iniciando mesclagem de todos os grupos...',
            success: (message) => {
                fetchDuplicates();
                return message;
            },
            error: (err) => err.message,
            finally: () => setIsMergingAll(false)
        });
    };

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {duplicateGroups.length > 0 && !loading && (
                <div className="p-4 bg-gray-50 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-end border">
                    <p className="text-sm text-gray-700 font-medium sm:mr-4 mb-2 sm:mb-0">
                        Encontrados {duplicateGroups.length} grupos de contatos duplicados.
                    </p>
                    <button
                        onClick={handleMergeAll}
                        disabled={isMergingAll}
                        className="bg-purple-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <FontAwesomeIcon icon={isMergingAll ? faSpinner : faBolt} spin={isMergingAll} />
                        {isMergingAll ? 'Mesclando Tudo...' : 'Juntar Todos os Grupos'}
                    </button>
                </div>
            )}

            {duplicateGroups.length === 0 && !loading ? (
                <div className="text-center p-10 bg-white rounded-lg shadow">
                    <h2 className="text-2xl font-bold text-green-600">Nenhum contato duplicado encontrado!</h2>
                    <p className="mt-2 text-gray-600">Sua base de contatos está limpa.</p>
                </div>
            ) : (
                duplicateGroups.map((group, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-start mb-4 pb-4 border-b">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    <FontAwesomeIcon icon={group.type === 'CPF' || group.type === 'CNPJ' ? faIdCard : (group.type === 'Nome' ? faUsers : (group.type === 'Telefone' ? faPhone : faEnvelope))} className="mr-3 text-red-500" />
                                    Duplicata por {group.type}: <span className="font-mono bg-gray-100 p-1 rounded">{formatPhoneNumber(group.value)}</span>
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">{group.contatos.length} contatos encontrados com este valor.</p>
                            </div>
                            <button 
                                onClick={() => handleMerge(group)}
                                disabled={isMergingAll || mergingGroupId === group.value}
                                className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                            >
                                {mergingGroupId === group.value ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
                                {mergingGroupId === group.value ? 'Mesclando...' : 'Juntar Contatos'}
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {group.contatos.map(contato => (
                            <div key={contato.id} className="border p-4 rounded-lg bg-gray-50 space-y-3">
                            <h3 className="font-bold text-lg">{contato.nome || contato.razao_social}</h3>
                            <p><FontAwesomeIcon icon={faBuilding} className="mr-2 w-4 text-gray-500" /> {contato.tipo_contato}</p>
                            
                            {contato.cpf && <p><span className="font-semibold">CPF:</span> {contato.cpf}</p>}
                            {contato.cnpj && <p><span className="font-semibold">CNPJ:</span> {contato.cnpj}</p>}
                            
                            {contato.telefones && contato.telefones.length > 0 && (
                                <div className="flex items-start">
                                    <FontAwesomeIcon icon={faPhone} className="mr-2 w-4 mt-1 text-gray-500" />
                                    <div>
                                        {contato.telefones.map((tel, i) => <span key={i} className="block">{formatPhoneNumber(tel.telefone)}</span>)}
                                    </div>
                                </div>
                            )}

                            {contato.emails && contato.emails.length > 0 && (
                                <div className="flex items-start">
                                    <FontAwesomeIcon icon={faEnvelope} className="mr-2 w-4 mt-1 text-gray-500" />
                                    <div className="truncate">
                                        {contato.emails.map((email, i) => <span key={i} className="block">{email.email}</span>)}
                                    </div>
                                </div>
                            )}

                            </div>
                        ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}