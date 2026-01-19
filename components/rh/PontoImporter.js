// components/rh/PontoImporter.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCloud, 
  faCheckCircle, 
  faExclamationTriangle, 
  faSpinner, 
  faFileImport,
  faBug,
  faUserCheck
} from '@fortawesome/free-solid-svg-icons';

import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// --- MÁSCARA PT-BR ---
const pt_BR = {
  strings: {
    addMore: 'Adicionar mais',
    addMoreFiles: 'Adicionar mais arquivos',
    browse: 'busque aqui',
    browseFiles: 'selecionar arquivos',
    cancel: 'Cancelar',
    complete: 'Concluído',
    dashboardTitle: 'Envio de Arquivos',
    dropPasteFiles: 'Arraste arquivos aqui ou %{browse}',
    fileProgress: 'Progresso do arquivo',
    removeFile: 'Remover arquivo',
    upload: 'Enviar',
    uploadComplete: 'Envio concluído',
    uploading: 'Enviando',
  }
};

const StatusIndicator = ({ status, message }) => {
    if (status === 'success') return <span className="text-green-600 flex items-center gap-1 text-xs"><FontAwesomeIcon icon={faCheckCircle} /> Pronto</span>;
    if (status === 'error') return <span className="text-red-500 flex items-center gap-1 text-xs" title={message}><FontAwesomeIcon icon={faExclamationTriangle} /> Erro</span>;
    return <span className="text-gray-400 text-xs">...</span>;
};

