"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../../../utils/supabase/client';
import { useLayout } from '../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWandMagicSparkles, faCheckCircle, faExclamationCircle, faPhone, faUserTag, faBuilding, faSort, faSortUp, faSortDown, faObjectGroup } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '../../../../utils/formatters';
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

export default function PadronizacaoPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();

    const [stats, setStats] = useState({ phones: 0, names: 0, company_names: 0, multi_phones: 0 });
    const [dataToFix, setDataToFix] = useState({ phones: [], names: [], company_names: [], multi_phones: [] });
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [namesSortConfig, setNamesSortConfig] = useState({ key: 'nome', direction: 'ascending' });
    const [companyNamesSortConfig, setCompanyNamesSortConfig] = useState({ key: 'razao_social', direction: 'ascending' });
    const [phonesSortConfig, setPhonesSortConfig] = useState({ key: 'contato_nome', direction: 'ascending' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('contatos').select('id, nome, razao_social, nome_fantasia, telefones ( id, telefone, country_code )');
        if (error) { toast.error(`Erro ao carregar: ${error.message}`); setLoading(false); return; }

        const multiPhonesNeedingFix = data.flatMap(c => c.telefones.filter(p => p.telefone && p.telefone.includes('/')).map(p => ({ ...p, contato_id: c.id, contato_nome: c.nome || c.razao_social })));
        
        // ***** INÍCIO DA CORREÇÃO NA LÓGICA DE IDENTIFICAÇÃO *****
        const standardPhonesNeedingFix = data.flatMap(c => c.telefones.filter(p => {
            if (!p.telefone || p.telefone.includes('/')) return false;
            
            const digits = p.telefone.replace(/\D/g, '');

            // Precisa de correção se tiver caracteres de formatação
            if (digits !== p.telefone) return true;

            // Precisa de correção se for um número dos EUA mas o código do país não for +1
            if (digits.length === 11 && digits.startsWith('1') && p.country_code !== '+1') return true;

            // Precisa de correção se for um número do Brasil mas o código do país não for +55
            if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('1') && p.country_code !== '+55') return true;

            return false;
        }).map(p => ({ ...p, contato_nome: c.nome || c.razao_social })));
        // ***** FIM DA CORREÇÃO NA LÓGICA DE IDENTIFICAÇÃO *****

        const namesNeedingFix = data.filter(c => c.nome && c.nome !== titleCase(c.nome));
        const companyNamesNeedingFix = data.filter(c => (c.razao_social && c.razao_social !== titleCase(c.razao_social)) || (c.nome_fantasia && c.nome_fantasia !== titleCase(c.nome_fantasia)));

        setStats({ phones: standardPhonesNeedingFix.length, names: namesNeedingFix.length, company_names: companyNamesNeedingFix.length, multi_phones: multiPhonesNeedingFix.length });
        setDataToFix({ phones: standardPhonesNeedingFix, names: namesNeedingFix, company_names: companyNamesNeedingFix, multi_phones: multiPhonesNeedingFix });
        setLoading(false);
    }, [supabase]);

    useEffect(() => { setPageTitle('Padronização de Contatos'); fetchData(); }, [setPageTitle, fetchData]);

    const sortData = (data, config) => { if (!config.key) return data; return [...data].sort((a, b) => { if (a[config.key] < b[config.key]) return config.direction === 'ascending' ? -1 : 1; if (a[config.key] > b[config.key]) return config.direction === 'ascending' ? 1 : -1; return 0; }); };
    const requestSort = (key, setConfig) => { setConfig(prevConfig => ({ key, direction: prevConfig.key === key && prevConfig.direction === 'ascending' ? 'descending' : 'ascending' })); };
    const sortedNames = useMemo(() => sortData(dataToFix.names, namesSortConfig), [dataToFix.names, namesSortConfig]);
    const sortedCompanyNames = useMemo(() => sortData(dataToFix.company_names, companyNamesSortConfig), [dataToFix.company_names, companyNamesSortConfig]);
    const sortedPhones = useMemo(() => sortData(dataToFix.phones, phonesSortConfig), [dataToFix.phones, phonesSortConfig]);
    
    // ***** FUNÇÃO ATUALIZADA PARA USAR SONNER *****
    const handleBatchUpdate = (count, type, updateLogic) => {
        toast.warning(`Você tem certeza que deseja padronizar ${count} ${type}?`, {
            description: 'Esta ação não pode ser desfeita.',
            action: {
                label: 'Confirmar',
                onClick: () => {
                    setIsProcessing(true);
                    const promise = new Promise(async (resolve, reject) => {
                        const { error } = await updateLogic();
                        if (error) reject(new Error(error.message));
                        else resolve(count);
                    });

                    toast.promise(promise, {
                        loading: `Padronizando ${count} ${type}...`,
                        success: (num) => {
                            fetchData();
                            setIsProcessing(false);
                            return `${num} ${type} foram padronizados com sucesso!`;
                        },
                        error: (err) => {
                            setIsProcessing(false);
                            return `Ocorreu um erro: ${err.message}`;
                        },
                    });
                }
            },
            cancel: {
                label: 'Cancelar',
                onClick: () => toast.info('Ação cancelada.')
            },
        });
    };

    const handleFormatPhones = () => handleBatchUpdate(stats.phones, 'telefones', async () => {
        const updates = dataToFix.phones.map(phone => {
            let finalNumber = (phone.telefone || '').replace(/\D/g, '');
            let countryCode = '+55';
            
            if (finalNumber.length === 11 && finalNumber.startsWith('1')) {
                countryCode = '+1';
            } else if (finalNumber.length === 10 || finalNumber.length === 11) {
                if (!finalNumber.startsWith('55')) finalNumber = `55${finalNumber}`;
                countryCode = '+55';
            }
            
            return supabase.from('telefones').update({ 
                telefone: finalNumber,
                country_code: countryCode
            }).eq('id', phone.id);
        });
        const results = await Promise.all(updates);
        return { error: results.find(res => res.error)?.error };
    });

    const handleFormatNames = () => handleBatchUpdate(stats.names, 'nomes de contatos', async () => {
        const updates = dataToFix.names.map(c => supabase.from('contatos').update({ nome: titleCase(c.nome) }).eq('id', c.id));
        const results = await Promise.all(updates); return { error: results.find(res => res.error)?.error };
    });

    const handleFormatCompanyNames = () => handleBatchUpdate(stats.company_names, 'nomes de empresas', async () => {
        const updates = dataToFix.company_names.map(c => { const updatedData = {}; if (c.razao_social) updatedData.razao_social = titleCase(c.razao_social); if (c.nome_fantasia) updatedData.nome_fantasia = titleCase(c.nome_fantasia); return supabase.from('contatos').update(updatedData).eq('id', c.id); });
        const results = await Promise.all(updates); return { error: results.find(res => res.error)?.error };
    });

    const handleSplitAndFormatPhones = () => handleBatchUpdate(stats.multi_phones, 'registros de telefone', async () => {
        for (const phone of dataToFix.multi_phones) {
            const numbers = phone.telefone.split('/').map(n => n.trim()).filter(Boolean);
            if (numbers.length > 0) {
                await supabase.from('telefones').delete().eq('id', phone.id);
                const newRecords = numbers.map(num => {
                    let finalNumber = num.replace(/\D/g, '');
                    let countryCode = '+55';

                    if (finalNumber.length === 11 && finalNumber.startsWith('1')) {
                        countryCode = '+1';
                    } else if (finalNumber.length === 10 || finalNumber.length === 11) {
                        if (!finalNumber.startsWith('55')) finalNumber = `55${finalNumber}`;
                        countryCode = '+55';
                    }

                    return { contato_id: phone.contato_id, telefone: finalNumber, country_code: countryCode, tipo: 'Importado (Separado)' };
                });
                const { error } = await supabase.from('telefones').insert(newRecords);
                if (error) return { error };
            }
        }
        return { error: null };
    });

    if (loading) { return (<div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>); }

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Ferramenta de Padronização</h1>
            <p className="text-sm text-gray-600">Use esta ferramenta para limpar e padronizar os dados da sua base de contatos.</p>
            
            {stats.multi_phones > 0 && <div className="space-y-4 p-4 border-2 border-dashed border-red-400 rounded-lg">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faObjectGroup} className="text-2xl text-red-500" /><div><h2 className="text-xl font-semibold">Telefones Múltiplos para Separar</h2><p className="text-sm text-gray-500">{stats.multi_phones} registros contêm múltiplos números e precisam ser separados.</p></div></div>
                <div className="space-y-3">
                    <div className="max-h-56 overflow-y-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium uppercase">Contato</th><th className="px-4 py-2 text-left text-xs font-medium uppercase">Registro Atual</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{dataToFix.multi_phones.slice(0, 20).map(p => (<tr key={p.id}><td className="px-4 py-2">{p.contato_nome}</td><td className="px-4 py-2 font-mono text-red-600">{p.telefone}</td></tr>))}</tbody></table></div>
                    <button onClick={handleSplitAndFormatPhones} disabled={isProcessing} className="w-full bg-red-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-3 justify-center"><FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} /> Separar e Padronizar {stats.multi_phones} Registros</button>
                </div>
            </div>}
            
            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faBuilding} className="text-2xl text-orange-500" /><div><h2 className="text-xl font-semibold">Nomes de Empresas</h2><p className="text-sm text-gray-500">{stats.company_names > 0 ? `${stats.company_names} nomes de empresas precisam de padronização.` : 'Todos os nomes de empresas estão padronizados!'}</p></div></div>
                {stats.company_names > 0 && (<div className="space-y-3"><div className="max-h-56 overflow-y-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2"><SortableHeader label="Formato Atual" sortKey="razao_social" sortConfig={companyNamesSortConfig} requestSort={(k) => requestSort(k, setCompanyNamesSortConfig)} /></th><th className="px-4 py-2"><SortableHeader label="Como vai ficar" sortKey="razao_social" sortConfig={companyNamesSortConfig} requestSort={(k) => requestSort(k, setCompanyNamesSortConfig)} /></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedCompanyNames.slice(0, 20).map(c => (<tr key={c.id}><td className="px-4 py-2 text-red-600">{c.razao_social || c.nome_fantasia}</td><td className="px-4 py-2 text-green-600">{titleCase(c.razao_social || c.nome_fantasia)}</td></tr>))}</tbody></table></div><button onClick={handleFormatCompanyNames} disabled={isProcessing} className="w-full bg-orange-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-orange-700 disabled:bg-gray-400 flex items-center gap-3 justify-center"><FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} /> Padronizar {stats.company_names} Nomes de Empresas</button></div>)}
            </div>
            
            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faUserTag} className="text-2xl text-purple-500" /><div><h2 className="text-xl font-semibold">Nomes de Contatos</h2><p className="text-sm text-gray-500">{stats.names > 0 ? `${stats.names} nomes precisam de padronização.` : 'Todos os nomes estão padronizados!'}</p></div></div>
                {stats.names > 0 && (<div className="space-y-3"><div className="max-h-56 overflow-y-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2"><SortableHeader label="Formato Atual" sortKey="nome" sortConfig={namesSortConfig} requestSort={(k) => requestSort(k, setNamesSortConfig)} /></th><th className="px-4 py-2"><SortableHeader label="Como vai ficar" sortKey="nome" sortConfig={namesSortConfig} requestSort={(k) => requestSort(k, setNamesSortConfig)} /></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedNames.slice(0, 20).map(c => (<tr key={c.id}><td className="px-4 py-2 text-red-600">{c.nome}</td><td className="px-4 py-2 text-green-600">{titleCase(c.nome)}</td></tr>))}</tbody></table></div><button onClick={handleFormatNames} disabled={isProcessing} className="w-full bg-purple-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-3 justify-center"><FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} /> Padronizar {stats.names} Nomes</button></div>)}
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faPhone} className="text-2xl text-blue-500" /><div><h2 className="text-xl font-semibold">Telefones (Formato Inválido)</h2><p className="text-sm text-gray-500">{stats.phones > 0 ? `${stats.phones} telefones precisam de padronização.` : 'Todos os telefones já estão em formato padrão.'}</p></div></div>
                {stats.phones > 0 && (<div className="space-y-3"><div className="max-h-56 overflow-y-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2"><SortableHeader label="Contato" sortKey="contato_nome" sortConfig={phonesSortConfig} requestSort={(k) => requestSort(k, setPhonesSortConfig)} /></th><th className="px-4 py-2"><SortableHeader label="Formato Atual" sortKey="telefone" sortConfig={phonesSortConfig} requestSort={(k) => requestSort(k, setPhonesSortConfig)} /></th><th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Como vai ficar</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedPhones.map(p => {
                    let finalNumber = (p.telefone || '').replace(/\D/g, '');
                    if (finalNumber.length === 11 && finalNumber.startsWith('1')) {
                        // Formato EUA, não adiciona 55
                    } else if (finalNumber.length === 10 || finalNumber.length === 11) {
                        finalNumber = `55${finalNumber}`;
                    }
                    return (<tr key={p.id}><td className="px-4 py-2">{p.contato_nome}</td><td className="px-4 py-2 text-red-600">{p.telefone}</td><td className="px-4 py-2 text-green-600">{formatPhoneNumber(finalNumber)}</td></tr>);
                })}</tbody></table></div><button onClick={handleFormatPhones} disabled={isProcessing} className="w-full bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-3 justify-center"><FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} /> Padronizar {stats.phones} Telefones</button></div>)}
            </div>
        </div>
    );
}