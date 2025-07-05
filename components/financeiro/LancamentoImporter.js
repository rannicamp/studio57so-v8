"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faFileCsv, faDownload } from '@fortawesome/free-solid-svg-icons';
import Papa from 'papaparse';

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
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
        setFile(selectedFile);
        setMessage(''); setErrorDetails([]); setHeaders([]); setMappings({});
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
                } else { setMessage("Arquivo CSV vazio ou em formato inválido."); }
            },
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
    if (!file) { setMessage('Nenhum arquivo selecionado.'); return; }
    setIsProcessing(true); setMessage('Analisando arquivo...'); setErrorDetails([]);

    const requiredFields = ['data_transacao', 'descricao', 'valor', 'tipo', 'conta_id'];
    const mappedFields = Object.values(mappings);
    const missingFields = requiredFields.filter(rf => !mappedFields.includes(rf));

    if (missingFields.length > 0) {
        setMessage(`Erro: Mapeie as colunas obrigatórias: ${missingFields.join(', ')}`);
        setIsProcessing(false);
        return;
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const dataToImport = results.data.map(row => {
                const newRow = {};
                for (const csvHeader in mappings) {
                    const dbColumn = mappings[csvHeader];
                    if (dbColumn && row[csvHeader] !== undefined && row[csvHeader] !== null) newRow[dbColumn] = row[csvHeader];
                }
                return newRow;
            }).filter(row => row.descricao && row.valor);

            if (dataToImport.length === 0) {
                setMessage('Nenhuma linha válida para importar.');
                setIsProcessing(false);
                return;
            }

            setMessage(`Arquivo válido. Importando ${dataToImport.length} lançamentos...`);
            
            // Aqui, estamos assumindo que os IDs são fornecidos diretamente.
            // Uma versão mais avançada poderia buscar os IDs a partir dos nomes.
            const { data, error } = await supabase.from('lancamentos').insert(dataToImport).select();

            if (error) {
                setMessage(`Erro ao importar: ${error.message}`);
                setErrorDetails([error.details]);
            } else {
                 setMessage(`${data.length} lançamentos importados com sucesso!`);
                 onImportComplete();
                 setTimeout(() => onClose(), 2000);
            }
            setIsProcessing(false);
        },
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
            {message && <p className={`text-sm font-semibold p-3 rounded-md mb-4 ${errorDetails.length > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message}</p>}
            {errorDetails.length > 0 && (
                <div className="max-h-32 overflow-y-auto p-2 border border-red-200 bg-red-50 rounded-md text-sm">
                    <p className="font-bold mb-1">Detalhes dos erros:</p>
                    <ul className="list-disc list-inside"> {errorDetails.map((err, i) => <li key={i}>{err}</li>)} </ul>
                </div>
            )}
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"> Cancelar </button>
              <button onClick={processAndImport} disabled={isProcessing || headers.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
                {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
                {isProcessing ? 'Importando...' : 'Importar Dados'}
              </button>
            </div>
        </div>
    </div>
  );
}