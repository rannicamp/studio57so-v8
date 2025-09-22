//components\financeiro\LancamentoImporter.js
"use client";

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faDownload, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import Papa from 'papaparse';
import { toast } from 'sonner';

const dbColumns = [
    { key: 'data_transacao', label: 'Data da Transação (DD/MM/AAAA) *' },
    { key: 'descricao', label: 'Descrição *' },
    { key: 'valor', label: 'Valor * (Ex: 1.234,56)' },
    { key: 'tipo', label: 'Tipo (Receita/Despesa) *' },
    { key: 'conta_id', label: 'ID da Conta *' },
    { key: 'categoria_id', label: 'ID da Categoria' },
    { key: 'favorecido_contato_id', label: 'ID do Favorecido/Contato' },
    { key: 'status', label: 'Status (Pendente/Pago)' },
    { key: 'data_vencimento', label: 'Data de Vencimento (DD/MM/AAAA)' },
    { key: 'observacao', label: 'Observação' },
];

const CSV_MODEL_HEADER = dbColumns.map(c => c.key).join(';');

const StatusIndicator = ({ status, message }) => {
    if (status === 'success') return <span className="text-green-600 flex items-center gap-1 text-xs"><FontAwesomeIcon icon={faCheckCircle} /> Pronto</span>;
    if (status === 'error') return <span className="text-red-600 flex items-center gap-1 text-xs" title={message}><FontAwesomeIcon icon={faExclamationTriangle} /> Erro</span>;
    return null;
};

const fetchValidationData = async (organizacao_id) => {
    if (!organizacao_id) return null;
    const supabase = createClient();
    const [contasRes, categoriasRes, contatosRes] = await Promise.all([
        supabase.from('contas_financeiras').select('id').eq('organizacao_id', organizacao_id),
        supabase.from('categorias_financeiras').select('id').eq('organizacao_id', organizacao_id),
        supabase.from('contatos').select('id').eq('organizacao_id', organizacao_id),
    ]);

    if (contasRes.error || categoriasRes.error || contatosRes.error) {
        throw new Error('Falha ao buscar dados de validação (contas, categorias).');
    }
    return {
        contas: new Set(contasRes.data.map(c => c.id.toString())),
        categorias: new Set(categoriasRes.data.map(cat => cat.id.toString())),
        contatos: new Set(contatosRes.data.map(con => con.id.toString())),
    };
};

const cleanAndFormatRow = (row) => {
    const cleanedRow = { ...row };
    if (cleanedRow.valor) {
        let valorStr = cleanedRow.valor.toString().replace(/R\$|\s/g, '').replace(/\./g, '').replace(/,/g, '.');
        const valorNum = parseFloat(valorStr);
        if (!isNaN(valorNum)) cleanedRow.valor = valorNum;
        else return { ...cleanedRow, isValid: false, error: 'Valor inválido.' };
    }
    ['data_transacao', 'data_vencimento'].forEach(dateField => {
        if (cleanedRow[dateField]) {
            const parts = cleanedRow[dateField].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (parts) cleanedRow[dateField] = `${parts[3]}-${parts[2]}-${parts[1]}`;
        }
    });
    if (cleanedRow.tipo) {
        const tipoLower = cleanedRow.tipo.toLowerCase();
        if (['receita', 'despesa'].includes(tipoLower)) {
            cleanedRow.tipo = tipoLower.charAt(0).toUpperCase() + tipoLower.slice(1);
        } else {
            return { ...cleanedRow, isValid: false, error: 'Tipo deve ser "Receita" ou "Despesa".' };
        }
    }
    return { ...cleanedRow, isValid: true };
};

