'use client';

import { useState } from 'react';
import Papa from 'papaparse';

const MaterialImporter = ({ isOpen, onClose }) => {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Atualizamos a lista de colunas: 'nome' foi removido e 'descricao' agora é obrigatória.
  const dbColumns = [
    { key: 'descricao', label: 'Descrição (Obrigatória)' },
    { key: 'unidade_medida', label: 'Unidade de Medida' },
    { key: 'preco_unitario', label: 'Preço Unitário' },
    { key: 'Grupo', label: 'Grupo' },
    { key: 'Código da Composição', label: 'Código da Composição' },
    { key: 'Origem', label: 'Origem' },
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setSuccessMessage('');
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
              
              // Mapeamento automático inteligente
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
              setError("O arquivo CSV parece estar vazio ou em um formato não reconhecido.");
          }
        },
      });
    }
  };

  const handleMappingChange = (csvHeader, dbColumn) => {
    setMappings((prev) => ({
      ...prev,
      [csvHeader]: dbColumn,
    }));
  };
  
  const handleImport = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo CSV.');
      return;
    }

    setIsImporting(true);
    setError('');
    setSuccessMessage('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        
        // --- VALIDAÇÃO ATUALIZADA PARA 'DESCRICAO' ---
        const mappedDescricaoColumn = Object.keys(mappings).find(key => mappings[key] === 'descricao');

        if (!mappedDescricaoColumn) {
            setError("Erro de mapeamento: Por favor, vincule uma coluna do seu arquivo ao campo 'Descrição (Obrigatória)'.");
            setIsImporting(false);
            return;
        }

        const invalidRowIndex = results.data.findIndex(row => !row[mappedDescricaoColumn] || row[mappedDescricaoColumn].trim() === '');
        
        if (invalidRowIndex !== -1) {
            setError(`Erro no arquivo: A coluna de Descrição ('${mappedDescricaoColumn}') está vazia na linha ${invalidRowIndex + 2}. A descrição do material é obrigatória. Por favor, corrija o arquivo e tente novamente.`);
            setIsImporting(false);
            return;
        }
        // --- FIM DA VALIDAÇÃO ---

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

        try {
          const response = await fetch('/api/materiais/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToImport),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Ocorreu um erro na importação.');
          }

          setSuccessMessage(`${result.count} materiais foram importados com sucesso!`);
          setFile(null);
          setHeaders([]);

        } catch (err) {
          setError(err.message);
        } finally {
          setIsImporting(false);
        }
      },
      error: (err) => {
        setError('Erro ao ler o arquivo CSV: ' + err.message);
        setIsImporting(false);
      }
    });
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Importar Materiais de CSV</h2>
        
        <div className="mb-4">
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o arquivo CSV
          </label>
          <input 
            id="file-upload"
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {headers.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Mapeamento de Colunas</h3>
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

        {error && <p className="text-red-500 text-sm font-semibold p-3 bg-red-50 rounded-md mb-4">{error}</p>}
        {successMessage && <p className="text-green-500 text-sm font-semibold p-3 bg-green-50 rounded-md mb-4">{successMessage}</p>}

        <div className="flex justify-end space-x-3 mt-6">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button 
            onClick={handleImport}
            disabled={isImporting || headers.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isImporting ? 'Importando...' : 'Importar Dados'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialImporter;