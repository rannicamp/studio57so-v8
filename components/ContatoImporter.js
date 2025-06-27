"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faFileCsv, faDownload } from '@fortawesome/free-solid-svg-icons';

// O cabeçalho oficial do modelo.
const CSV_HEADER = "nome;tipo_contato;status;razao_social;nome_fantasia;cnpj;inscricao_estadual;inscricao_municipal;responsavel_legal;cpf;rg;nacionalidade;birth_date;estado_civil;cargo;contract_role;admission_date;demission_date;telefones;emails;cep;address_street;address_number;address_complement;neighborhood;city;state;base_salary;total_salary;daily_value;payment_method;pix_key;bank_details;observations;numero_ponto;foto_url";

export default function ContatoImporter({ isOpen, onClose, onImportComplete }) {
  const supabase = createClient();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
      setMessage('');
      setErrorDetails([]);
    } else {
      setFile(null);
      setMessage('Por favor, selecione um arquivo no formato CSV.');
    }
  };
  
  const handleDownloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + CSV_HEADER], { type: 'text/csv;charset=utf-8;' }); // Adiciona o BOM para compatibilidade com Excel
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_contatos.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // CORREÇÃO APLICADA AQUI
  const cleanHeader = (headerString) => {
    // Remove o caractere BOM (se existir) e espaços extras
    return headerString.replace(/^\uFEFF/, '').trim();
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length < 2) return { header: null, rows: [] };
    
    const header = cleanHeader(lines[0]); // Limpa o cabeçalho lido
    const headerKeys = header.split(';').map(h => h.trim());
    
    const rows = lines.slice(1).map(line => {
      const values = line.split(';');
      const obj = {};
      headerKeys.forEach((key, i) => {
        obj[key] = values[i] ? values[i].trim() : null;
      });
      return obj;
    });
    return { header: header, rows };
  };
  
  const capitalizeFirstLetter = (string) => {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  const processAndImport = async () => {
    if (!file) {
      setMessage('Nenhum arquivo selecionado.');
      return;
    }
    setIsProcessing(true);
    setMessage('Validando arquivo...');
    setErrorDetails([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const { header, rows } = parseCSV(text);
        
        const expectedHeader = CSV_HEADER;

        if (header !== expectedHeader) {
            setMessage('Erro: O cabeçalho do arquivo não corresponde ao modelo. Por favor, baixe um novo modelo e tente novamente.');
            setIsProcessing(false);
            return;
        }
        
        setMessage(`Arquivo válido. Importando ${rows.length} contatos...`);
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            
            if (!rowData.nome || !rowData.tipo_contato) {
                errors.push(`Linha ${i + 2}: Nome e Tipo de Contato são obrigatórios.`);
                continue;
            }

            const { telefones, emails, ...contatoData } = rowData;
            
            const formattedContatoData = {
                ...contatoData,
                tipo_contato: capitalizeFirstLetter(contatoData.tipo_contato),
            };
            
            const { data: savedContact, error: contactError } = await supabase.from('contatos').insert(formattedContatoData).select().single();

            if (contactError) {
                errors.push(`Linha ${i + 2}: Erro ao salvar contato - ${contactError.details || contactError.message}`);
                continue;
            }

            if (telefones) {
                const telefonesDb = telefones.split(';').map(t => ({ contato_id: savedContact.id, telefone: t.trim(), tipo: 'Importado' }));
                await supabase.from('telefones').insert(telefonesDb);
            }
            if (emails) {
                const emailsDb = emails.split(';').map(e => ({ contato_id: savedContact.id, email: e.trim(), tipo: 'Importado' }));
                await supabase.from('emails').insert(emailsDb);
            }
        }

        if (errors.length > 0) {
            setMessage(`Importação concluída com ${errors.length} erros.`);
            setErrorDetails(errors);
        } else {
            setMessage('Todos os contatos foram importados com sucesso!');
            onImportComplete();
            setTimeout(() => onClose(), 2000);
        }
        setIsProcessing(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg space-y-4">
        <h2 className="text-xl font-bold text-gray-800">Importar Contatos via CSV</h2>
        <div className="text-sm">
            <p>Siga os passos para uma importação correta:</p>
            <ol className="list-decimal list-inside ml-4 mt-2 space-y-1">
                <li>Clique em "Baixar Modelo" para obter a planilha no formato correto.</li>
                <li>Preencha a planilha. Para múltiplos telefones/emails, separe-os com ponto e vírgula (;) na mesma célula.</li>
                <li>Selecione o arquivo preenchido e clique em "Importar".</li>
            </ol>
        </div>
        <button onClick={handleDownloadTemplate} className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faDownload} /> Baixar Modelo de Planilha (.csv)
        </button>
        <div>
          <label htmlFor="csv-importer" className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
              <FontAwesomeIcon icon={faFileCsv} className="text-4xl text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">{file ? `Arquivo: ${file.name}` : 'Clique para selecionar o arquivo'}</p>
          </label>
          <input id="csv-importer" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        </div>
        {message && <p className="text-center text-sm font-medium p-2 bg-gray-100 rounded-md">{message}</p>}
        {errorDetails.length > 0 && (
            <div className="max-h-32 overflow-y-auto p-2 border border-red-200 bg-red-50 rounded-md text-sm">
                <p className="font-bold mb-1">Detalhes dos erros:</p>
                <ul className="list-disc list-inside">
                    {errorDetails.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
            </div>
        )}
        <div className="flex justify-end gap-4">
          <button onClick={onClose} disabled={isProcessing} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"> Fechar </button>
          <button onClick={processAndImport} disabled={!file || isProcessing} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
            {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
            {isProcessing ? 'Importando...' : 'Importar Arquivo'}
          </button>
        </div>
      </div>
    </div>
  );
}