export default function LancamentoImporter({ isOpen, onClose, onImportComplete }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id } = useAuth();
    const [file, setFile] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [processedRecords, setProcessedRecords] = useState([]);
    const [summary, setSummary] = useState({ ready: 0, errors: 0 });

    // =================================================================================
    // MUDANÇA 1: CARREGANDO A "MEMÓRIA"
    // O PORQUÊ: Ao iniciar o componente, tentamos carregar os mapeamentos salvos
    // na "agenda" do navegador (localStorage).
    // =================================================================================
    const [mappings, setMappings] = useState(() => {
        try {
            const savedMappings = localStorage.getItem('lancamentoImporterMappings');
            return savedMappings ? JSON.parse(savedMappings) : {};
        } catch (error) {
            console.error("Falha ao ler mapeamentos do localStorage", error);
            return {};
        }
    });

    // =================================================================================
    // MUDANÇA 2: SALVANDO NA "MEMÓRIA" (APRENDENDO)
    // O PORQUÊ: Toda vez que o usuário altera um mapeamento, este `useEffect`
    // salva a nova lista de mapeamentos na "agenda", para que seja lembrada depois.
    // =================================================================================
    useEffect(() => {
        try {
            localStorage.setItem('lancamentoImporterMappings', JSON.stringify(mappings));
        } catch (error) {
            console.error("Falha ao salvar mapeamentos no localStorage", error);
        }
    }, [mappings]);

    const { data: validationData, isLoading: isLoadingValidation } = useQuery({
        queryKey: ['importerValidationData', organizacao_id],
        queryFn: () => fetchValidationData(organizacao_id),
        enabled: !!organizacao_id && isOpen,
    });

    const importMutation = useMutation({
        mutationFn: async (records) => {
            if (!user || !organizacao_id) throw new Error("Usuário ou organização não identificada.");
            const dataToInsert = records.map(rec => {
                const { status, error_message, line, ...dbRow } = rec;
                return { ...dbRow, organizacao_id: organizacao_id, criado_por_usuario_id: user.id };
            });
            const { data, error } = await supabase.from('lancamentos').insert(dataToInsert).select();
            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
            toast.success(`${data.length} lançamentos importados com sucesso!`);
            resetState();
            if (onImportComplete) onImportComplete();
            onClose();
        },
        onError: (error) => toast.error(`Erro ao importar: ${error.message}`),
    });

    const resetState = () => {
        setFile(null);
        setHeaders([]);
        setProcessedRecords([]);
        setSummary({ ready: 0, errors: 0 });
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setHeaders([]);
        setProcessedRecords([]);
        setSummary({ ready: 0, errors: 0 });

        Papa.parse(selectedFile, {
            header: true, skipEmptyLines: true, preview: 1,
            complete: (results) => {
                if (results.data.length > 0) {
                    const fileHeaders = Object.keys(results.data[0]);
                    setHeaders(fileHeaders);
                    
                    // =================================================================================
                    // MUDANÇA 3: APLICANDO A "MEMÓRIA"
                    // O PORQUÊ: Após ler o novo arquivo, ele verifica a "memória" e já
                    // preenche os mapeamentos que ele "lembra", poupando seu trabalho.
                    // Ele também tenta adivinhar os novos, como já fazia.
                    // =================================================================================
                    setMappings(prevMappings => {
                        const newMappings = { ...prevMappings };
                        fileHeaders.forEach(header => {
                            if (!newMappings[header]) { // Se não houver um mapeamento salvo para esta coluna
                                const found = dbColumns.find(dbCol => dbCol.key.toLowerCase() === header.trim().toLowerCase().replace(/ /g, '_'));
                                if (found) {
                                    newMappings[header] = found.key; // Tenta adivinhar
                                }
                            }
                        });
                        return newMappings;
                    });

                } else {
                    toast.error("Arquivo CSV vazio ou em formato inválido.");
                }
            },
            error: (error) => toast.error(`Erro ao ler o arquivo: ${error.message}`),
        });
    };

    const processFile = () => {
        if (!file) return toast.warning('Nenhum arquivo selecionado.');
        if (!validationData) return toast.error('Dados de validação ainda não carregaram. Tente novamente em alguns segundos.');
        
        const requiredFields = ['data_transacao', 'descricao', 'valor', 'tipo', 'conta_id'];
        const mappedFields = Object.values(mappings);
        const missingFields = requiredFields.filter(rf => !mappedFields.includes(rf));
        if (missingFields.length > 0) return toast.error(`Mapeie as colunas obrigatórias: ${missingFields.join(', ')}`);

        toast.info("Processando e validando arquivo...");

        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: (results) => {
                const allRecords = results.data.map((row, index) => {
                    const mappedRow = { line: index + 2 };
                    for (const csvHeader in mappings) {
                        const dbColumn = mappings[csvHeader];
                        if (dbColumn && row[csvHeader]) mappedRow[dbColumn] = row[csvHeader];
                    }

                    const { isValid, error: formatError, ...formattedRow } = cleanAndFormatRow(mappedRow);
                    let error_message = null;

                    if (!isValid) error_message = formatError;
                    else if (!formattedRow.data_transacao || !formattedRow.descricao || !formattedRow.valor || !formattedRow.tipo || !formattedRow.conta_id) error_message = "Faltam campos obrigatórios.";
                    else if (validationData) {
                        if (formattedRow.conta_id && !validationData.contas.has(formattedRow.conta_id.toString())) error_message = `ID da Conta "${formattedRow.conta_id}" não existe.`;
                        else if (formattedRow.categoria_id && !validationData.categorias.has(formattedRow.categoria_id.toString())) error_message = `ID da Categoria "${formattedRow.categoria_id}" não existe.`;
                        else if (formattedRow.favorecido_contato_id && !validationData.contatos.has(formattedRow.favorecido_contato_id.toString())) error_message = `ID do Favorecido "${formattedRow.favorecido_contato_id}" não existe.`;
                    }
                    
                    return { ...formattedRow, status: error_message ? 'error' : 'success', error_message };
                });

                setProcessedRecords(allRecords);
                const readyCount = allRecords.filter(r => r.status === 'success').length;
                const errorCount = allRecords.length - readyCount;
                setSummary({ ready: readyCount, errors: errorCount });
                toast.success(`Arquivo processado: ${readyCount} registros prontos, ${errorCount} com erros.`);
            },
            error: (error) => toast.error(`Erro ao processar o CSV: ${error.message}`),
        });
    };
    
    const handleImport = () => {
        const recordsToInsert = processedRecords.filter(r => r.status === 'success');
        if (recordsToInsert.length === 0) return toast.error('Nenhum registro válido para importar.');
        importMutation.mutate(recordsToInsert);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <h2 className="text-xl font-bold mb-4">Importar Lançamentos via CSV</h2>
                
                {isLoadingValidation && <div className="text-center p-4"> <FontAwesomeIcon icon={faSpinner} spin /> Carregando dados de validação...</div>}
                
                {!isLoadingValidation && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div>
                                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">1. Selecione o arquivo</label>
                                <div className="flex gap-4">
                                    <input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100" />
                                    <button onClick={handleDownloadTemplate} className="flex-shrink-0 bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 text-sm"> <FontAwesomeIcon icon={faDownload} /> Modelo </button>
                                </div>
                            </div>
                            {headers.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">2. Mapeamento de Colunas</h3>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 border p-2 rounded-md">
                                        {headers.map((header) => (
                                            <div key={header} className="grid grid-cols-2 gap-4 items-center">
                                                <div className="font-medium text-gray-800 bg-gray-100 p-2 rounded truncate text-sm"> {header} </div>
                                                <select value={mappings[header] || ''} onChange={(e) => setMappings(prev => ({...prev, [header]: e.target.value}))} className="block w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm">
                                                    <option value="">Ignorar esta coluna</option>
                                                    {dbColumns.map((col) => ( <option key={col.key} value={col.key}> {col.label} </option> ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {headers.length > 0 && <button onClick={processFile} className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 mb-4">Processar e Validar Arquivo</button>}

                        {processedRecords.length > 0 && (
                            <div className="flex-grow overflow-hidden flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800 mb-2">3. Pré-visualização</h3>
                                <div className="flex-grow overflow-y-auto border rounded-md">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-2 py-2 text-left text-xs font-medium uppercase">Descrição</th>
                                                <th className="px-2 py-2 text-left text-xs font-medium uppercase">Valor</th>
                                                <th className="px-2 py-2 text-left text-xs font-medium uppercase">Data</th>
                                                <th className="px-2 py-2 text-left text-xs font-medium uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {processedRecords.map((rec, index) => (
                                                <tr key={index} className={rec.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                                    <td className="px-2 py-2 text-sm">{rec.descricao || 'N/A'}</td>
                                                    <td className="px-2 py-2 text-sm">{rec.valor || 'N/A'}</td>
                                                    <td className="px-2 py-2 text-sm">{rec.data_transacao || 'N/A'}</td>
                                                    <td className="px-2 py-2 text-sm"><StatusIndicator status={rec.status} message={rec.error_message} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                            <button onClick={() => { resetState(); onClose(); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"> Cancelar </button>
                            <button onClick={handleImport} disabled={importMutation.isPending || summary.ready === 0} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">
                                {importMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
                                {importMutation.isPending ? 'Importando...' : `Importar ${summary.ready} Válidos`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}