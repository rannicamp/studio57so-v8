//components\contatos\MergeModal.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUsers, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const MergeField = ({ field, contacts, finalContact, setFinalContact }) => {
    const isArrayField = ['telefones', 'emails'].includes(field.key);

    if (isArrayField) {
        const allItems = contacts.flatMap(c => c[field.key] || []);
        const uniqueItems = Array.from(new Map(allItems.map(item => [item[field.itemKey], item])).values());

        const handleCheckboxChange = (item) => {
            setFinalContact(prev => {
                const currentItems = prev[field.key] || [];
                const isSelected = currentItems.some(i => i[field.itemKey] === item[field.itemKey]);
                const newItems = isSelected
                    ? currentItems.filter(i => i[field.itemKey] !== item[field.itemKey])
                    : [...currentItems, item];
                return { ...prev, [field.key]: newItems };
            });
        };

        return (
            <div className="py-2">
                <p className="font-semibold text-sm mb-2">{field.label}</p>
                <div className="space-y-2">
                    {uniqueItems.map((item, idx) => (
                        <label key={idx} className="flex items-center p-2 bg-gray-100 rounded-md">
                            <input
                                type="checkbox"
                                checked={(finalContact[field.key] || []).some(i => i[field.itemKey] === item[field.itemKey])}
                                onChange={() => handleCheckboxChange(item)}
                                className="h-4 w-4 rounded"
                            />
                            <span className="ml-3 text-sm">{item[field.itemKey]}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="py-2">
            <p className="font-semibold text-sm mb-2">{field.label}</p>
            <div className="flex flex-col gap-2">
                {contacts.map(c => {
                    const value = c[field.key];
                    if (!value) return null;
                    const isSelected = finalContact[field.key] === value;
                    return (
                        <button
                            key={c.id}
                            onClick={() => setFinalContact(prev => ({ ...prev, [field.key]: value }))}
                            className={`p-2 border rounded-md text-left text-sm transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300' : 'bg-white hover:bg-gray-100'}`}
                        >
                            {value}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default function MergeModal({ isOpen, onClose, contactsToMerge, onMergeComplete }) {
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para pegar o ID da organização
    const organizacaoId = user?.organizacao_id;

    const [finalContact, setFinalContact] = useState({});
    const [primaryContactId, setPrimaryContactId] = useState(null);
    const [isMerging, setIsMerging] = useState(false);

    useEffect(() => {
        if (isOpen && contactsToMerge.length > 0) {
            const initialPrimary = contactsToMerge[0];
            setPrimaryContactId(initialPrimary.id);

            const allTelefones = contactsToMerge.flatMap(c => c.telefones || []);
            const uniqueTelefones = Array.from(new Map(allTelefones.map(item => [item.telefone, item])).values());
            
            const allEmails = contactsToMerge.flatMap(c => c.emails || []);
            const uniqueEmails = Array.from(new Map(allEmails.map(item => [item.email, item])).values());

            const initialFinalContact = {
                ...initialPrimary,
                telefones: uniqueTelefones,
                emails: uniqueEmails,
            };
            setFinalContact(initialFinalContact);
        }
    }, [isOpen, contactsToMerge]);

    const fieldsToMerge = [
        { key: 'nome', label: 'Nome' },
        { key: 'razao_social', label: 'Razão Social' },
        { key: 'cpf', label: 'CPF' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'tipo_contato', label: 'Tipo de Contato' },
        { key: 'telefones', label: 'Telefones', isArray: true, itemKey: 'telefone' },
        { key: 'emails', label: 'E-mails', isArray: true, itemKey: 'email' },
    ];

    const handleMerge = async () => {
        if (!organizacaoId) {
            toast.error("Erro de segurança: Organização não identificada.");
            return;
        }
        setIsMerging(true);
        const promise = new Promise(async (resolve, reject) => {
            const secondaryContactIds = contactsToMerge.map(c => c.id).filter(id => id !== primaryContactId);
            
            const finalDataForUpdate = {
                nome: finalContact.nome || null,
                razao_social: finalContact.razao_social || null,
                cpf: finalContact.cpf || null,
                cnpj: finalContact.cnpj || null,
                tipo_contato: finalContact.tipo_contato || null,
            };

            // =================================================================================
            // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
            // O PORQUÊ: Passamos o `organizacaoId` para a função do banco de dados.
            // Isso garante que a operação de fusão e religação de referências ocorra
            // de forma segura, apenas dentro da organização correta.
            // =================================================================================
            const { data, error } = await supabase.rpc('merge_contacts_and_relink_all_references', {
                p_primary_contact_id: primaryContactId,
                p_secondary_contact_ids: secondaryContactIds,
                p_final_data: finalDataForUpdate,
                p_final_telefones: finalContact.telefones || [],
                p_final_emails: finalContact.emails || [],
                p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
            });

            if (error) reject(new Error(error.message));
            else resolve(data);
        });

        toast.promise(promise, {
            loading: 'Mesclando contatos e atualizando todas as referências...',
            success: (message) => {
                onMergeComplete();
                onClose();
                return message;
            },
            error: (err) => `Erro ao mesclar: ${err.message}`,
            finally: () => setIsMerging(false)
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Unir Contatos Manualmente</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coluna de Seleção */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg">1. Escolha os dados finais</h3>
                        <div className="p-4 border rounded-md bg-gray-50 max-h-[65vh] overflow-y-auto">
                            {fieldsToMerge.map(field => (
                                <MergeField key={field.key} field={field} contacts={contactsToMerge} finalContact={finalContact} setFinalContact={setFinalContact} />
                            ))}
                        </div>
                    </div>

                    {/* Coluna do Resultado Final */}
                    <div className="space-y-4">
                         <h3 className="font-bold text-lg">2. Revise e confirme</h3>
                         <div className="p-4 border rounded-md bg-green-50 text-green-900 max-h-[65vh] overflow-y-auto">
                            <h4 className="font-semibold mb-2">Contato Principal (Manter ID)</h4>
                            <select value={primaryContactId || ''} onChange={(e) => setPrimaryContactId(parseInt(e.target.value))} className="w-full p-2 border rounded-md mb-4">
                                {contactsToMerge.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome || c.razao_social} (ID: {c.id})</option>
                                ))}
                            </select>

                            <h4 className="font-semibold mb-2">Resultado da Mesclagem</h4>
                            <div className="space-y-2 text-sm">
                                <p><strong>Nome/Razão:</strong> {finalContact.nome || finalContact.razao_social}</p>
                                <p><strong>CPF/CNPJ:</strong> {finalContact.cpf || finalContact.cnpj}</p>
                                <p><strong>Telefones:</strong> {(finalContact.telefones || []).map(t => t.telefone).join(', ')}</p>
                                <p><strong>Emails:</strong> {(finalContact.emails || []).map(e => e.email).join(', ')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end">
                    <button onClick={handleMerge} disabled={isMerging} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">
                        <FontAwesomeIcon icon={isMerging ? faSpinner : faUsers} spin={isMerging} />
                        Confirmar Mesclagem
                    </button>
                </div>
            </div>
        </div>
    );
}