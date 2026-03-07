'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import Papa from 'papaparse';
import { toast } from 'sonner';
import UppyFileImporter from '@/components/ui/UppyFileImporter';

const MaterialImporter = ({ isOpen, onClose }) => {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id } = useAuth(); // BLINDADO: Pegamos a organização

    const [file, setFile] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [mappings, setMappings] = useState({});

    const dbColumns = [
        { key: 'descricao', label: 'Descrição (Obrigatória)' },
        { key: 'unidade_medida', label: 'Unidade de Medida' },
        { key: 'preco_unitario', label: 'Preço Unitário' },
        { key: 'Grupo', label: 'Grupo' },
        { key: 'Código da Composição', label: 'Código da Composição' },
        { key: 'Origem', label: 'Origem' },
    ];

    // PADRÃO OURO: Lógica de importação centralizada no useMutation
    const importMutation = useMutation({
        mutationFn: async (dataToImport) => {
            if (!organizacao_id) {
                throw new Error("Organização não identificada. A importação foi cancelada.");
            }
            // BLINDADO: Adiciona a organizacao_id em cada linha
            const securedData = dataToImport.map(row => ({
                ...row,
                organizacao_id,
            }));

            const { data, error } = await supabase.from('materiais').insert(securedData).select();

            if (error) {
                throw new Error(error.message);
            }
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(['materiais']); // Invalida a query para atualizar a lista de materiais
            resetState();
            setTimeout(() => {
                onClose();
            }, 1500);
        },
    });

    const resetState = () => {
        setFile(null);
        setHeaders([]);
        setMappings({});
    };

    const handleFileChange = (selectedFile) => {
        if (selectedFile) {
            setFile(selectedFile);
            setHeaders([]);
            setMappings({});

            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                preview: 1,
                complete: (results) => {
                    if (results.data.length > 0) {
                        const fileHeaders = Object.keys(results.data[0]);
                        setHeaders(fileHeaders);

                        const initialMappings = {};
                        fileHeaders.forEach(header => {
                            const lowerHeader = header.toLowerCase().replace(/ /g, '_');
                            const found = dbColumns.find(dbCol =>
                                dbCol.key.toLowerCase().startsWith(lowerHeader) ||
                                dbCol.label.toLowerCase().startsWith(header.toLowerCase())
                            );
                            if (found) {
                                initialMappings[header] = found.key;
                            }
                        });
                        setMappings(initialMappings);
                    } else {
                        toast.error("O arquivo CSV parece estar vazio ou em um formato não reconhecido.");
                    }
                },
            });
        }
    };

    const handleMappingChange = (csvHeader, dbColumn) => {
        setMappings((prev) => ({ ...prev, [csvHeader]: dbColumn }));
    };

    const handleImport = async () => {
        if (!file) {
            toast.warning('Por favor, selecione um arquivo CSV.');
            return;
        }

        const promise = new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const mappedDescricaoColumn = Object.keys(mappings).find(key => mappings[key] === 'descricao');

                    if (!mappedDescricaoColumn) {
                        reject(new Error("Erro de mapeamento: Vincule uma coluna ao campo 'Descrição (Obrigatória)'."));
                        return;
                    }

                    const invalidRowIndex = results.data.findIndex(row => !row[mappedDescricaoColumn] || row[mappedDescricaoColumn].trim() === '');

                    if (invalidRowIndex !== -1) {
                        reject(new Error(`Erro no arquivo: A coluna de Descrição ('${mappedDescricaoColumn}') está vazia na linha ${invalidRowIndex + 2}.`));
                        return;
                    }

                    const dataToImport = results.data.map(row => {
                        const newRow = {};
                        for (const csvHeader in mappings) {
                            const dbColumn = mappings[csvHeader];
                            if (dbColumn && row[csvHeader] !== undefined && row[csvHeader] !== null) {
                                if (dbColumn === 'preco_unitario') {
                                    const priceString = String(row[csvHeader]).replace('R$', '').replace('.', '').replace(',', '.').trim();
                                    newRow[dbColumn] = parseFloat(priceString) || null;
                                } else {
                                    newRow[dbColumn] = row[csvHeader];
                                }
                            }
                        }
                        return newRow;
                    }).filter(row => Object.keys(row).length > 0 && row.descricao);

                    if (dataToImport.length === 0) {
                        reject(new Error("Nenhuma linha válida encontrada para importação."));
                        return;
                    }

                    try {
                        const result = await importMutation.mutateAsync(dataToImport);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                },
                error: (err) => {
                    reject(new Error('Erro ao ler o arquivo CSV: ' + err.message));
                }
            });
        });

        toast.promise(promise, {
            loading: 'Importando materiais...',
            success: (data) => `${data.length} materiais importados com sucesso!`,
            error: (err) => `Erro na importação: ${err.message}`,
        });
    };


    if (!isOpen) return null;

    return (
        <UppyFileImporter
            isOpen={isOpen}
            onClose={() => { resetState(); onClose(); }}
            onFileSelected={handleFileChange}
            title="Importar Materiais de CSV"
            allowedFileTypes={['.csv']}
            note="Selecione ou arraste o arquivo CSV com a lista de materiais"
        >
            {headers.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">2. Mapeamento de Colunas</h3>
                    <p className="text-sm text-gray-600 mb-3">Vincule as colunas do seu arquivo (esquerda) com as colunas do banco de dados (direita).</p>
                    <div className="space-y-2">
                        {headers.map((header) => (
                            <div key={header} className="grid grid-cols-2 gap-4 items-center">
                                <div className="font-medium text-gray-800 bg-gray-100 p-2 rounded truncate">
                                    {header}
                                </div>
                                <select
                                    value={mappings[header] || ''}
                                    onChange={(e) => handleMappingChange(header, e.target.value)}
                                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Ignorar esta coluna</option>
                                    {dbColumns.map((col) => (
                                        <option key={col.key} value={col.key}>
                                            {col.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-end space-x-3 mt-6 border-t pt-4">
                <button
                    onClick={() => { resetState(); onClose(); }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleImport}
                    disabled={importMutation.isPending || headers.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                    {importMutation.isPending ? 'Importando...' : 'Importar Dados'}
                </button>
            </div>
        </UppyFileImporter>
    );
};

export default MaterialImporter;