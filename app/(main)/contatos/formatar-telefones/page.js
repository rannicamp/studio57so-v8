"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../../utils/supabase/client';
import { useLayout } from '../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWandMagicSparkles, faCheckCircle, faExclamationCircle, faPhone, faUserTag, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '../../../../utils/formatters';

// Função para padronizar nomes (sem alteração)
const titleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    const exceptions = ['de', 'da', 'do', 'dos', 'das', 'e'];
    if (exceptions.includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

export default function PadronizacaoPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();

    // Estado atualizado para incluir nomes de empresas
    const [stats, setStats] = useState({ phones: 0, names: 0, company_names: 0 });
    const [dataToFix, setDataToFix] = useState({ phones: [], names: [], company_names: [] });
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setMessage('');

        // Busca agora inclui razao_social e nome_fantasia
        const { data, error } = await supabase
            .from('contatos')
            .select('id, nome, razao_social, nome_fantasia, telefones ( id, telefone )');

        if (error) {
            setMessage(`Erro ao carregar contatos: ${error.message}`);
            setLoading(false);
            return;
        }

        // Lógica para telefones (sem alteração)
        const phonesNeedingFix = data.flatMap(c => 
            c.telefones.filter(p => {
                if (!p.telefone) return false;
                const digitsOnly = p.telefone.replace(/\D/g, '');
                return p.telefone !== digitsOnly || (digitsOnly.length === 10 || digitsOnly.length === 11);
            }).map(p => ({ ...p, contato_nome: c.nome || c.razao_social }))
        );

        // Lógica para nomes de pessoas (sem alteração)
        const namesNeedingFix = data.filter(c => c.nome && c.nome !== titleCase(c.nome));

        // ***** INÍCIO DA NOVA LÓGICA *****
        // Lógica para nomes de empresas
        const companyNamesNeedingFix = data.filter(c => 
            (c.razao_social && c.razao_social !== titleCase(c.razao_social)) ||
            (c.nome_fantasia && c.nome_fantasia !== titleCase(c.nome_fantasia))
        );
        // ***** FIM DA NOVA LÓGICA *****

        setStats({ phones: phonesNeedingFix.length, names: namesNeedingFix.length, company_names: companyNamesNeedingFix.length });
        setDataToFix({ phones: phonesNeedingFix, names: namesNeedingFix, company_names: companyNamesNeedingFix });
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        setPageTitle('Padronização de Contatos');
        fetchData();
    }, [setPageTitle, fetchData]);
    
    const handleBatchUpdate = async (type, updateLogic, successMessage) => {
        const count = stats[type];
        if (!window.confirm(`Você tem certeza que deseja padronizar ${count} ${type === 'phones' ? 'números' : 'nomes'}? Esta ação não pode ser desfeita.`)) return;
        setIsProcessing(true);
        setMessage(`Padronizando...`);
        const { error } = await updateLogic();
        if (error) { setMessage(`Ocorreu um erro: ${error.message}`); } 
        else { setMessage(successMessage); await fetchData(); }
        setIsProcessing(false);
    };

    const handleFormatPhones = () => {
        const updateLogic = async () => {
            const updates = dataToFix.phones.map(phone => {
                let finalNumber = (phone.telefone || '').replace(/\D/g, '');
                if (finalNumber.length === 10 || finalNumber.length === 11) finalNumber = `55${finalNumber}`;
                return supabase.from('telefones').update({ telefone: finalNumber }).eq('id', phone.id);
            });
            const results = await Promise.all(updates);
            return { error: results.find(res => res.error)?.error };
        };
        handleBatchUpdate('phones', updateLogic, `${stats.phones} telefones foram padronizados com sucesso!`);
    };

    const handleFormatNames = () => {
        const updateLogic = async () => {
            const updates = dataToFix.names.map(c => supabase.from('contatos').update({ nome: titleCase(c.nome) }).eq('id', c.id));
            const results = await Promise.all(updates);
            return { error: results.find(res => res.error)?.error };
        };
        handleBatchUpdate('names', updateLogic, `${stats.names} nomes de contatos foram padronizados com sucesso!`);
    };

    // ***** INÍCIO DA NOVA FUNÇÃO *****
    const handleFormatCompanyNames = () => {
        const updateLogic = async () => {
            const updates = dataToFix.company_names.map(c => {
                const updatedData = {};
                if (c.razao_social) updatedData.razao_social = titleCase(c.razao_social);
                if (c.nome_fantasia) updatedData.nome_fantasia = titleCase(c.nome_fantasia);
                return supabase.from('contatos').update(updatedData).eq('id', c.id);
            });
            const results = await Promise.all(updates);
            return { error: results.find(res => res.error)?.error };
        };
        handleBatchUpdate('company_names', updateLogic, `${stats.company_names} nomes de empresas foram padronizados com sucesso!`);
    };
    // ***** FIM DA NOVA FUNÇÃO *****

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <p className="mt-3">Analisando sua base de contatos...</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Ferramenta de Padronização</h1>
            <p className="text-sm text-gray-600"> Use esta ferramenta para limpar e padronizar os dados da sua base de contatos. </p>
            {message && (<div className={`p-4 rounded-md text-center font-semibold ${message.includes('Erro') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}> <FontAwesomeIcon icon={message.includes('Erro') ? faExclamationCircle : faCheckCircle} className="mr-2" /> {message} </div>)}
            
            {/* NOVA SEÇÃO PARA NOMES DE EMPRESAS */}
            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                    <FontAwesomeIcon icon={faBuilding} className="text-2xl text-orange-500" />
                    <div>
                        <h2 className="text-xl font-semibold">Nomes de Empresas</h2>
                        <p className="text-sm text-gray-500">{stats.company_names > 0 ? `${stats.company_names} nomes de empresas precisam de padronização.` : 'Todos os nomes de empresas estão padronizados!'}</p>
                    </div>
                </div>
                {stats.company_names > 0 && (
                    <div className="space-y-3">
                         <div className="max-h-56 overflow-y-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium uppercase">Formato Atual</th><th className="px-4 py-2 text-left text-xs font-medium uppercase">Como vai ficar</th></tr></thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {dataToFix.company_names.slice(0, 20).map(contact => (
                                        <tr key={contact.id}>
                                            <td className="px-4 py-2 whitespace-nowrap font-mono text-red-600">{contact.razao_social || contact.nome_fantasia}</td>
                                            <td className="px-4 py-2 whitespace-nowrap font-mono text-green-600">{titleCase(contact.razao_social || contact.nome_fantasia)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button onClick={handleFormatCompanyNames} disabled={isProcessing} className="w-full bg-orange-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-orange-700 disabled:bg-gray-400 flex items-center gap-3 justify-center">
                            <FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} /> Padronizar {stats.company_names} Nomes de Empresas
                        </button>
                    </div>
                )}
            </div>
            
            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faUserTag} className="text-2xl text-purple-500" /><div><h2 className="text-xl font-semibold">Nomes de Contatos</h2><p className="text-sm text-gray-500">{stats.names > 0 ? `${stats.names} nomes precisam de padronização.` : 'Todos os nomes estão padronizados!'}</p></div></div>
                {stats.names > 0 && (<div className="space-y-3"><div className="max-h-56 overflow-y-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium uppercase">Formato Atual</th><th className="px-4 py-2 text-left text-xs font-medium uppercase">Como vai ficar</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{dataToFix.names.slice(0, 20).map(contact => (<tr key={contact.id}><td className="px-4 py-2 whitespace-nowrap font-mono text-red-600">{contact.nome}</td><td className="px-4 py-2 whitespace-nowrap font-mono text-green-600">{titleCase(contact.nome)}</td></tr>))}</tbody></table></div><button onClick={handleFormatNames} disabled={isProcessing} className="w-full bg-purple-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-3 justify-center"><FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} /> Padronizar {stats.names} Nomes</button></div>)}
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-4"><FontAwesomeIcon icon={faPhone} className="text-2xl text-blue-500" /><div><h2 className="text-xl font-semibold">Telefones</h2><p className="text-sm text-gray-500">{stats.phones > 0 ? `${stats.phones} telefones precisam de padronização.` : 'Todos os telefones estão padronizados!'}</p></div></div>
                {stats.phones > 0 && (<div className="space-y-3"><div className="max-h-56 overflow-y-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium uppercase">Contato</th><th className="px-4 py-2 text-left text-xs font-medium uppercase">Formato Atual</th><th className="px-4 py-2 text-left text-xs font-medium uppercase">Como vai ficar</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{dataToFix.phones.slice(0, 20).map(phone => (<tr key={phone.id}><td className="px-4 py-2 whitespace-nowrap">{phone.contato_nome}</td><td className="px-4 py-2 whitespace-nowrap font-mono text-red-600">{phone.telefone}</td><td className="px-4 py-2 whitespace-nowrap font-mono text-green-600">{formatPhoneNumber((phone.telefone.length === 10 || phone.telefone.length === 11) ? `55${phone.telefone}` : phone.telefone )}</td></tr>))}</tbody></table></div><button onClick={handleFormatPhones} disabled={isProcessing} className="w-full bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-3 justify-center"><FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} /> Padronizar {stats.phones} Telefones</button></div>)}
            </div>
        </div>
    );
}