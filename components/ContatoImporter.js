"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faFileCsv, faDownload } from '@fortawesome/free-solid-svg-icons';

const CSV_MODEL_HEADER = "nome;tipo_contato;status;razao_social;nome_fantasia;cnpj;inscricao_estadual;inscricao_municipal;responsavel_legal;cpf;rg;nacionalidade;birth_date;estado_civil;cargo;contract_role;admission_date;demission_date;telefones;emails;cep;address_street;address_number;address_complement;neighborhood;city;state;base_salary;total_salary;daily_value;payment_method;pix_key;bank_details;observations;numero_ponto;foto_url";

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
    const blob = new Blob(["\uFEFF" + CSV_MODEL_HEADER], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_contatos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const capitalizeFirstLetter = (string) => {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  const intelligentCSVParser = (text) => {
    const rawLines = text.split(/\r\n|\n/);
    if (rawLines.length < 1) return { header: [], rows: [] };

    const header = rawLines[0].replace(/^\uFEFF/, '').trim();
    const headerKeys = header.split(';').map(h => h.trim().toLowerCase());
    const columnCount = headerKeys.length;

    const dataRows = [];
    let currentLineBuffer = "";

    for (let i = 1; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        if (!line) continue;

        currentLineBuffer += (currentLineBuffer ? " " + line : line);
        const fields = currentLineBuffer.split(';');

        if (fields.length >= columnCount) {
            const completeRowFields = fields.slice(0, columnCount);
            currentLineBuffer = fields.slice(columnCount).join(';');
            
            const rowObject = {};
            headerKeys.forEach((key, index) => {
                rowObject[key] = completeRowFields[index]?.trim() || null;
            });
            dataRows.push(rowObject);
        }
    }
    
    if (currentLineBuffer.trim()) {
        const fields = currentLineBuffer.split(';');
        const rowObject = {};
        headerKeys.forEach((key, index) => {
            rowObject[key] = fields[index]?.trim() || null;
        });
        dataRows.push(rowObject);
    }
    
    return { header: headerKeys, rows: dataRows };
  };

  const processAndImport = async () => {
    if (!file) {
      setMessage('Nenhum arquivo selecionado.');
      return;
    }
    setIsProcessing(true);
    setMessage('Analisando arquivo...');
    setErrorDetails([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const { header, rows } = intelligentCSVParser(text);
        
        if (!header.includes('nome') || !header.includes('tipo_contato')) {
            setMessage('Erro: O cabeçalho do seu arquivo precisa conter as colunas "nome" e "tipo_contato".');
            setIsProcessing(false);
            return;
        }
        
        setMessage(`Arquivo válido. Importando contatos...`);
        const errors = [];
        let importedCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            
            // **A MELHORIA ESTÁ AQUI**
            // Verifica se a linha é efetivamente vazia (só tem valores nulos ou em branco)
            const isRowEssentiallyEmpty = Object.values(rowData).every(value => !value);
            if (isRowEssentiallyEmpty) {
                continue; // Pula a linha fantasma sem gerar erro
            }

            if (!rowData.nome || !rowData.tipo_contato) {
                errors.push(`Linha ${i + 2}: As colunas "nome" e "tipo_contato" não podem estar em branco.`);
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
            } else {
                importedCount++;
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
            setMessage(`${importedCount} contatos importados com sucesso, mas ${errors.length} linhas continham erros.`);
            setErrorDetails(errors);
        } else {
            setMessage(`${importedCount} contatos foram importados com sucesso!`);
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
                <li>Clique em &quot;Baixar Modelo&quot; para obter a planilha no formato correto.</li>
                <li>Preencha a planilha. As colunas podem estar em qualquer ordem, desde que os nomes no cabeçalho estejam corretos.</li>
                <li>Para múltiplos telefones/emails, separe-os com ponto e vírgula (;) na mesma célula.</li>
                <li>Selecione o arquivo preenchido e clique em &quot;Importar&quot;.</li>
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