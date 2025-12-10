// components/contatos/PadronizacaoManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWandMagicSparkles, faObjectGroup, faSort, faSortUp, faSortDown, faBuilding, faUserTag, faPhone } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '@/utils/formatters';
import { toast } from 'sonner';

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

const fetchFixableData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { phones: [], names: [], company_names: [], multi_phones: [] };

    const { data, error } = await supabase
        .from('contatos')
        .select('id, nome, razao_social, nome_fantasia, telefones ( id, telefone, country_code )')
        .eq('organizacao_id', organizacaoId);

    if (error) throw new Error(`Erro ao carregar dados: ${error.message}`);

    const multiPhonesNeedingFix = data.flatMap(c => c.telefones.filter(p => p.telefone && p.telefone.includes('/')).map(p => ({ ...p, contato_id: c.id, contato_nome: c.nome || c.razao_social })));
    const standardPhonesNeedingFix = data.flatMap(c => c.telefones.filter(p => {
        if (!p.telefone || p.telefone.includes('/')) return false;
        const digits = p.telefone.replace(/\D/g, '');
        if (digits !== p.telefone) return true;
        if (digits.length === 11 && digits.startsWith('1') && p.country_code !== '+1') return true;
        if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('1') && p.country_code !== '+55') return true;
        return false;
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

    const { data: dataToFix, isLoading: loading } = useQuery({
        queryKey: ['fixableContacts', organizacaoId],
        queryFn: () => fetchFixableData(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });
    
    const { phones = [], names = [], company_names = [], multi_phones = [] } = dataToFix || {};
    
    const mutation = useMutation({
        mutationFn: async ({ logic }) => {
            const { error } = await logic();
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success("Padronização concluída!");
            queryClient.invalidateQueries({ queryKey: ['fixableContacts', organizacaoId] });
            // Invalida a lista principal também para refletir as mudanças
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
            let finalNumber = (phone.telefone || '').replace(/\D/g, '');
            let countryCode = '+55';
            if (finalNumber.length === 11 && finalNumber.startsWith('1')) countryCode = '+1';
            return supabase.from('telefones').update({ telefone: finalNumber, country_code: countryCode }).eq('id', phone.id).eq('organizacao_id', organizacaoId);
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
                    let finalNumber = num.replace(/\D/g, '');
                    let countryCode = '+55';
                    if (finalNumber.length === 11 && finalNumber.startsWith('1')) countryCode = '+1';
                    else if ((finalNumber.length === 10 || finalNumber.length === 11) && !finalNumber.startsWith('55')) finalNumber = `55${finalNumber}`;
                    return { contato_id: phone.contato_id, telefone: finalNumber, country_code: countryCode, tipo: 'Importado', organizacao_id: organizacaoId };
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
    
    if (loading) { return (<div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>); }

    if (phones.length === 0 && names.length === 0 && company_names.length === 0 && multi_phones.length === 0) {
        return (
            <div className="text-center p-10 flex flex-col items-center justify-center h-full">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-green-300 text-5xl mb-4" />
                <h2 className="text-xl font-bold text-green-700">Tudo limpo!</h2>
                <p className="text-gray-500">Sua base de contatos está 100% padronizada.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 p-1">
            {multi_phones.length > 0 && <div className="space-y-4 p-4 border-2 border-dashed border-red-400 rounded-lg">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faObjectGroup} className="text-2xl text-red-500" /><div><h2 className="text-xl font-semibold">Telefones Múltiplos</h2></div></div>
                <div className="space-y-3">
                    <div className="max-h-40 overflow-y-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs">Contato</th><th className="px-4 py-2 text-left text-xs">Registro Atual</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{multi_phones.slice(0, 20).map(p => (<tr key={p.id}><td className="px-4 py-2 text-xs">{p.contato_nome}</td><td className="px-4 py-2 font-mono text-xs text-red-600">{p.telefone}</td></tr>))}</tbody></table></div>
                    <button onClick={handleSplitAndFormatPhones} disabled={mutation.isPending} className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={mutation.isPending ? faSpinner : faWandMagicSparkles} spin={mutation.isPending} /> Separar {multi_phones.length} Registros</button>
                </div>
            </div>}
            
            {company_names.length > 0 && (<div className="space-y-4 p-4 border rounded-lg bg-orange-50">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faBuilding} className="text-2xl text-orange-500" /><div><h2 className="text-xl font-semibold">Empresas</h2></div></div>
                <div className="space-y-3"><div className="max-h-40 overflow-y-auto border rounded-lg bg-white"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2"><SortableHeader label="Atual" sortKey="razao_social" sortConfig={companyNamesSortConfig} requestSort={(k) => requestSort(k, setCompanyNamesSortConfig)} /></th><th className="px-4 py-2"><SortableHeader label="Novo" sortKey="razao_social" sortConfig={companyNamesSortConfig} requestSort={(k) => requestSort(k, setCompanyNamesSortConfig)} /></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedCompanyNames.slice(0, 20).map(c => (<tr key={c.id}><td className="px-4 py-2 text-xs text-red-600">{c.razao_social || c.nome_fantasia}</td><td className="px-4 py-2 text-xs text-green-600">{titleCase(c.razao_social || c.nome_fantasia)}</td></tr>))}</tbody></table></div><button onClick={handleFormatCompanyNames} disabled={mutation.isPending} className="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={mutation.isPending ? faSpinner : faWandMagicSparkles} spin={mutation.isPending} /> Padronizar {company_names.length} Empresas</button></div>
            </div>)}
            
            {names.length > 0 && (<div className="space-y-4 p-4 border rounded-lg bg-purple-50">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faUserTag} className="text-2xl text-purple-500" /><div><h2 className="text-xl font-semibold">Nomes</h2></div></div>
                <div className="space-y-3"><div className="max-h-40 overflow-y-auto border rounded-lg bg-white"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2"><SortableHeader label="Atual" sortKey="nome" sortConfig={namesSortConfig} requestSort={(k) => requestSort(k, setNamesSortConfig)} /></th><th className="px-4 py-2"><SortableHeader label="Novo" sortKey="nome" sortConfig={namesSortConfig} requestSort={(k) => requestSort(k, setNamesSortConfig)} /></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedNames.slice(0, 20).map(c => (<tr key={c.id}><td className="px-4 py-2 text-xs text-red-600">{c.nome}</td><td className="px-4 py-2 text-xs text-green-600">{titleCase(c.nome)}</td></tr>))}</tbody></table></div><button onClick={handleFormatNames} disabled={mutation.isPending} className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={mutation.isPending ? faSpinner : faWandMagicSparkles} spin={mutation.isPending} /> Padronizar {names.length} Nomes</button></div>
            </div>)}

            {phones.length > 0 && (<div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faPhone} className="text-2xl text-blue-500" /><div><h2 className="text-xl font-semibold">Telefones</h2></div></div>
                <div className="space-y-3"><div className="max-h-40 overflow-y-auto border rounded-lg bg-white"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2"><SortableHeader label="Contato" sortKey="contato_nome" sortConfig={phonesSortConfig} requestSort={(k) => requestSort(k, setPhonesSortConfig)} /></th><th className="px-4 py-2"><SortableHeader label="Atual" sortKey="telefone" sortConfig={phonesSortConfig} requestSort={(k) => requestSort(k, setPhonesSortConfig)} /></th><th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Novo</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedPhones.map(p => {
                    let finalNumber = (p.telefone || '').replace(/\D/g, '');
                    if (finalNumber.length === 11 && finalNumber.startsWith('1')) {} 
                    else if (finalNumber.length === 10 || finalNumber.length === 11) finalNumber = `55${finalNumber}`;
                    return (<tr key={p.id}><td className="px-4 py-2 text-xs">{p.contato_nome}</td><td className="px-4 py-2 text-xs text-red-600">{p.telefone}</td><td className="px-4 py-2 text-xs text-green-600">{formatPhoneNumber(finalNumber)}</td></tr>);
                })}</tbody></table></div><button onClick={handleFormatPhones} disabled={mutation.isPending} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"><FontAwesomeIcon icon={mutation.isPending ? faSpinner : faWandMagicSparkles} spin={mutation.isPending} /> Padronizar {phones.length} Telefones</button></div>
            </div>)}
        </div>
    );
}