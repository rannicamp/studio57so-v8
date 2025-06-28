"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../../../utils/supabase/client';
import { useLayout } from '../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWandMagicSparkles, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '../../../../utils/formatters';

export default function FormatarTelefonesPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();

    const [stats, setStats] = useState({ total: 0, needsFormatting: 0 });
    const [phonesToFix, setPhonesToFix] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        setPageTitle('Ferramenta de Padronização de Telefones');
        fetchPhoneData();
    }, [setPageTitle]);

    const fetchPhoneData = async () => {
        setLoading(true);
        setMessage('');

        const { data, error } = await supabase
            .from('telefones')
            .select('id, telefone, contato:contatos ( id, nome )');

        if (error) {
            setMessage(`Erro ao carregar telefones: ${error.message}`);
            setLoading(false);
            return;
        }

        const phonesNeedingFix = data.filter(p => {
            const digitsOnly = (p.telefone || '').replace(/\D/g, '');
            return p.telefone !== digitsOnly;
        });

        setStats({ total: data.length, needsFormatting: phonesNeedingFix.length });
        setPhonesToFix(phonesNeedingFix);
        setLoading(false);
    };

    const handleFormatAll = async () => {
        if (!window.confirm(`Você tem certeza que deseja padronizar ${stats.needsFormatting} números de telefone? Esta ação não pode ser desfeita.`)) {
            return;
        }

        setIsProcessing(true);
        setMessage('Padronizando telefones... Isso pode levar alguns segundos.');

        const updates = phonesToFix.map(phone => ({
            id: phone.id,
            telefone: (phone.telefone || '').replace(/\D/g, '')
        }));

        const { error } = await supabase.from('telefones').upsert(updates);

        if (error) {
            setMessage(`Ocorreu um erro: ${error.message}`);
        } else {
            setMessage(`${stats.needsFormatting} telefones foram padronizados com sucesso!`);
            fetchPhoneData();
        }

        setIsProcessing(false);
    };

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <p className="mt-3">Analisando sua base de contatos...</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Padronizar Números de Telefone</h1>
            <p className="text-sm text-gray-600">
                Esta ferramenta irá analisar todos os telefones cadastrados e converter aqueles com formatos antigos para o novo padrão de armazenamento, salvando apenas os números.
            </p>

            {message && (
                <div className={`p-4 rounded-md text-center font-semibold ${message.includes('Erro') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    <FontAwesomeIcon icon={message.includes('Erro') ? faExclamationCircle : faCheckCircle} className="mr-2" />
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div className="bg-gray-100 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Total de Telefones Cadastrados</p>
                    <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className={`p-4 rounded-lg ${stats.needsFormatting > 0 ? 'bg-yellow-100' : 'bg-green-100'}`}>
                    <p className="text-sm text-gray-500">Telefones que Precisam de Padronização</p>
                    <p className="text-3xl font-bold">{stats.needsFormatting}</p>
                </div>
            </div>

            {stats.needsFormatting > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-3">Amostra dos Telefones a Serem Corrigidos:</h2>
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Contato</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Formato Atual</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Novo Formato (Exibição)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {phonesToFix.slice(0, 10).map(phone => (
                                    <tr key={phone.id}>
                                        <td className="px-4 py-2 whitespace-nowrap">{phone.contato?.nome || 'Contato não encontrado'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap font-mono text-red-600">{phone.telefone}</td>
                                        <td className="px-4 py-2 whitespace-nowrap font-mono text-green-600">{formatPhoneNumber(phone.telefone)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <div className="mt-6 text-center">
                        <button
                            onClick={handleFormatAll}
                            disabled={isProcessing}
                            className="bg-purple-600 text-white px-8 py-3 rounded-md shadow-sm hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-3 justify-center w-full md:w-auto mx-auto"
                        >
                            <FontAwesomeIcon icon={isProcessing ? faSpinner : faWandMagicSparkles} spin={isProcessing} />
                            {isProcessing ? 'Processando...' : `Padronizar ${stats.needsFormatting} Telefones Agora`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}