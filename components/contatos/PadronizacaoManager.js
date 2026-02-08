// components/contatos/PadronizacaoManager.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWandMagicSparkles, faSort, faSortUp, faSortDown, faPhone, faCheckCircle, faGlobeAmericas, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const CACHE_KEY = 'PADRONIZACAO_DATA_CACHE';

const titleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        const exceptions = ['de', 'da', 'do', 'dos', 'das', 'e'];
        if (exceptions.includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

const SortableHeader = ({ label, sortKey, sortConfig, requestSort }) => {
    const getSortIcon = () => {
        if (sortConfig.key !== sortKey) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };
    return (
        <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-full">
            <span>{label}</span>
            <FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" />
        </button>
    );
};

// Lógica Centralizada de Padronização (Usada tanto na exibição quanto no salvamento)
const standardizePhoneLogic = (rawPhone, currentCountryCode) => {
    let digits = (rawPhone || '').replace(/\D/g, '');
    let finalNumber = digits;
    let newCountryCode = currentCountryCode;
    let isModified = false;

    // 1. Regra EUA (Começa com 1, tem 11 digitos)
    if (digits.startsWith('1') && digits.length === 11) {
        // É EUA, mantém como está.
        if (newCountryCode !== '+1') {
             newCountryCode = '+1'; // Ajusta country code se estiver errado
             isModified = true;
        }
    } 
    // 2. Regra Brasil (Sem DDI)
    // Se tiver 10 ou 11 digitos e NÃO for o caso EUA acima
    else if (digits.length >= 10 && digits.length <= 11) {
        // Proteção extra: Se começar com 1 e o terceiro digito NÃO for 9 (Ex: 150...), assume EUA e não mexe
        if (digits.startsWith('1') && digits.length === 11 && digits[2] !== '9') {
             if (newCountryCode !== '+1') {
                newCountryCode = '+1';
                isModified = true;
             }
        } else {
            // É Brasil sem DDI, adiciona 55
            if (!digits.startsWith('55')) {
                finalNumber = '55' + digits;
                newCountryCode = '+55';
                isModified = true;
            }
        }
    }
    // 3. Regra Brasil (Já tem 55)
    else if (digits.startsWith('55')) {
         if (newCountryCode !== '+55') {
             newCountryCode = '+55';
             isModified = true;
         }
    }

    // Se o número mudou, marcamos como modificado
    if (finalNumber !== digits) isModified = true;

    return { finalNumber, newCountryCode, isModified };
};


const fetchFixableData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { phones: [], names: [], company_names: [], multi_phones: [] };

    const { data, error } = await supabase
        .from('contatos')
        .select('id, nome, razao_social, nome_fantasia, telefones ( id, telefone, country_code )')
        .eq('organizacao_id', organizacaoId);

    if (error) throw new Error(`Erro ao carregar dados: ${error.message}`);

    const multiPhonesNeedingFix = data.flatMap(c => c.telefones.filter(p => p.telefone && p.telefone.includes('/')).map(p => ({ ...p, contato_id: c.id, contato_nome: c.nome || c.razao_social })));
    
    // Filtra apenas telefones que a nossa lógica diz que precisam mudar
    const standardPhonesNeedingFix = data.flatMap(c => c.telefones.filter(p => {
        if (!p.telefone || p.telefone.includes('/')) return false;
        const { isModified } = standardizePhoneLogic(p.telefone, p.country_code);
        return isModified;
    }).map(p => ({ ...p, contato_nome: c.nome || c.razao_social })));

    const namesNeedingFix = data.filter(c => c.nome && c.nome !== titleCase(c.nome));
    const companyNamesNeedingFix = data.filter(c => (c.razao_social && c.razao_social !== titleCase(c.razao_social)) || (c.nome_fantasia && c.nome_fantasia !== titleCase(c.nome_fantasia)));

    return { phones: standardPhonesNeedingFix, names: namesNeedingFix, company_names: companyNamesNeedingFix, multi_phones: multiPhonesNeedingFix };
};

