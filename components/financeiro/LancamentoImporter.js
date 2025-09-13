"use client";

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faDownload } from '@fortawesome/free-solid-svg-icons';
import Papa from 'papaparse';
import { toast } from 'sonner';

const dbColumns = [
    { key: 'data_transacao', label: 'Data da Transação (AAAA-MM-DD) *' },
    { key: 'descricao', label: 'Descrição *' },
    { key: 'valor', label: 'Valor * (Use formato 1234.56)' },
    { key: 'tipo', label: 'Tipo (Receita/Despesa) *' },
    { key: 'conta_id', label: 'ID da Conta *' },
    { key: 'categoria_id', label: 'ID da Categoria' },
    { key: 'favorecido_contato_id', label: 'ID do Favorecido' },
    { key: 'status', label: 'Status (Pendente/Pago)' },
    { key: 'data_vencimento', label: 'Data de Vencimento (AAAA-MM-DD)' },
    { key: 'observacao', label: 'Observação' },
];

const CSV_MODEL_HEADER = dbColumns.map(c => c.key).join(';');

export default function LancamentoImporter({ isOpen, onClose, onImportComplete }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id } = useAuth(); // Pegamos o organizacao_id do contexto

    const [file, setFile] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [mappings, setMappings] = useState({});

    // PADRÃO OURO: Usando useMutation para a lógica de importação
    const importMutation = useMutation({
        mutationFn: async (dataToImport) => {
            if (!user || !organizacao_id) {
                throw new Error("Usuário ou organização não identificada. A importação foi cancelada.");
            }

            // BLINDADO: Adiciona a organizacao_id a cada linha a ser importada
            const securedData = dataToImport.map(row => ({
                ...row,
                organizacao_id,
                criado_por_usuario_id: user.id
            }));

            const { data, error } = await supabase.from('lancamentos').insert(securedData).select();

            if (error) {
                throw new Error(error.message);
            }

            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(['lancamentos']); // Atualiza a lista de lançamentos na outra tela
            if (onImportComplete) onImportComplete();
            setTimeout(() => {
                resetState();
                onClose();
            }, 1500);
        },
    });

    const resetState = () => {
        setFile(null);
        setHeaders([]);
        setMappings({});
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setHeaders([]);
            setMappings({});
            Papa.parse(selectedFile, {
                header: true, skipEmptyLines: true, preview: 1,
                complete: (results) => {
                    if (results.data.length > 0) {
                        const fileHeaders = Object.keys(results.data[0]);
                        setHeaders(fileHeaders);
                        const initialMappings = {};
                        fileHeaders.forEach(header => {
                            const cleanHeader = header.toLowerCase().replace(/ /g, '_');
                            const found = dbColumns.find(dbCol => dbCol.key === cleanHeader);
                            if (found) initialMappings[header] = found.key;
                        });
                        setMappings(initialMappings);
                    } else {
                        toast.error("Arquivo CSV vazio ou em formato inválido.");
                    }
                },
                error: (error) => {
                    toast.error(`Erro ao ler o arquivo: ${error.message}`);
                }
            });
        }
    };

    const handleMappingChange = (csvHeader, dbColumn) => { setMappings((prev) => ({ ...prev, [csvHeader]: dbColumn })); };
    
    const handleDownloadTemplate = () => {
        const blob = new Blob(["\uFEFF" + CSV_MODEL_HEADER], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); const url = URL.createObjectURL(blob);
        link.setAttribute("href", url); link.setAttribute("download", "modelo_importacao_lancamentos.csv");
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const processAndImport = async () => {
        if (!file) {
            toast.warning('Nenhum arquivo selecionado.');
            return;
        }

        const requiredFields = ['data_transacao', 'descricao', 'valor', 'tipo', 'conta_id'];
        const mappedFields = Object.values(mappings);
        const missingFields = requiredFields.filter(rf => !mappedFields.includes(rf));

        if (missingFields.length > 0) {
            toast.error(`Mapeie as colunas obrigatórias: ${missingFields.join(', ')}`);
            return;
        }

        const promise = new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const dataToImport = results.data.map(row => {
                        const newRow = {};
                        for (const csvHeader in mappings) {
                            const dbColumn = mappings[csvHeader];
                            if (dbColumn && row[csvHeader] !== undefined && row[csvHeader] !== null && row[csvHeader] !== '') {
                                newRow[dbColumn] = row[csvHeader];
                            }
                        }
                        return newRow;
                    }).filter(row => row.descricao && row.valor);

                    if (dataToImport.length === 0) {
                        reject(new Error('Nenhuma linha válida para importar. Verifique se as colunas obrigatórias estão preenchidas.'));
                        return;
                    }
                    
                    try {
                        const result = await importMutation.mutateAsync(dataToImport);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                },
                error: (error) => reject(new Error(`Erro ao processar o CSV: ${error.message}`)),
            });
        });

        toast.promise(promise, {
            loading: 'Processando e importando dados...',
            success: (data) => `${data.length} lançamentos importados com sucesso!`,
            error: (err) => `Erro na importação: ${err.message}`,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Importar Lançamentos via CSV</h2>
                <div className="mb-4">
                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">1. Selecione o arquivo CSV</label>
                    <div className="flex gap-4">
                        <input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100" />
                        <button onClick={handleDownloadTemplate} className="flex-shrink-0 bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 text-sm"> <FontAwesomeIcon icon={faDownload} /> Modelo </button>
                    </div>
                </div>
                {headers.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">2. Mapeamento de Colunas</h3>
                        <p className="text-sm text-gray-600 mb-3">Vincule as colunas do seu arquivo (esquerda) com as colunas do sistema (direita). Campos com * são obrigatórios.</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {headers.map((header) => (
                                <div key={header} className="grid grid-cols-2 gap-4 items-center">
                                    <div className="font-medium text-gray-800 bg-gray-100 p-2 rounded truncate"> {header} </div>
                                    <select value={mappings[header] || ''} onChange={(e) => handleMappingChange(header, e.target.value)} className="block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                        <option value="">Ignorar esta coluna</option>
                                        {dbColumns.map((col) => ( <option key={col.key} value={col.key}> {col.label} </option> ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={() => { resetState(); onClose(); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"> Cancelar </button>
                    <button onClick={processAndImport} disabled={importMutation.isPending || headers.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
                        {importMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
                        {importMutation.isPending ? 'Importando...' : 'Importar Dados'}
                    </button>
                </div>
            </div>
        </div>
    );
}