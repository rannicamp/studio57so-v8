// components/rh/PontoImporter.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faCheckCircle, faExclamationTriangle, faBug, faSearch } from '@fortawesome/free-solid-svg-icons';

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
  
  // DEBUG: Para ver o que o celular está fazendo
  const [debugInfo, setDebugInfo] = useState('');

  const employeeMap = new Map(employees.map(emp => [emp.numero_ponto, { id: emp.id, name: emp.full_name }]));

  const readFileContent = (file) => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error("Erro físico na leitura do arquivo."));
          reader.readAsText(file); // Tenta ler como texto padrão
      });
  };

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    event.target.value = ''; // Reset input

    if (!selectedFile) {
        setDebugInfo('Nenhum arquivo selecionado.');
        return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setProcessedRecords([]);
    setSummary({ ready: 0, errors: 0 });
    
    // Inicia Log de Diagnóstico
    let logs = `📂 Arq: ${selectedFile.name}\n⚖️ Tam: ${selectedFile.size} bytes\n🏷️ Tipo: ${selectedFile.type || 'n/a'}\n`;
    setDebugInfo(logs);
    toast.info('Analisando arquivo...');

    try {
        const content = await readFileContent(selectedFile);
        
        if (!content || content.length === 0) {
            throw new Error("O arquivo está vazio.");
        }

        // Adiciona amostra do conteúdo ao log (Vital para mobile)
        logs += `\n🔍 Amostra (Início):\n[${content.substring(0, 150).replace(/\n/g, '\\n').replace(/\t/g, '\\t')}]\n`;
        setDebugInfo(logs);

        // Separa linhas (lida com Windows \r\n e Unix \n)
        const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '');
        
        logs += `\n📊 Linhas totais: ${lines.length}`;
        
        if (lines.length === 0) throw new Error("Nenhuma linha de texto encontrada.");

        const recordsFromFile = [];
        let parseMode = 'TAB'; // Modo de detecção

        // Tenta detectar se é TAB ou ESPAÇO
        const firstLine = lines[1] || lines[0]; // Pega uma linha de dados (pula cabeçalho se houver)
        if (!firstLine.includes('\t') && firstLine.split(/\s+/).length > 3) {
            parseMode = 'SPACE'; // Fallback para mobile que converteu tabs em espaços
            logs += `\n⚠️ Modo Fallback: Usando ESPAÇOS como separador (Tabs não encontrados).`;
        } else {
            logs += `\n✅ Modo Padrão: Usando TABS.`;
        }
        setDebugInfo(logs);

        lines.forEach((line, index) => {
            // Pula cabeçalho se parecer texto
            if (index === 0 && isNaN(parseInt(line.charAt(0)))) return;

            let parts;
            if (parseMode === 'TAB') {
                parts = line.split('\t');
            } else {
                // Separa por qualquer espaço em branco repetido
                parts = line.trim().split(/\s+/);
            }

            // Precisamos de pelo menos: NumeroPonto, Data, Hora (ou DataHora junto)
            if (parts.length < 3) return;
            
            // Tenta extrair ID
            const numeroPonto = parseInt(parts[0], 10);
            if (isNaN(numeroPonto)) return;

            // Tenta extrair Data e Hora
            // Padrão esperado: ID ... ... DATA HORA
            // Ou ID ... DATA HORA
            // Vamos procurar algo que pareça data (XX/XX/XXXX)
            let datePart = null;
            let timePart = null;

            for (let part of parts) {
                if (part.includes('/') && part.length >= 8) datePart = part;
                else if (part.includes(':') && part.length >= 5) timePart = part;
            }

            if (datePart && timePart) {
                const [day, month, year] = datePart.split('/');
                // Formato ISO para o banco
                const data_hora_texto = `${year}-${month}-${day} ${timePart}`;
                
                const employeeInfo = employeeMap.get(numeroPonto);
                recordsFromFile.push({
                    numero_ponto: numeroPonto,
                    employee_name: employeeInfo?.name,
                    funcionario_id: employeeInfo?.id,
                    data_hora_texto: data_hora_texto,
                    original_line: index + 1,
                    status: employeeInfo ? 'success' : 'error',
                    error_message: employeeInfo ? null : `Ponto ${numeroPonto} s/ cadastro.`
                });
            }
        });

        logs += `\n🎯 Registros extraídos: ${recordsFromFile.length}`;
        setDebugInfo(logs);

        // Agrupamento e Lógica de Entradas/Saídas (Igual ao original)
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
            // Pega apenas os 4 primeiros registros do dia para evitar bagunça
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
            toast.success(`${readyCount} registros prontos para importar!`);
        } else {
            toast.warning("Arquivo lido, mas nenhum registro de ponto válido identificado. Verifique o formato.");
        }

    } catch (error) {
        console.error("Erro processamento:", error);
        setDebugInfo(prev => prev + `\n❌ ERRO CRÍTICO: ${error.message}`);
        toast.error(`Falha: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async (records) => {
        if (!organizacaoId) throw new Error("Sem organização.");
        
        // Mapeia para o formato do banco
        const recordsForDb = records.map(rec => ({
            funcionario_id: rec.funcionario_id,
            data_hora: rec.data_hora_texto,
            tipo_registro: rec.tipo_registro,
            observacao: 'Mobile Import',
            organizacao_id: organizacaoId, 
        }));

        const batchSize = 50;
        let processedCount = 0;

        for (let i = 0; i < recordsForDb.length; i += batchSize) {
            const batch = recordsForDb.slice(i, i + batchSize);
            const { error } = await supabase.rpc('importar_registros_ponto_se_vazio', { novos_registros: batch });
            if (error) throw error;
            processedCount += batch.length;
        }
        return processedCount;
    },
    onSuccess: (count) => {
        queryClient.invalidateQueries({ queryKey: ['registros_ponto'] });
        setFile(null);
        setProcessedRecords([]);
        setSummary({ ready: 0, errors: 0 });
        setDebugInfo(''); // Limpa o debug no sucesso
        if (onImport) onImport();
        toast.success("Importação concluída com sucesso!");
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`)
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <FontAwesomeIcon icon={faUpload} className="text-blue-600"/> Importar Ponto (Mobile/PC)
        </h2>
        
        <p className="text-sm text-gray-500 mb-4">
          Selecione o arquivo de ponto (TXT ou similar).
        </p>
        
        {/* INPUT DE ARQUIVO BLINDADO */}
        <div className="relative">
            <input
            type="file"
            accept="*/*" // Aceita tudo para evitar bloqueio no Android
            onChange={handleFileChange}
            disabled={isProcessing || importMutation.isPending}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border rounded-lg"
            />
            {isProcessing && <div className="absolute right-4 top-3 text-blue-600"><FontAwesomeIcon icon={faSpinner} spin /></div>}
        </div>

        {/* ÁREA DE DIAGNÓSTICO (Aparece se tiver logs) */}
        {debugInfo && (
            <div className="mt-4 p-3 bg-gray-900 text-green-400 text-[10px] font-mono rounded-lg overflow-x-auto max-h-40 border border-gray-700 shadow-inner">
                <p className="font-bold border-b border-gray-700 mb-1 pb-1 flex justify-between">
                    <span>DIAGNÓSTICO TÉCNICO:</span>
                    <span className="text-gray-500">Role para ver mais</span>
                </p>
                <pre className="whitespace-pre-wrap">{debugInfo}</pre>
            </div>
        )}
      </div>
      
      {/* LISTA DE PRÉ-VISUALIZAÇÃO */}
      {processedRecords.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-green-100 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-end mb-4">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Conferência</h3>
                <p className="text-xs text-gray-500">Verifique antes de salvar.</p>
            </div>
            <div className="text-right">
                <span className="block text-xl font-bold text-green-600">{summary.ready} <span className="text-sm font-normal text-gray-500">válidos</span></span>
                {summary.errors > 0 && <span className="text-xs text-red-500 font-bold">{summary.errors} erros</span>}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border rounded-md custom-scrollbar bg-gray-50">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Func.</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Data/Hora</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedRecords.map((rec, index) => (
                  <tr key={index} className={rec.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {rec.employee_name ? rec.employee_name.split(' ')[0] : <span className="text-gray-400">#{rec.numero_ponto}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{formatDbStringToBr(rec.data_hora_texto)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{rec.tipo_registro || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <StatusIndicator status={rec.status} message={rec.error_message} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={handleImport}
              disabled={isProcessing || importMutation.isPending || summary.ready === 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95"
            >
              {importMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
              {importMutation.isPending ? 'Salvando...' : `Confirmar Importação (${summary.ready})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}