export default function PadronizacaoManager() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [namesSortConfig, setNamesSortConfig] = useState({ key: 'nome', direction: 'ascending' });
    const [companyNamesSortConfig, setCompanyNamesSortConfig] = useState({ key: 'razao_social', direction: 'ascending' });
    const [phonesSortConfig, setPhonesSortConfig] = useState({ key: 'contato_nome', direction: 'ascending' });

    const initialDataLoaded = useRef(false);

    const { data: dataToFix, isLoading: loading, isFetching } = useQuery({
        queryKey: ['fixableContacts', organizacaoId],
        queryFn: () => fetchFixableData(supabase, organizacaoId),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5,
        refetchOnMount: true,
    });

    useEffect(() => {
        if (dataToFix) {
            initialDataLoaded.current = true;
        }
    }, [dataToFix]);
    
    const { phones = [], names = [], company_names = [], multi_phones = [] } = dataToFix || {};
    
    const mutation = useMutation({
        mutationFn: async ({ logic }) => {
            const { error } = await logic();
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success("Padronização concluída!");
            queryClient.invalidateQueries({ queryKey: ['fixableContacts', organizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] });
        },
        onError: (error) => toast.error(`Erro: ${error.message}`)
    });

    const handleBatchUpdate = (count, type, logic) => {
        toast.warning(`Padronizar ${count} ${type}?`, {
            action: { label: 'Confirmar', onClick: () => mutation.mutate({ logic }) },
            cancel: { label: 'Cancelar' },
        });
    };

    const handleFormatPhones = () => handleBatchUpdate(phones.length, 'telefones', async () => {
        const updates = phones.map(phone => {
            // Usa a MESMA lógica da visualização para garantir consistência
            const { finalNumber, newCountryCode } = standardizePhoneLogic(phone.telefone, phone.country_code);

            return supabase.from('telefones')
                .update({ telefone: finalNumber, country_code: newCountryCode })
                .eq('id', phone.id)
                .eq('organizacao_id', organizacaoId);
        });
        await Promise.all(updates);
        return { error: null };
    });

    const handleFormatNames = () => handleBatchUpdate(names.length, 'nomes', async () => {
        const updates = names.map(c => supabase.from('contatos').update({ nome: titleCase(c.nome) }).eq('id', c.id).eq('organizacao_id', organizacaoId));
        await Promise.all(updates);
        return { error: null };
    });

    const handleFormatCompanyNames = () => handleBatchUpdate(company_names.length, 'empresas', async () => {
        const updates = company_names.map(c => {
            const updatedData = {};
            if (c.razao_social) updatedData.razao_social = titleCase(c.razao_social);
            if (c.nome_fantasia) updatedData.nome_fantasia = titleCase(c.nome_fantasia);
            return supabase.from('contatos').update(updatedData).eq('id', c.id).eq('organizacao_id', organizacaoId);
        });
        await Promise.all(updates);
        return { error: null };
    });

    const handleSplitAndFormatPhones = () => handleBatchUpdate(multi_phones.length, 'registros', async () => {
        for (const phone of multi_phones) {
            const numbers = phone.telefone.split('/').map(n => n.trim()).filter(Boolean);
            if (numbers.length > 0) {
                await supabase.from('telefones').delete().eq('id', phone.id).eq('organizacao_id', organizacaoId);
                const newRecords = numbers.map(num => {
                    // Usa a lógica padrão para cada sub-número também
                    const { finalNumber, newCountryCode } = standardizePhoneLogic(num, '+55');
                    
                    return { contato_id: phone.contato_id, telefone: finalNumber, country_code: newCountryCode, tipo: 'Importado', organizacao_id: organizacaoId };
                });
                await supabase.from('telefones').insert(newRecords);
            }
        }
        return { error: null };
    });

    const sortData = (data, config) => { if (!config.key) return data; return [...data].sort((a, b) => { if (a[config.key] < b[config.key]) return config.direction === 'ascending' ? -1 : 1; if (a[config.key] > b[config.key]) return config.direction === 'ascending' ? 1 : -1; return 0; }); };
    const requestSort = (key, setConfig) => { setConfig(prevConfig => ({ key, direction: prevConfig.key === key && prevConfig.direction === 'ascending' ? 'descending' : 'ascending' })); };
    const sortedNames = useMemo(() => sortData(names, namesSortConfig), [names, namesSortConfig]);
    const sortedCompanyNames = useMemo(() => sortData(company_names, companyNamesSortConfig), [company_names, companyNamesSortConfig]);
    const sortedPhones = useMemo(() => sortData(phones, phonesSortConfig), [phones, phonesSortConfig]);
    
    if (loading && !dataToFix) { return (<div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>); }

    if (phones.length === 0 && names.length === 0 && company_names.length === 0 && multi_phones.length === 0) {
        return (
            <div className="text-center p-10 flex flex-col items-center justify-center h-full">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-green-300 text-5xl mb-4" />
                <h2 className="text-xl font-bold text-green-700">Tudo limpo!</h2>
                <p className="text-gray-500">Sua base de contatos está 100% padronizada.</p>
                {isFetching && <p className="text-xs text-blue-500 mt-2"><FontAwesomeIcon icon={faSpinner} spin /> Verificando atualizações...</p>}
            </div>
        )
    }

    return (
        <div className="space-y-8 p-1">
            {isFetching && initialDataLoaded.current && (
                 <div className="flex justify-end mb-2">
                    <span className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded"><FontAwesomeIcon icon={faSpinner} spin /> Atualizando em segundo plano...</span>
                 </div>
            )}

            {/* Bloco de Telefones */}
            {phones.length > 0 && (<div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faPhone} className="text-2xl text-blue-500" /><div><h2 className="text-xl font-semibold">Telefones fora do padrão</h2></div></div>
                <div className="space-y-3"><div className="max-h-40 overflow-y-auto border rounded-lg bg-white"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2"><SortableHeader label="Contato" sortKey="contato_nome" sortConfig={phonesSortConfig} requestSort={(k) => requestSort(k, setPhonesSortConfig)} /></th><th className="px-4 py-2"><SortableHeader label="Atual" sortKey="telefone" sortConfig={phonesSortConfig} requestSort={(k) => requestSort(k, setPhonesSortConfig)} /></th><th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Será Salvo Como (Sem Máscara)</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedPhones.map(p => {
                    
                    // AQUI ESTÁ A GARANTIA: Usamos a mesma função que será usada ao salvar
                    const { finalNumber } = standardizePhoneLogic(p.telefone, p.country_code);
                    
                    return (<tr key={p.id}>
                        <td className="px-4 py-2 text-xs">{p.contato_nome}</td>
                        <td className="px-4 py-2 text-xs text-red-600 flex items-center gap-1">
                           {p.country_code === '+1' && <FontAwesomeIcon icon={faGlobeAmericas} className="text-blue-400" title="USA" />}
                           {p.telefone}
                        </td>
                        <td className="px-4 py-2 text-xs text-green-700 font-mono font-bold flex items-center gap-2">
                            <FontAwesomeIcon icon={faArrowRight} className="text-gray-300" />
                            {finalNumber}
                        </td>
                    </tr>);
                })}</tbody></table></div><button onClick={handleFormatPhones} disabled={mutation.isPending} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={mutation.isPending ? faSpinner : faWandMagicSparkles} spin={mutation.isPending} /> Padronizar {phones.length} Telefones</button></div>
            </div>)}
        </div>
    );
}