//components/PontoImporter.js
"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faFileCsv, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const StatusIndicator = ({ status, message }) => {
    if (status === 'success') {
        return <span className="text-green-600 flex items-center gap-1 text-xs"><FontAwesomeIcon icon={faCheckCircle} /> Pronto</span>;
    }
    if (status === 'error') {
        return <span className="text-red-600 flex items-center gap-1 text-xs" title={message}><FontAwesomeIcon icon={faExclamationTriangle} /> Erro</span>;
    }
    return null;
};

// Pequena função para formatar nosso texto de data para exibição na tela
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
  
  const employeeMap = new Map(employees.map(emp => [emp.numero_ponto, { id: emp.id, name: emp.full_name }]));

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setProcessedRecords([]);
    setSummary({ ready: 0, errors: 0 });
    toast.info('Lendo e processando o arquivo...');

    const content = await selectedFile.text();
    const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '' && line.includes('\t'));

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
          
          // =================================================================================
          // CORREÇÃO AQUI 1/3: Criando a data como TEXTO
          // O PORQUÊ: Em vez de criar um objeto `new Date()` que faz a conversão de fuso,
          // nós montamos uma string de texto no formato que o banco de dados entende.
          // Isso garante que "13:00" continue sendo "13:00".
          // =================================================================================
          const data_hora_texto = `${year}-${month}-${day} ${timePart}`;
          
          const employeeInfo = employeeMap.get(numeroPonto);
          recordsFromFile.push({
              numero_ponto: numeroPonto,
              employee_name: employeeInfo?.name,
              funcionario_id: employeeInfo?.id,
              data_hora_texto: data_hora_texto, // Salvamos nosso texto
              original_line: index + 2,
              status: employeeInfo ? 'success' : 'error',
              error_message: employeeInfo ? null : `Funcionário com Nº de Ponto "${numeroPonto}" não encontrado.`
          });
      }
    });

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
        // =================================================================================
        // CORREÇÃO AQUI 2/3: Ordenando por TEXTO
        // O PORQUÊ: Como agora temos texto, usamos `localeCompare` para ordenar
        // corretamente as batidas do dia.
        // =================================================================================
        const dayRecords = groupedByEmployeeAndDay[key].sort((a, b) => a.data_hora_texto.localeCompare(b.data_hora_texto));
        
        // Atribui os tipos (Entrada, Saída, etc) para até 4 registros
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

    toast.success(`Arquivo processado: ${readyCount} registros prontos, ${errorCount} com erros.`);
    setIsProcessing(false);
  };

  const importMutation = useMutation({
    mutationFn: async (records) => {
        if (!organizacaoId) throw new Error("Organização não identificada.");

        // =================================================================================
        // CORREÇÃO AQUI 3/3: Enviando o TEXTO para o banco
        // O PORQUÊ: Mapeamos os registros e passamos o campo `data_hora_texto`
        // diretamente para a coluna `data_hora`. Sem `toISOString()`, sem conversão.
        // =================================================================================
        const recordsForDb = records.map(rec => ({
            funcionario_id: rec.funcionario_id,
            data_hora: rec.data_hora_texto,
            tipo_registro: rec.tipo_registro,
            observacao: 'Importado via arquivo TXT',
            organizacao_id: organizacaoId, 
        }));
        
        const { error } = await supabase.rpc('importar_registros_ponto_se_vazio', {
            novos_registros: recordsForDb
        });

        if (error) throw error;
        return records.length;
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
        success: (count) => `${count} registros foram importados com sucesso! Campos já preenchidos foram ignorados.`,
        error: (err) => `Erro ao importar: ${err.message}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Importar Ponto (.txt)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Selecione o arquivo de ponto gerado pelo relógio. O sistema irá adicionar as batidas de ponto apenas nos campos que estiverem vazios. <strong>Registros manuais ou já existentes não serão sobrescritos.</strong>
        </p>
        <input
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          disabled={isProcessing || importMutation.isPending}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </div>
      
      {processedRecords.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Pré-visualização da Importação</h3>
          <div className="flex justify-between items-center text-sm mb-4">
            <p className="text-green-600 font-semibold">{summary.ready} registros prontos para importar.</p>
            <p className="text-red-600 font-semibold">{summary.errors} registros com erros.</p>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Funcionário</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data e Hora</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Registro Atribuído</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedRecords.map((rec, index) => (
                  <tr key={index} className={rec.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 whitespace-nowrap">{rec.employee_name || <span className="text-gray-500">Desconhecido</span>}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDbStringToBr(rec.data_hora_texto)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{rec.tipo_registro || 'N/A'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
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
              className="bg-green-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
              {importMutation.isPending ? 'Importando...' : `Confirmar e Importar ${summary.ready} Registros`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}