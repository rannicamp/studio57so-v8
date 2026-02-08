// components/ContatoImporter.js

"use client";

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // <--- 1. IMPORTAMOS O 'useAuth'
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faFileCsv, faDownload } from '@fortawesome/free-solid-svg-icons';
import Papa from 'papaparse';
import { toast } from 'sonner'; // <-- Importa o toast para notificações

const dbColumns = [
    { key: 'personalidade_juridica', label: 'Personalidade Jurídica (PF/PJ)' },
    { key: 'nome', label: 'Nome' },
    { key: 'tipo_contato', label: 'Tipo de Contato (Obrigatório)' },
    { key: 'status', label: 'Status' },
    // Dados PJ
    { key: 'razao_social', label: 'Razão Social' },
    { key: 'nome_fantasia', label: 'Nome Fantasia' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'inscricao_estadual', label: 'Inscrição Estadual' },
    { key: 'inscricao_municipal', label: 'Inscrição Municipal' },
    { key: 'responsavel_legal', label: 'Responsável Legal' },
    { key: 'data_fundacao', label: 'Data de Fundação (AAAA-MM-DD)' },
    { key: 'pessoa_contato', label: 'Pessoa de Contato' },
    // Dados PF
    { key: 'cpf', label: 'CPF' },
    { key: 'rg', label: 'RG' },
    { key: 'nacionalidade', label: 'Nacionalidade' },
    { key: 'birth_date', label: 'Data de Nascimento (AAAA-MM-DD)' },
    { key: 'estado_civil', label: 'Estado Civil' },
    { key: 'cargo', label: 'Cargo/Profissão' },
    { key: 'tipo_servico_produto', label: 'Tipo de Serviço/Produto' },
    // Contato
    { key: 'telefones', label: 'Telefones (separar com ;)' },
    { key: 'emails', label: 'Emails (separar com ;)' },
    // Endereço
    { key: 'cep', label: 'CEP' },
    { key: 'address_street', label: 'Endereço (Rua)' },
    { key: 'address_number', label: 'Endereço (Número)' },
    { key: 'address_complement', label: 'Endereço (Complemento)' },
    { key: 'neighborhood', label: 'Endereço (Bairro)' },
    { key: 'city', label: 'Endereço (Cidade)' },
    { key: 'state', label: 'Endereço (Estado)' },
    // Outros
    { key: 'observations', label: 'Observações' },
];

const CSV_MODEL_HEADER = dbColumns.map(c => c.key).join(';');

export default function ContatoImporter({ isOpen, onClose, onImportComplete }) {
  const supabase = createClient();
  const { userData } = useAuth(); // <--- 2. PEGAMOS OS DADOS DO USUÁRIO LOGADO
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);

  const capitalizeFirstLetter = (string) => {
    if (!string) return string;
    const lower = string.toLowerCase();
    if (lower.includes('física') || lower.includes('fisica')) return 'Pessoa Física';
    if (lower.includes('jurídica') || lower.includes('juridica')) return 'Pessoa Jurídica';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

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
                        const cleanHeader = header.toLowerCase().replace(/ /g, '_').replace('ç', 'c').replace('ã', 'a');
                        const found = dbColumns.find(dbCol => dbCol.key === cleanHeader || dbCol.label.toLowerCase().includes(header.toLowerCase()));
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
    link.setAttribute("href", url); link.setAttribute("download", "modelo_importacao_contatos.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const processAndImport = async () => {
    if (!file) { setMessage('Nenhum arquivo selecionado.'); return; }
    
    // ---> 3. AQUI ESTÁ A MUDANÇA MÁGICA <---
    if (!userData?.organizacao_id) {
        toast.error('Erro de segurança: Organização do usuário não encontrada. Por favor, faça login novamente.');
        return;
    }

    setIsProcessing(true); setMessage('Analisando arquivo...'); setErrorDetails([]);

    const mappedType = Object.keys(mappings).find(key => mappings[key] === 'tipo_contato');
    if (!mappedType) {
        setMessage("Erro: Mapeie a coluna para 'Tipo de Contato', que é obrigatória.");
        setIsProcessing(false);
        return;
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            let importedCount = 0; const errors = [];
            const dataToImport = results.data.map(row => {
                const newRow = {};
                for (const csvHeader in mappings) {
                    const dbColumn = mappings[csvHeader];
                    if (dbColumn && row[csvHeader] !== undefined && row[csvHeader] !== null) newRow[dbColumn] = row[csvHeader];
                }
                return newRow;
            }).filter(row => Object.keys(row).length > 0 && (row.nome || row.razao_social) && row.tipo_contato);

            if (dataToImport.length === 0) {
                setMessage('Nenhuma linha válida para importar foi encontrada. Verifique se as colunas "Tipo de Contato" e ("Nome" ou "Razão Social") estão preenchidas.');
                setIsProcessing(false);
                return;
            }

            setMessage(`Arquivo válido. Importando ${dataToImport.length} contatos...`);

            for (let i = 0; i < dataToImport.length; i++) {
                const rowData = dataToImport[i];
                const { telefones, emails, ...contatoData } = rowData;
                
                // Adicionamos o "carimbo" da organização em cada linha a ser importada.
                contatoData.organizacao_id = userData.organizacao_id;

                if (contatoData.tipo_contato) contatoData.tipo_contato = capitalizeFirstLetter(contatoData.tipo_contato);
                if (contatoData.personalidade_juridica) contatoData.personalidade_juridica = capitalizeFirstLetter(contatoData.personalidade_juridica);
                else contatoData.personalidade_juridica = contatoData.cnpj ? 'Pessoa Jurídica' : 'Pessoa Física';

                if (contatoData.birth_date === '') contatoData.birth_date = null;
                if (contatoData.data_fundacao === '') contatoData.data_fundacao = null;

                const { data: savedContact, error: contactError } = await supabase.from('contatos').insert(contatoData).select().single();
                if (contactError) {
                    errors.push(`Linha ${i + 2}: Erro - ${contactError.details || contactError.message}`);
                    continue;
                } else {
                    importedCount++;
                    if (telefones) { const telefonesDb = String(telefones).split(';').map(t => ({ contato_id: savedContact.id, telefone: t.trim(), tipo: 'Importado' })); await supabase.from('telefones').insert(telefonesDb); }
                    if (emails) { const emailsDb = String(emails).split(';').map(e => ({ contato_id: savedContact.id, email: e.trim(), tipo: 'Importado' })); await supabase.from('emails').insert(emailsDb); }
                }
            }

            if (errors.length > 0) { setMessage(`${importedCount} contatos importados, mas ${errors.length} linhas continham erros.`); setErrorDetails(errors); } 
            else { setMessage(`${importedCount} contatos foram importados com sucesso!`); onImportComplete(); setTimeout(() => onClose(), 2000); }
            setIsProcessing(false);
        },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Importar Contatos via CSV</h2>
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
                    <p className="text-sm text-gray-600 mb-3">Vincule as colunas do seu arquivo (esquerda) com as colunas do sistema (direita).</p>
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

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente cria um modal para importação de contatos em massa via arquivo CSV.
// Ele lida com o upload do arquivo, o mapeamento das colunas do CSV para as colunas
// do banco de dados, a validação dos dados e a inserção em lote na tabela 'contatos'
// e tabelas relacionadas ('telefones', 'emails').
// --------------------------------------------------------------------------------