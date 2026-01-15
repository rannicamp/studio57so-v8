// components/rh/PontoImporter.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faCheckCircle, faExclamationTriangle, faBug, faFileAlt, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

// Componente de Status compactado para Mobile
const StatusIndicator = ({ status, message }) => {
    if (status === 'success') {
        return <span className="text-green-600 flex items-center justify-center sm:justify-start gap-1 text-[10px] sm:text-xs"><FontAwesomeIcon icon={faCheckCircle} /> <span className="hidden sm:inline">Ok</span></span>;
    }
    if (status === 'error') {
        return <span className="text-red-600 flex items-center justify-center sm:justify-start gap-1 text-[10px] sm:text-xs" title={message}><FontAwesomeIcon icon={faExclamationTriangle} /> <span className="hidden sm:inline">Erro</span></span>;
    }
    return null;
};

const formatDbStringToBr = (dbString) => {
    if (!dbString) return '-';
    const [datePart, timePart] = dbString.split(' ');
    if (!datePart) return '-';
    const [year, month, day] = datePart.split('-');
    // No mobile, mostra data curta: 25/06 14:00
    return `${day}/${month} ${timePart?.slice(0,5)}`;
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
  const [debugInfo, setDebugInfo] = useState('');

  // Mapa de funcionários para busca rápida
  const employeeMap = new Map(employees.map(emp => [emp.numero_ponto, { id: emp.id, name: emp.full_name }]));

  const readFileContent = (file) => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error("Erro na leitura física."));
          reader.readAsText(file); // Tenta ler como texto, não importa a extensão
      });
  };

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    event.target.value = ''; // Reset para permitir selecionar o mesmo arquivo se errar

    if (!selectedFile) return;

    // Validação suave de tipo para avisar o usuário, mas não bloquear
    // (Muitos TXT no Android vêm sem type ou como octet-stream)
    if (selectedFile.type && !selectedFile.type.includes('text') && !selectedFile.name.endsWith('.txt')) {
        toast.warning("O arquivo selecionado pode não ser de texto. Tentando ler mesmo assim...");
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setProcessedRecords([]); 
    setSummary({ ready: 0, errors: 0 });
    
    let logs = `📱 Mobile Debug:\nArquivo: ${selectedFile.name}\nTipo: ${selectedFile.type || 'n/a'}\n`;
    setDebugInfo(logs);

    try {
        const content = await readFileContent(selectedFile);
        
        if (!content || content.trim().length === 0) {
            throw new Error("Arquivo vazio ou formato ilegível.");
        }

        // Normaliza quebras de linha
        const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '');
        logs += `Linhas lidas: ${lines.length}\n`;
        
        const recordsFromFile = [];
        let parseMode = 'TAB';

        // --- LÓGICA DE DETECÇÃO INTELIGENTE ---
        const sampleLine = lines.find(l => l.match(/\d/)); 
        
        if (sampleLine) {
            if (sampleLine.includes('\t')) {
                parseMode = 'TAB';
                logs += `Modo: TAB (Padrão)\n`;
            } else {
                parseMode = 'SPACE';
                logs += `Modo: Espaços (Fallback Mobile)\n`;
            }
        }
        setDebugInfo(logs);

        lines.forEach((line, index) => {
            // Ignora linhas de cabeçalho puro texto (se não tiver número na linha, pula)
            if (index < 5 && !line.match(/\d/)) return;

            let parts;
            if (parseMode === 'TAB') {
                parts = line.split('\t');
            } else {
                // Separa por qualquer sequência de espaços em branco
                parts = line.trim().split(/\s+/);
            }

            // Precisamos de pelo menos 3 pedaços de informação
            if (parts.length < 3) return;
            
            const numeroPonto = parseInt(parts[0], 10);
            if (isNaN(numeroPonto)) return;

            let datePart = null;
            let timePart = null;

            // Procura padrões de data (XX/XX/XXXX) e hora (XX:XX) nas partes da linha
            for (let part of parts) {
                if (part.includes('/') && part.length >= 5) datePart = part;
                else if (part.includes(':') && part.length >= 4) timePart = part;
            }

            if (datePart && timePart) {
                const [day, month, year] = datePart.split('/');
                // Corrige ano de 2 dígitos se necessário (ex: 24 -> 2024)
                const fullYear = year.length === 2 ? `20${year}` : year; 
                const data_hora_texto = `${fullYear}-${month}-${day} ${timePart}`;
                
                const employeeInfo = employeeMap.get(numeroPonto);
                recordsFromFile.push({
                    numero_ponto: numeroPonto,
                    employee_name: employeeInfo?.name,
                    funcionario_id: employeeInfo?.id,
                    data_hora_texto: data_hora_texto,
                    original_line: index + 1,
                    status: employeeInfo ? 'success' : 'error',
                    error_message: employeeInfo ? null : `Func. #${numeroPonto} não achado`
                });
            }
        });

        // Agrupa por dia para determinar Entrada/Saída
        const grouped = recordsFromFile.reduce((acc, r) => {
            if(r.status !== 'success') return acc;
            const key = `${r.funcionario_id}-${r.data_hora_texto.split(' ')[0]}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(r);
            return acc;
        }, {});

        const finalRecords = [];
        const tipos = ['Entrada', 'Almoço Ini', 'Almoço Fim', 'Saída']; // Nomes curtos para mobile
        
        for (const key in grouped) {
            const dayRecs = grouped[key].sort((a, b) => a.data_hora_texto.localeCompare(b.data_hora_texto));
            dayRecs.slice(0, 4).forEach((rec, idx) => {
                finalRecords.push({ ...rec, tipo_registro: tipos[idx] });
            });
        }

        const display = [
            ...finalRecords, 
            ...recordsFromFile.filter(r => r.status === 'error')
        ].sort((a,b) => a.original_line - b.original_line);

        setProcessedRecords(display);
        const readyCount = display.filter(r => r.status === 'success').length;
        setSummary({ ready: readyCount, errors: display.length - readyCount });

        if (display.length === 0) {
            toast.warning("Arquivo lido, mas nenhum registro válido encontrado.");
        } else {
            toast.success("Dados lidos! Confira abaixo.");
        }

    } catch (error) {
        setDebugInfo(prev => prev + `Erro Crítico: ${error.message}`);
        toast.error("Erro ao ler arquivo. Verifique se é um arquivo de texto.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleImportConfirm = () => {
    const validos = processedRecords.filter(r => r.status === 'success');
    if(validos.length === 0) return;
    importMutation.mutate(validos);
  };

  const importMutation = useMutation({
    mutationFn: async (records) => {
        const payload = records.map(r => ({
            funcionario_id: r.funcionario_id,
            data_hora: r.data_hora_texto,
            tipo_registro: r.tipo_registro,
            observacao: 'Mobile Import',
            organizacao_id: organizacaoId, 
        }));

        const batchSize = 20;
        for (let i = 0; i < payload.length; i += batchSize) {
            const { error } = await supabase.rpc('importar_registros_ponto_se_vazio', { 
                novos_registros: payload.slice(i, i + batchSize) 
            });
            if (error) throw error;
        }
    },
    onSuccess: () => {
        toast.success("Importação Concluída!");
        queryClient.invalidateQueries({ queryKey: ['registros_ponto'] });
        setProcessedRecords([]);
        setFile(null);
        if(onImport) onImport();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`)
  });

  return (
    <div className="w-full max-w-full space-y-4">
      {/* CARD DE IMPORTAÇÃO */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 w-full">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faUpload} className="text-blue-500"/> 
                Importar Arquivo
            </h2>
            {isProcessing && <span className="text-xs font-bold text-blue-600 animate-pulse">Lendo...</span>}
        </div>
        
        <div className="flex flex-col gap-2 mb-3">
            <p className="text-xs text-gray-500">Selecione o arquivo (.txt) do seu dispositivo.</p>
            {employees.length === 0 && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded flex items-center gap-1">
                    <FontAwesomeIcon icon={faExclamationTriangle} /> 
                    Atenção: Nenhum funcionário cadastrado. A importação falhará.
                </p>
            )}
        </div>
        
        {/* INPUT DE ARQUIVO MOBILE-FRIENDLY */}
        <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isProcessing ? 'bg-gray-50 border-gray-300' : 'bg-blue-50 border-blue-200 hover:bg-blue-100'} active:bg-blue-200`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {isProcessing ? (
                    <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-2xl mb-2" />
                ) : (
                    <FontAwesomeIcon icon={faFileAlt} className="text-blue-400 text-2xl mb-2" />
                )}
                <p className="text-xs text-gray-600 text-center px-2 font-medium">
                    {file ? file.name : 'Toque para selecionar arquivo'}
                </p>
            </div>
            
            {/* CORREÇÃO PARA MOBILE: 
                Usar accept="* / *" força o Android a mostrar todas as opções (Arquivos, Downloads, Drive).
                Se usarmos ".txt", alguns Androids desabilitam a seleção.
            */}
            <input 
                type="file" 
                className="hidden" 
                accept="*/*" 
                onChange={handleFileChange} 
                disabled={isProcessing} 
            />
        </label>

        {/* LOG DEBUG */}
        {debugInfo && processedRecords.length === 0 && !isProcessing && (
            <div className="mt-3 p-2 bg-gray-900 text-green-400 text-[10px] font-mono rounded max-h-32 overflow-y-auto">
                <pre>{debugInfo}</pre>
            </div>
        )}
      </div>
      
      {/* ÁREA DE RESULTADOS */}
      {processedRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700">Pré-visualização</span>
            <div className="text-xs space-x-2">
                <span className="text-green-600 font-bold">{summary.ready} ok</span>
                {summary.errors > 0 && <span className="text-red-500 font-bold">{summary.errors} erros</span>}
            </div>
          </div>

          <div className="w-full overflow-x-auto bg-white max-h-80 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-100 whitespace-nowrap">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Func.</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reg.</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedRecords.map((rec, index) => (
                  <tr key={index} className={rec.status === 'error' ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 text-xs text-gray-700">
                        {rec.employee_name ? rec.employee_name.split(' ')[0] : <span className="text-gray-400">#{rec.numero_ponto}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{formatDbStringToBr(rec.data_hora_texto)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 font-medium">{rec.tipo_registro || '-'}</td>
                    <td className="px-3 py-2 text-center">
                        <StatusIndicator status={rec.status} message={rec.error_message} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleImportConfirm}
              disabled={importMutation.isPending || summary.ready === 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg shadow hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold text-sm transition-transform active:scale-95"
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