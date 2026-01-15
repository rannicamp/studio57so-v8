// components/rh/PontoImporter.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faCheckCircle, faExclamationTriangle, faBug } from '@fortawesome/free-solid-svg-icons';

const StatusIndicator = ({ status, message }) => {
    if (status === 'success') {
        return <span className="text-green-600 flex items-center gap-1 text-xs"><FontAwesomeIcon icon={faCheckCircle} /> Pronto</span>;
    }
    if (status === 'error') {
        return <span className="text-red-600 flex items-center gap-1 text-xs" title={message}><FontAwesomeIcon icon={faExclamationTriangle} /> Erro</span>;
    }
    return null;
};

const formatDbStringToBr = (dbString) => {
    if (!dbString) return 'N/A';
    const [datePart, timePart] = dbString.split(' ');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year} ${timePart}`;
};

export default function PontoImporter({ employees, onImport }) {
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const organizacaoId = user?.organizacao_id;

  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedRecords, setProcessedRecords] = useState([]);
  const [summary, setSummary] = useState({ ready: 0, errors: 0 });
  
  // ESTADO NOVO: Diagnóstico para sabermos o que o celular está enxergando
  const [debugInfo, setDebugInfo] = useState('');

  const employeeMap = new Map(employees.map(emp => [emp.numero_ponto, { id: emp.id, name: emp.full_name }]));

  // Função auxiliar BLINDADA para ler arquivo
  const readFileContent = (file) => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error("Falha na leitura física do arquivo."));
          // Tenta ler como texto. Se o celular salvar com encoding estranho, o FileReader costuma lidar bem.
          reader.readAsText(file); 
      });
  };

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    
    // Zera o valor do input para permitir selecionar o mesmo arquivo novamente se precisar
    event.target.value = '';

    if (!selectedFile) {
        setDebugInfo('Nenhum arquivo foi retornado pelo seletor do dispositivo.');
        return;
    }

    // REGISTRA O DIAGNÓSTICO
    setDebugInfo(`Arquivo detectado:\nNome: ${selectedFile.name}\nTipo (Mime): ${selectedFile.type || 'Desconhecido'}\nTamanho: ${selectedFile.size} bytes`);

    setFile(selectedFile);
    setIsProcessing(true);
    setProcessedRecords([]);
    setSummary({ ready: 0, errors: 0 });
    toast.info('Lendo arquivo...');

    try {
        const content = await readFileContent(selectedFile);
        
        // Verifica se leu algo
        if (!content) {
            throw new Error("O conteúdo do arquivo está vazio ou ilegível.");
        }

        const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '' && line.includes('\t'));
        
        setDebugInfo(prev => prev + `\nLinhas brutas encontradas: ${lines.length}`);

        if (lines.length === 0) {
             // Tenta detectar se o separador não é TAB
             if (content.includes(';') || content.includes(',')) {
                 throw new Error("O arquivo parece usar ';' ou ',' em vez de TAB (tabulação). Verifique o formato.");
             }
             throw new Error("Nenhuma linha válida com TAB encontrada.");
        }

        const recordsFromFile = [];
        
        // Começamos do 1 para pular o cabeçalho
        lines.slice(1).forEach((line, index) => {
            const parts = line.split('\t');
            if (parts.length < 4) return;
            
            const numeroPonto = parseInt(parts[0], 10);
            const dateTimeString = parts[3].trim();
            const [datePart, timePart] = dateTimeString.split(/\s+/);

            if (datePart && timePart && datePart.includes('/')) {
                const [day, month, year] = datePart.split('/');
                
                // Formatamos a data como string YYYY-MM-DD HH:MM:SS
                const data_hora_texto = `${year}-${month}-${day} ${timePart}`;
                
                const employeeInfo = employeeMap.get(numeroPonto);
                recordsFromFile.push({
                    numero_ponto: numeroPonto,
                    employee_name: employeeInfo?.name,
                    funcionario_id: employeeInfo?.id,
                    data_hora_texto: data_hora_texto,
                    original_line: index + 2,
                    status: employeeInfo ? 'success' : 'error',
                    error_message: employeeInfo ? null : `Funcionário com Nº de Ponto "${numeroPonto}" não encontrado.`
                });
            }
        });

        setDebugInfo(prev => prev + `\nRegistros identificados: ${recordsFromFile.length}`);

        const groupedByEmployeeAndDay = recordsFromFile.reduce((acc, record) => {
            if(record.status !== 'success') return acc;
            const dayKey = record.data_hora_texto.split(' ')[0];
            const key = `${record.funcionario_id}-${dayKey}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(record);
            return acc;
        }, {});

        const finalRecords = [];
        const tipos = ['Entrada', 'Inicio_Intervalo', 'Fim_Intervalo', 'Saida'];
        for (const key in groupedByEmployeeAndDay) {
            const dayRecords = groupedByEmployeeAndDay[key].sort((a, b) => a.data_hora_texto.localeCompare(b.data_hora_texto));
            const recordsToProcess = dayRecords.slice(0, 4);

            recordsToProcess.forEach((record, index) => {
                finalRecords.push({ ...record, tipo_registro: tipos[index] });
            });
        }

        const allDisplayRecords = [
            ...finalRecords,
            ...recordsFromFile.filter(r => r.status === 'error')
        ].sort((a,b) => a.original_line - b.original_line);

        setProcessedRecords(allDisplayRecords);
        const readyCount = allDisplayRecords.filter(r => r.status === 'success').length;
        const errorCount = allDisplayRecords.length - readyCount;
        setSummary({ ready: readyCount, errors: errorCount });

        if (allDisplayRecords.length > 0) {
            toast.success(`Processado! ${readyCount} prontos, ${errorCount} erros.`);
        } else {
            toast.warning("Nenhum registro de ponto válido encontrado no arquivo.");
        }

    } catch (error) {
        console.error("Erro ao processar:", error);
        setDebugInfo(prev => prev + `\nERRO FATAL: ${error.message}`);
        toast.error(`Erro: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async (records) => {
        if (!organizacaoId) throw new Error("Organização não identificada.");

        const recordsForDb = records.map(rec => ({
            funcionario_id: rec.funcionario_id,
            data_hora: rec.data_hora_texto,
            tipo_registro: rec.tipo_registro,
            observacao: 'Importado via arquivo TXT (Mobile/Web)',
            organizacao_id: organizacaoId, 
        }));

        const batchSize = 50;
        let processedCount = 0;

        for (let i = 0; i < recordsForDb.length; i += batchSize) {
            const batch = recordsForDb.slice(i, i + batchSize);
            
            const { error } = await supabase.rpc('importar_registros_ponto_se_vazio', {
                novos_registros: batch
            });

            if (error) {
                console.error(`Erro no lote iniciando em ${i}:`, error);
                throw error;
            }
            
            processedCount += batch.length;
        }

        return processedCount;
    },
    onSuccess: (count) => {
        queryClient.invalidateQueries({ queryKey: ['registros_ponto'] });
        setFile(null);
        setProcessedRecords([]);
        setSummary({ ready: 0, errors: 0 });
        if (onImport) onImport();
    },
  });

  const handleImport = () => {
    const recordsToInsert = processedRecords.filter(r => r.status === 'success');
    if (recordsToInsert.length === 0) {
      toast.error('Nenhum registro válido para importar.');
      return;
    }

    toast.promise(importMutation.mutateAsync(recordsToInsert), {
        loading: `Importando ${recordsToInsert.length} registros...`,
        success: (count) => `${count} registros salvos!`,
        error: (err) => `Erro ao importar: ${err.message}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Importar Ponto (.txt)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Selecione o arquivo. 
          <br/>
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
             <FontAwesomeIcon icon={faBug} className="mr-1"/> 
             Modo de Compatibilidade Mobile Ativo
          </span>
        </p>
        
        {/* ALTERAÇÃO IMPORTANTE: accept="*" libera a seleção no Android/iOS */}
        <input
          type="file"
          accept="*" 
          onChange={handleFileChange}
          disabled={isProcessing || importMutation.isPending}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100 disabled:opacity-50 cursor-pointer"
        />

        {/* ÁREA DE DIAGNÓSTICO PARA VOCÊ VER NO CELULAR */}
        {debugInfo && (
            <div className="mt-4 p-3 bg-gray-800 text-green-400 text-xs font-mono rounded overflow-x-auto whitespace-pre-wrap border border-gray-600">
                <strong>DIAGNÓSTICO TÉCNICO:</strong>
                <br/>
                {debugInfo}
            </div>
        )}

      </div>
      
      {processedRecords.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md animate-in slide-in-from-bottom-2">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Pré-visualização</h3>
          <div className="flex justify-between items-center text-sm mb-4">
            <p className="text-green-600 font-semibold">{summary.ready} registros prontos.</p>
            <p className="text-red-600 font-semibold">{summary.errors} registros com erros.</p>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded-md custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Funcionário</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data/Hora</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Registro</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedRecords.map((rec, index) => (
                  <tr key={index} className={rec.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{rec.employee_name || <span className="text-gray-400 italic">Desconhecido</span>}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{formatDbStringToBr(rec.data_hora_texto)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{rec.tipo_registro || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <StatusIndicator status={rec.status} message={rec.error_message} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 text-right">
            <button
              onClick={handleImport}
              disabled={isProcessing || importMutation.isPending || summary.ready === 0}
              className="bg-green-600 text-white px-6 py-3 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full md:w-auto ml-auto font-bold"
            >
              {importMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
              {importMutation.isPending ? 'Importando...' : `Confirmar Importação (${summary.ready})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}