const formatDbStringToBr = (dbString) => {
    if (!dbString) return '-';
    const [datePart, timePart] = dbString.split(' ');
    if (!datePart) return '-';
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year} ${timePart?.slice(0,5)}`;
};

export default function PontoImporter({ onImport }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const BUCKET_NAME = 'arquivos-ponto'; 
  
  const dashboardContainerRef = useRef(null);
  const latestEmployees = useRef([]); 

  const [processedRecords, setProcessedRecords] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState({ ready: 0, errors: 0 });
  
  // Debug para te dar segurança
  const [debugInfo, setDebugInfo] = useState('');

  // 1. BUSCAR FUNCIONÁRIOS (Para não depender de props e ser autônomo)
  const { data: employees = [] } = useQuery({
    queryKey: ['funcionarios_ponto_fixo_v3'], 
    queryFn: async () => {
        const { data, error } = await supabase
            .from('funcionarios')
            .select('id, full_name, numero_ponto, organizacao_id')
            .not('numero_ponto', 'is', null);
        if (error) throw error;
        return data;
    },
    staleTime: 0 
  });

  useEffect(() => {
    if (employees) {
        latestEmployees.current = employees;
    }
  }, [employees]);

  // --- 2. CONFIGURAÇÃO DO UPPY ---
  const [uppy] = useState(() => {
    if (typeof window === 'undefined') return null;
    const uppyInstance = new Uppy({
      id: 'ponto-importer-final-v13', 
      locale: pt_BR, 
      autoProceed: false,      
      restrictions: { maxFileSize: 10 * 1024 * 1024, maxNumberOfFiles: 1, allowedFileTypes: ['.txt', '.csv', 'text/*'] },
    });
    uppyInstance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });
    return uppyInstance;
  });

  // --- 3. DASHBOARD ---
  useEffect(() => {
    if (!uppy || !dashboardContainerRef.current) return;
    if (!uppy.getPlugin('Dashboard')) {
        uppy.use(DashboardPlugin, {
            id: 'Dashboard',
            target: dashboardContainerRef.current,
            inline: true,
            width: '100%',
            height: 280, 
            showProgressDetails: true,
            hideUploadButton: false, 
        });
    }
  }, [uppy]);

  // --- 4. UPLOAD E PONTE PARA SUA LÓGICA ---
  useEffect(() => {
    if (!uppy) return;
    const uploaders = uppy.getPlugin('uploader');
    if (uploaders) return; 

    const uploadToSupabaseAndRead = async (fileIDs) => {
      if (fileIDs.length === 0) return Promise.resolve();
      setIsProcessing(true);
      setProcessedRecords([]); 
      setDebugInfo('Iniciando upload e leitura...');

      const promises = fileIDs.map(async (id) => {
        const file = uppy.getFile(id);
        try {
          // 1. Upload
          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: 0, bytesTotal: file.data.size });
          const fileName = `import_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          
          const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file.data, { contentType: 'text/plain', upsert: true });
          if (error) throw error;

          // 2. Baixar Conteúdo
          const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
          const response = await fetch(publicData.publicUrl);
          const textContent = await response.text();

          // 3. CHAMAR SUA LÓGICA
          processFileContent(textContent);

          uppy.emit('upload-success', file, { uploadURL: publicData.publicUrl, status: 200, body: data });
          uppy.removeFile(id); 
        } catch (err) {
          console.error(err);
          uppy.emit('upload-error', file, err);
          toast.error(`Falha: ${err.message}`);
          setIsProcessing(false);
        }
      });
      return Promise.all(promises);
    };
    uppy.addUploader(uploadToSupabaseAndRead);
  }, [uppy]);

  // --- 5. SUA LÓGICA EXATA (ADAPTADA PARA RECEBER TEXTO) ---
  const processFileContent = (content) => {
    const currentEmployees = latestEmployees.current;
    
    // Recria o Mapa exatamente como no seu código
    const employeeMap = new Map(currentEmployees.map(emp => [emp.numero_ponto, { 
        id: emp.id, 
        name: emp.full_name,
        organizacao_id: emp.organizacao_id // Adicionei isso pois é necessário para o insert
    }]));

    // Lógica de Linhas do seu código (Filtra vazias e que tenham TAB)
    const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '' && line.includes('\t'));
    
    setDebugInfo(`Linhas válidas (com TAB): ${lines.length}`);

    if (lines.length === 0) {
        toast.warning("Arquivo sem linhas válidas ou separador incorreto (TAB).");
        setIsProcessing(false);
        return;
    }

    const recordsFromFile = [];
    
    // Pula o cabeçalho (slice 1) igual ao seu código
    lines.slice(1).forEach((line, index) => {
        const parts = line.split('\t');
        if (parts.length < 4) return;
        
        // Pega ID da coluna 0
        const numeroPonto = parseInt(parts[0], 10);
        // Pega Data da coluna 3 (Seu segredo!)
        const dateTimeString = parts[3].trim();
        const [datePart, timePart] = dateTimeString.split(/\s+/);

        if (datePart && timePart && datePart.includes('/')) {
            const [day, month, year] = datePart.split('/');
            
            // Formato ISO para o banco
            const data_hora_texto = `${year}-${month}-${day} ${timePart}`;
            
            const employeeInfo = employeeMap.get(numeroPonto);
            
            recordsFromFile.push({
                numero_ponto: numeroPonto,
                employee_name: employeeInfo?.name,
                funcionario_id: employeeInfo?.id,
                organizacao_id: employeeInfo?.organizacao_id,
                data_hora_texto: data_hora_texto,
                original_line: index + 2,
                status: employeeInfo ? 'success' : 'error',
                error_message: employeeInfo ? null : `Func. Nº ${numeroPonto} não encontrado.`
            });
        }
    });

    // Seu Agrupamento
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

    // Mistura processados com erros para exibir
    const allDisplayRecords = [
        ...finalRecords,
        ...recordsFromFile.filter(r => r.status === 'error')
    ].sort((a,b) => a.original_line - b.original_line);

    setProcessedRecords(allDisplayRecords);
    const readyCount = allDisplayRecords.filter(r => r.status === 'success').length;
    setSummary({ ready: readyCount, errors: allDisplayRecords.length - readyCount });
    setIsProcessing(false);

    if (readyCount > 0) {
        toast.success(`${readyCount} registros processados!`);
    } else {
        toast.warning("Nenhum registro correspondente.");
    }
  };

  const importMutation = useMutation({
    mutationFn: async (records) => {
        const { data: { user } } = await supabase.auth.getUser();
        // Fallback para user org caso não ache no funcionário (segurança)
        const userOrg = user?.user_metadata?.organizacao_id;

        const payload = records.map(r => ({
            funcionario_id: r.funcionario_id,
            data_hora: r.data_hora_texto,
            tipo_registro: r.tipo_registro,
            observacao: 'Importado via Uppy (Mobile)',
            organizacao_id: r.organizacao_id || userOrg, 
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
        toast.success("Importação concluída com sucesso!");
        queryClient.invalidateQueries(['pontos']);
        queryClient.invalidateQueries(['registros_ponto']);
        setProcessedRecords([]);
        if (onImport) onImport();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`)
  });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <link href={UPPY_CSS_URL} rel="stylesheet" />

      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faCloud} className="text-blue-600"/>
          Importador de Ponto Digital
        </h3>
        <p className="text-sm text-gray-500 mb-4">Selecione o arquivo .txt do relógio.</p>
        
        {debugInfo && (
            <div className="text-xs text-blue-600 font-mono bg-blue-50 p-2 rounded mb-2 border border-blue-100">
                {debugInfo}
            </div>
        )}

        <div ref={dashboardContainerRef} className="uppy-dashboard-container" />
      </div>

      {isProcessing && (
          <div className="flex items-center justify-center py-8 text-blue-600 bg-blue-50 rounded-lg mb-4">
              <FontAwesomeIcon icon={faSpinner} spin className="mr-3 text-xl" />
              <span className="font-medium animate-pulse">Processando dados...</span>
          </div>
      )}

      {processedRecords.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
             <div className="flex items-center gap-3">
                 <h3 className="font-bold text-gray-800 text-lg">Pré-visualização</h3>
             </div>
             <div className="text-xs space-x-2">
                <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">{summary.ready} OK</span>
                {summary.errors > 0 && <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">{summary.errors} Erros</span>}
             </div>
          </div>

          <div className="border rounded-lg overflow-hidden mb-6 max-h-[300px] overflow-y-auto shadow-inner bg-slate-50">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Funcionário</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Data e Hora</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Registro</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedRecords.map((rec, i) => (
                  <tr key={i} className={rec.status === 'error' ? 'bg-red-50' : 'bg-white hover:bg-blue-50'}>
                    <td className="px-4 py-2 font-medium text-slate-700">
                        {rec.employee_name ? (
                            <span className="flex items-center gap-2 text-green-700 font-bold">
                                <FontAwesomeIcon icon={faUserCheck} /> {rec.employee_name.split(' ')[0]}
                            </span>
                        ) : <span className="text-gray-400 italic">#{rec.numero_ponto}</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                        {formatDbStringToBr(rec.data_hora_texto)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 font-bold text-xs uppercase tracking-wide">
                        {rec.tipo_registro || '-'}
                    </td>
                    <td className="px-4 py-2 text-right"><StatusIndicator status={rec.status} message={rec.error_message} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex gap-3">
            <button 
                onClick={() => setProcessedRecords([])} 
                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
            >
                Cancelar
            </button>
            <button
                onClick={() => importMutation.mutate(processedRecords.filter(r => r.status === 'success'))}
                disabled={importMutation.isPending || summary.ready === 0}
                className="flex-[2] bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {importMutation.isPending ? (
                    <><FontAwesomeIcon icon={faSpinner} spin /> Processando...</>
                ) : (
                    <><FontAwesomeIcon icon={faFileImport} /> Confirmar ({summary.ready})</>
                )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}