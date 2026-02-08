// components/contatos/MergeModal.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUsers, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const MergeField = ({ field, contacts, finalContact, setFinalContact }) => {
    const isArrayField = ['telefones', 'emails'].includes(field.key);

    if (isArrayField) {
        const allItems = contacts.flatMap(c => c[field.key] || []);
        // Remove duplicatas exatas nos arrays
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
                        <label key={idx} className="flex items-center p-2 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200">
                            <input
                                type="checkbox"
                                checked={(finalContact[field.key] || []).some(i => i[field.itemKey] === item[field.itemKey])}
                                onChange={() => handleCheckboxChange(item)}
                                className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                            />
                            <span className="ml-3 text-sm">{item[field.itemKey]}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    // Filtra valores nulos/vazios e remove duplicatas
    const uniqueValues = [...new Set(contacts.map(c => c[field.key]).filter(v => v !== null && v !== undefined && v !== ''))];

    if (uniqueValues.length === 0) return null; // Não mostra campo se não tiver dados

    return (
        <div className="py-2">
            <p className="font-semibold text-sm mb-2">{field.label}</p>
            <div className="flex flex-col gap-2">
                {uniqueValues.map((value, idx) => {
                    const isSelected = finalContact[field.key] === value;
                    return (
                        <button
                            key={idx}
                            onClick={() => setFinalContact(prev => ({ ...prev, [field.key]: value }))}
                            className={`p-2 border rounded-md text-left text-sm transition-colors ${isSelected ? 'bg-green-600 text-white border-green-700 ring-2 ring-green-300' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
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
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [finalContact, setFinalContact] = useState({});
    const [primaryContactId, setPrimaryContactId] = useState(null);
    const [isMerging, setIsMerging] = useState(false);

    useEffect(() => {
        if (isOpen && contactsToMerge.length > 0) {
            // Tenta priorizar o contato mais antigo (menor ID) ou o que tem mais dados como principal
            const sortedByData = [...contactsToMerge].sort((a, b) => {
                 // Lógica simples: quem tem ID menor é mais antigo. 
                 // Poderíamos refinar para quem tem mais campos preenchidos.
                 return a.id - b.id;
            });
            
            const initialPrimary = sortedByData[0];
            setPrimaryContactId(initialPrimary.id);

            const allTelefones = contactsToMerge.flatMap(c => c.telefones || []);
            const uniqueTelefones = Array.from(new Map(allTelefones.map(item => [item.telefone, item])).values());
            
            const allEmails = contactsToMerge.flatMap(c => c.emails || []);
            const uniqueEmails = Array.from(new Map(allEmails.map(item => [item.email, item])).values());
            
            // Preenche o finalContact combinando os dados (prioridade para o primeiro, mas preenchendo buracos com os outros)
            const bestInitialData = contactsToMerge.reduce((acc, current) => {
                for (const key in current) {
                    if (current[key] && !acc[key]) {
                        acc[key] = current[key];
                    }
                }
                return acc;
            }, {});

            const initialFinalContact = {
                ...bestInitialData,
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
        { key: 'rg', label: 'RG' },
        { key: 'tipo_contato', label: 'Tipo de Contato' },
        { key: 'estado_civil', label: 'Estado Civil' },
        { key: 'cargo', label: 'Profissão' },
        { key: 'origem', label: 'Origem' },
        { key: 'address_street', label: 'Rua' },
        { key: 'address_number', label: 'Número' },
        { key: 'address_complement', label: 'Complemento' },
        { key: 'neighborhood', label: 'Bairro' },
        { key: 'city', label: 'Cidade' },
        { key: 'state', label: 'Estado' },
        { key: 'cep', label: 'CEP' },
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
            
            // Prepara os dados finais para update
            const finalDataForUpdate = {};
            fieldsToMerge.forEach(field => {
                if (!field.isArray) {
                    finalDataForUpdate[field.key] = finalContact[field.key] || null;
                }
            });

            // Chama a RPC PODEROSA (a ferramenta de Unir)
            const { data, error } = await supabase.rpc('merge_contacts_and_relink_all_references', {
                p_primary_contact_id: primaryContactId,
                p_secondary_contact_ids: secondaryContactIds,
                p_final_data: finalDataForUpdate,
                p_final_telefones: finalContact.telefones || [],
                p_final_emails: finalContact.emails || [],
                p_organizacao_id: organizacaoId
            });

            if (error) reject(new Error(error.message));
            else resolve(data);
        });

        toast.promise(promise, {
            loading: 'Mesclando contatos e atualizando todas as referências...',
            success: (message) => {
                onMergeComplete();
                onClose();
                return 'Fusão concluída com sucesso! Dados unificados.';
            },
            error: (err) => `Erro ao mesclar: ${err.message}`,
            finally: () => setIsMerging(false)
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Unir Contatos</h2>
                        <p className="text-sm text-gray-500">Selecione os dados corretos para manter no contato final.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-8 bg-gray-50/50">
                    {/* Coluna de Seleção */}
                    <div className="md:col-span-2 space-y-6">
                        <h3 className="font-bold text-lg text-blue-800 flex items-center gap-2">
                            <span className="bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Escolha os dados finais
                        </h3>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                            {fieldsToMerge.map(field => (
                                <MergeField key={field.key} field={field} contacts={contactsToMerge} finalContact={finalContact} setFinalContact={setFinalContact} />
                            ))}
                        </div>
                    </div>

                    {/* Coluna do Resultado Final */}
                    <div className="space-y-6">
                         <h3 className="font-bold text-lg text-green-800 flex items-center gap-2">
                            <span className="bg-green-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Revise o Resultado
                         </h3>
                         <div className="bg-white p-5 rounded-lg shadow-md border border-green-200 sticky top-0">
                             <div className="mb-4">
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Contato Principal (ID)</label>
                                <select 
                                    value={primaryContactId || ''} 
                                    onChange={(e) => setPrimaryContactId(parseInt(e.target.value))} 
                                    className="w-full p-2 border border-green-300 rounded-md bg-green-50 text-green-900 font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                >
                                     {contactsToMerge.map(c => (
                                         <option key={c.id} value={c.id}>
                                             {c.nome || c.razao_social} (ID: {c.id})
                                         </option>
                                     ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">Todas as vendas e histórico serão movidos para este ID.</p>
                             </div>

                             <div className="space-y-3 text-sm border-t pt-4">
                                 <div>
                                     <span className="text-gray-500 text-xs block">Nome Final</span>
                                     <p className="font-semibold text-gray-800">{finalContact.nome || finalContact.razao_social || <span className="text-red-400 italic">Não definido</span>}</p>
                                 </div>
                                 {(finalContact.cpf || finalContact.cnpj) && (
                                     <div>
                                         <span className="text-gray-500 text-xs block">Documento</span>
                                         <p className="font-mono text-gray-700">{finalContact.cpf || finalContact.cnpj}</p>
                                     </div>
                                 )}
                                 <div>
                                     <span className="text-gray-500 text-xs block">Telefones ({finalContact.telefones?.length})</span>
                                     <p className="text-gray-700">{(finalContact.telefones || []).map(t => t.telefone).join(', ') || '-'}</p>
                                 </div>
                                 <div>
                                     <span className="text-gray-500 text-xs block">E-mails ({finalContact.emails?.length})</span>
                                     <p className="text-gray-700 truncate">{(finalContact.emails || []).map(e => e.email).join(', ') || '-'}</p>
                                 </div>
                             </div>

                             <div className="mt-6 pt-4 border-t">
                                <button onClick={handleMerge} disabled={isMerging} className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-bold shadow-lg shadow-green-200 transition-all hover:scale-[1.02]">
                                    <FontAwesomeIcon icon={isMerging ? faSpinner : faUsers} spin={isMerging} />
                                    Confirmar Fusão
                                </button>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}