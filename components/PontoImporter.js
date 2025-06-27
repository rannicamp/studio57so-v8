"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client'; // Caminho ajustado para maior compatibilidade

export default function PontoImporter({ employees, onImport, showToast }) {
  const supabase = createClient();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedRecords, setProcessedRecords] = useState([]);

  // Cria um mapa para busca rápida do ID do funcionário pelo número do ponto
  const employeeMap = new Map(employees.map(emp => [emp.numero_ponto, { id: emp.id, name: emp.full_name }]));

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    showToast('Lendo e processando o arquivo...', 'info');

    const content = await selectedFile.text();
    const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '');

    const recordsFromFile = [];
    lines.forEach(line => {
      // O arquivo usa tabulação como separador.
      const parts = line.split('\t');
      if (parts.length >= 4) {
        const numeroPonto = parseInt(parts[0], 10);
        const dateTimeString = parts[3].trim();
        
        const [datePart, timePart] = dateTimeString.split(/\s+/);
        if (datePart && timePart) {
          const [day, month, year] = datePart.split('/');
          const isoDateTime = `${year}-${month}-${day}T${timePart}`;
          
          const employeeInfo = employeeMap.get(numeroPonto);
          if (employeeInfo) {
            recordsFromFile.push({
              numero_ponto: numeroPonto,
              employee_name: employeeInfo.name,
              funcionario_id: employeeInfo.id,
              data_hora: new Date(isoDateTime)
            });
          }
        }
      }
    });

    // Agrupa os registros por funcionário e por dia
    const groupedByEmployeeAndDay = recordsFromFile.reduce((acc, record) => {
      const dayKey = record.data_hora.toISOString().split('T')[0];
      const key = `${record.funcionario_id}-${dayKey}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, {});

    // Ordena os registros de cada dia e atribui o tipo (Entrada, Saída, etc.)
    const finalRecords = [];
    const tipos = ['Entrada', 'Inicio_Intervalo', 'Fim_Intervalo', 'Saida'];
    for (const key in groupedByEmployeeAndDay) {
      const dayRecords = groupedByEmployeeAndDay[key].sort((a, b) => a.data_hora - b.data_hora);
      dayRecords.forEach((record, index) => {
        if (index < tipos.length) {
          finalRecords.push({
            ...record,
            tipo_registro: tipos[index]
          });
        }
      });
    }
    
    setProcessedRecords(finalRecords);
    setIsProcessing(false);
    showToast(`${finalRecords.length} registros foram processados e estão prontos para importação.`, 'success');
  };

  const handleImport = async () => {
    if (processedRecords.length === 0) {
      showToast('Nenhum registro para importar.', 'error');
      return;
    }
    
    setIsProcessing(true);
    showToast('Iniciando a importação para o banco de dados...', 'info');
    
    const recordsToInsert = processedRecords.map(rec => ({
      funcionario_id: rec.funcionario_id,
      data_hora: rec.data_hora.toISOString(),
      tipo_registro: rec.tipo_registro,
      observacao: 'Importado via arquivo TXT'
    }));

    const { error } = await supabase.from('pontos').upsert(recordsToInsert, {
      onConflict: 'funcionario_id,data_hora,tipo_registro',
    });

    if (error) {
      showToast(`Erro ao salvar os registros: ${error.message}`, 'error');
      console.error(error);
    } else {
      showToast(`${processedRecords.length} registros de ponto importados com sucesso!`, 'success');
      setFile(null);
      setProcessedRecords([]);
      if (onImport) onImport();
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Importar Arquivo de Ponto (.txt)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Selecione o arquivo de texto gerado pelo seu relógio de ponto. O sistema irá ler os registros, identificar os funcionários e preparar os dados para importação.
        </p>
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
          <h3 className="text-xl font-bold text-gray-800 mb-4">Pré-visualização da Importação</h3>
          <p className="text-sm text-gray-600 mb-4">Confira os registros encontrados. O sistema atribui os tipos (Entrada, Intervalo, Saída) automaticamente com base na ordem dos horários para cada funcionário em um mesmo dia.</p>
          <div className="max-h-80 overflow-y-auto border rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Funcionário</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Data e Hora</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase">Registro Atribuído</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedRecords.map((rec, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{rec.employee_name}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{rec.data_hora.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{rec.tipo_registro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 text-right">
            <button
              onClick={handleImport}
              disabled={isProcessing}
              className="bg-green-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400"
            >
              {isProcessing ? 'Importando...' : `Confirmar e Importar ${processedRecords.length} Registros`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}