"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faFileCsv, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// Componente para exibir o status da importação de uma linha
const StatusIndicator = ({ status, message }) => {
    if (status === 'success') {
        return <span className="text-green-600 flex items-center gap-1 text-xs"><FontAwesomeIcon icon={faCheckCircle} /> Pronto</span>;
    }
    if (status === 'error') {
        return <span className="text-red-600 flex items-center gap-1 text-xs" title={message}><FontAwesomeIcon icon={faExclamationTriangle} /> Erro</span>;
    }
    return null;
};

export default function PontoImporter({ employees, onImport, showToast }) {
  const supabase = createClient();
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
    showToast('Lendo e processando o arquivo...', 'info');

    const content = await selectedFile.text();
    const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '');

    const recordsFromFile = [];
    lines.forEach((line, index) => {
      const parts = line.split('\t');
      if (parts.length < 4) return;
      
      const numeroPonto = parseInt(parts[0], 10);
      const dateTimeString = parts[3].trim();
      const [datePart, timePart] = dateTimeString.split(/\s+/);

      if (datePart && timePart) {
          const [day, month, year] = datePart.split('/');
          const isoDateTime = `${year}-${month}-${day}T${timePart}`;
          const date = new Date(isoDateTime);
          
          const employeeInfo = employeeMap.get(numeroPonto);
          recordsFromFile.push({
              numero_ponto: numeroPonto,
              employee_name: employeeInfo?.name,
              funcionario_id: employeeInfo?.id,
              data_hora: date,
              original_line: index + 1,
              status: employeeInfo ? 'success' : 'error',
              error_message: employeeInfo ? null : `Funcionário com Nº de Ponto "${numeroPonto}" não encontrado.`
          });
      }
    });

    const groupedByEmployeeAndDay = recordsFromFile.reduce((acc, record) => {
        if(record.status !== 'success') return acc;
        const dayKey = record.data_hora.toISOString().split('T')[0];
        const key = `${record.funcionario_id}-${dayKey}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(record);
        return acc;
    }, {});

    const finalRecords = [];
    const tipos = ['Entrada', 'Inicio_Intervalo', 'Fim_Intervalo', 'Saida'];
    for (const key in groupedByEmployeeAndDay) {
        const dayRecords = groupedByEmployeeAndDay[key].sort((a, b) => a.data_hora - b.data_hora);
        dayRecords.forEach((record, index) => {
            if (index < tipos.length) {
                finalRecords.push({ ...record, tipo_registro: tipos[index] });
            }
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

    showToast(`Arquivo processado: ${readyCount} registros prontos, ${errorCount} com erros.`, 'info');
    setIsProcessing(false);
  };

  const handleImport = async () => {
    const recordsToInsert = processedRecords.filter(r => r.status === 'success');
    if (recordsToInsert.length === 0) {
      showToast('Nenhum registro válido para importar.', 'error');
      return;
    }
    
    setIsProcessing(true);
    showToast(`Importando ${recordsToInsert.length} registros...`, 'info');
    
    const recordsForDb = recordsToInsert.map(rec => ({
      funcionario_id: rec.funcionario_id,
      data_hora: rec.data_hora.toISOString(),
      tipo_registro: rec.tipo_registro,
      observacao: 'Importado via arquivo TXT'
    }));

    // ***** INÍCIO DA MODIFICAÇÃO *****
    // Chama a nova função segura no banco de dados que não sobrescreve dados
    const { error } = await supabase.rpc('importar_registros_ponto_se_vazio', {
        novos_registros: recordsForDb
    });
    // ***** FIM DA MODIFICAÇÃO *****

    if (error) {
      showToast(`Erro ao importar os registros: ${error.message}`, 'error');
      console.error(error);
    } else {
      showToast(`${recordsToInsert.length} registros foram importados com sucesso! Campos já preenchidos foram ignorados.`, 'success');
      setFile(null);
      setProcessedRecords([]);
      setSummary({ ready: 0, errors: 0 });
      if (onImport) onImport();
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        {/* ***** INÍCIO DA MODIFICAÇÃO: Textos atualizados ***** */}
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Importar Ponto (.txt)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Selecione o arquivo de ponto. O sistema irá adicionar as batidas de ponto apenas nos campos que estiverem vazios. <strong>Registros manuais ou já existentes não serão sobrescritos.</strong>
        </p>
        {/* ***** FIM DA MODIFICAÇÃO ***** */}
        <input
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          disabled={isProcessing}
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
                    <td className="px-4 py-2 whitespace-nowrap">{rec.data_hora.toLocaleString('pt-BR')}</td>
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
            {/* ***** INÍCIO DA MODIFICAÇÃO: Textos atualizados ***** */}
            <button
              onClick={handleImport}
              disabled={isProcessing || summary.ready === 0}
              className="bg-green-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Importando...' : `Confirmar e Importar ${summary.ready} Registros`}
            </button>
            {/* ***** FIM DA MODIFICAÇÃO ***** */}
          </div>
        </div>
      )}
    </div>
  );
}