// components/rh/PontoImporter.js
"use client";

import { useState, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faCheckCircle, faExclamationTriangle, faFileAlt, faFolderOpen, faBug } from '@fortawesome/free-solid-svg-icons';

// Componente de Status
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
    return `${day}/${month} ${timePart?.slice(0,5)}`;
};

export default function PontoImporter({ employees, onImport }) {
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const organizacaoId = user?.organizacao_id;
  
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedRecords, setProcessedRecords] = useState([]);
  const [summary, setSummary] = useState({ ready: 0, errors: 0 });
  const [debugLog, setDebugLog] = useState([]); // Log visual para mobile

  // Mapa de funcionários
  const employeeMap = new Map(employees.map(emp => [emp.numero_ponto, { id: emp.id, name: emp.full_name }]));

  const addLog = (msg) => {
      console.log(msg);
      setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const readFileContent = (file) => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = (e) => {
              addLog("Leitura física concluída (onload)");
              resolve(e.target.result);
          };
          
          reader.onerror = (e) => {
              addLog("Erro no FileReader: " + e.target.error);
              reject(new Error("Falha ao ler bits do arquivo."));
          };

          addLog(`Iniciando leitura: ${file.name} (${file.size} bytes)`);
          // Tenta ler como ISO-8859-1 (Latin1) que é comum em relógios de ponto antigos
          // Se der erro de caracteres estranhos, o navegador mobile costuma lidar melhor com ISO do que UTF-8 forçado
          reader.readAsText(file, 'ISO-8859-1'); 
      });
  };

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    event.target.value = ''; 

    if (!selectedFile) {
        addLog("Nenhum arquivo selecionado no input.");
        return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setProcessedRecords([]); 
    setSummary({ ready: 0, errors: 0 });
    setDebugLog([]); // Limpa log anterior
    
    toast.info("Arquivo recebido. Processando...");
    addLog(`Arquivo selecionado: ${selectedFile.name}`);
    addLog(`Tipo MIME: ${selectedFile.type || 'Desconhecido'}`);

    try {
        const content = await readFileContent(selectedFile);
        
        if (!content || content.length === 0) {
            throw new Error("O arquivo está vazio (0 bytes lidos).");
        }

        // Mostra as primeiras 100 letras para ver se é lixo ou texto
        addLog(`Preview Conteúdo: ${content.substring(0, 50).replace(/\n/g, '\\n')}...`);

        const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
        addLog(`Linhas brutas encontradas: ${lines.length}`);
        
        const recordsFromFile = [];
        let parseMode = 'TAB';

        // Tenta descobrir se é TAB ou ESPAÇO
        const sampleLine = lines.find(l => l.match(/\d/)); 
        if (sampleLine) {
            if (sampleLine.includes('\t')) {
                parseMode = 'TAB';
                addLog("Modo detectado: TAB");
            } else {
                parseMode = 'SPACE';
                addLog("Modo detectado: ESPAÇOS");
            }
        }

        lines.forEach((line, index) => {
            // Ignora cabeçalho (primeiras linhas sem numeros)
            if (index < 10 && !line.match(/\d/)) return;

            let parts;
            if (parseMode === 'TAB') {
                parts = line.split('\t');
            } else {
                parts = line.trim().split(/\s+/);
            }

            // Validação mínima: Tem que ter numero do ponto e data/hora
            if (parts.length < 3) return;
            
            const numeroPonto = parseInt(parts[0], 10);
            if (isNaN(numeroPonto)) return;

            let datePart = null;
            let timePart = null;

            for (let part of parts) {
                if (part.includes('/') && part.length >= 5) datePart = part;
                else if (part.includes(':') && part.length >= 4) timePart = part;
            }

            if (datePart && timePart) {
                const [day, month, year] = datePart.split('/');
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
                    error_message: employeeInfo ? null : `Func. #${numeroPonto} desconhecido`
                });
            }
        });

        addLog(`Registros extraídos: ${recordsFromFile.length}`);

        if (recordsFromFile.length === 0) {
            toast.warning("Arquivo lido, mas nenhum dado de ponto foi identificado.");
            addLog("ALERTA: Nenhuma linha válida encontrada. Verifique o formato.");
        }

        // Agrupamento
        const grouped = recordsFromFile.reduce((acc, r) => {
            if(r.status !== 'success') return acc;
            const key = `${r.funcionario_id}-${r.data_hora_texto.split(' ')[0]}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(r);
            return acc;
        }, {});

        const finalRecords = [];
        const tipos = ['Entrada', 'Almoço Ini', 'Almoço Fim', 'Saída'];
        
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

        if (display.length > 0) {
            toast.success(`Sucesso! ${display.length} registros encontrados.`);
        }

    } catch (error) {
        addLog(`ERRO FATAL: ${error.message}`);
        toast.error("Falha ao ler arquivo. Veja o log abaixo.");
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
            observacao: 'Import via Mobile',
            organizacao_id: organizacaoId, 
        }));

        const batchSize = 50;
        for (let i = 0; i < payload.length; i += batchSize) {
            const { error } = await supabase.rpc('importar_registros_ponto_se_vazio', { 
                novos_registros: payload.slice(i, i + batchSize) 
            });
            if (error) throw error;
        }
    },
    onSuccess: () => {
        toast.success("Dados salvos no banco com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['registros_ponto'] });
        setProcessedRecords([]);
        setFile(null);
        if(onImport) onImport();
    },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`)
  });

  const triggerFileSelect = (e) => {
      if (e) e.preventDefault();
      fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-full space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 w-full">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faUpload} className="text-blue-500"/> 
                Importar Arquivo
            </h2>
            {isProcessing && <span className="text-xs font-bold text-blue-600 animate-pulse">Lendo...</span>}
        </div>
        
        <label 
            htmlFor="mobile-ponto-upload-debug"
            className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200
                ${isProcessing ? 'bg-gray-50 border-gray-300 opacity-50' : 'bg-blue-50 border-blue-300 hover:bg-blue-100 active:bg-blue-200'}
            `}
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                {isProcessing ? (
                    <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-3xl mb-2" />
                ) : (
                    <FontAwesomeIcon icon={faFolderOpen} className="text-blue-500 text-3xl mb-2" />
                )}
                <p className="text-sm text-gray-700 text-center px-4 font-bold">
                    {file ? file.name : 'Toque aqui para selecionar'}
                </p>
            </div>
        </label>

        {/* INPUT PELADO (Sem accept para compatibilidade máxima) */}
        <input 
            id="mobile-ponto-upload-debug"
            ref={fileInputRef}
            type="file" 
            className="hidden" 
            onChange={handleFileChange} 
            disabled={isProcessing} 
        />

        <div className="mt-2 text-center">
            <button type="button" onClick={triggerFileSelect} className="text-xs text-blue-600 underline p-2">
                Problemas? Clique aqui (Modo Alternativo)
            </button>
        </div>

        {/* ÁREA DE DIAGNÓSTICO (Raio-X) */}
        {debugLog.length > 0 && (
            <div className="mt-4 p-3 bg-gray-900 rounded-md border border-gray-700">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faBug} /> Diagnóstico do Sistema
                </h4>
                <div className="h-32 overflow-y-auto font-mono text-[10px] text-green-400 space-y-1">
                    {debugLog.map((log, i) => (
                        <div key={i} className="border-b border-gray-800 pb-1">{log}</div>
                    ))}
                </div>
            </div>
        )}
      </div>
      
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