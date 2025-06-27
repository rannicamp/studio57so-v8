"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';

export default function PontoForm({ employees }) {
  const supabase = createClient();
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Mapeia o número do ponto para o ID do funcionário para facilitar a busca
  const employeeIdMap = new Map(employees.map(emp => [emp.numero_ponto, emp.id]));

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setMessage('Lendo o arquivo de ponto...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const lines = content.split(/\r\n|\n/);
      const pointRecords = [];

      lines.forEach(line => {
        const parts = line.split('\t').filter(p => p.trim() !== '');
        if (parts.length < 2) return; // Ignora linhas mal formatadas

        const numeroPonto = parseInt(parts[0], 10);
        const dateTimeString = parts[1];
        
        const employeeId = employeeIdMap.get(numeroPonto);

        if (employeeId && dateTimeString) {
          // Converte a data DD/MM/YYYY HH:mm:ss para o formato do Supabase
          const [datePart, timePart] = dateTimeString.trim().split(/\s+/);
          const [day, month, year] = datePart.split('/');
          const isoDateTime = `${year}-${month}-${day}T${timePart}`;

          pointRecords.push({
            funcionario_id: employeeId,
            data_hora: isoDateTime,
            tipo_registro: 'Batida', // Tipo genérico por enquanto
          });
        }
      });

      if (pointRecords.length === 0) {
        setMessage('Nenhum registro válido encontrado no arquivo.');
        setIsProcessing(false);
        return;
      }

      setMessage(`Encontrados ${pointRecords.length} registros. Salvando no banco de dados...`);

      const { error } = await supabase.from('pontos').insert(pointRecords);

      if (error) {
        setMessage(`Erro ao salvar os registros: ${error.message}`);
      } else {
        setMessage(`${pointRecords.length} registros de ponto importados com sucesso!`);
      }
      setIsProcessing(false);
    };

    reader.onerror = () => {
        setMessage('Erro ao ler o arquivo.');
        setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      {/* Seção de Importação */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Importar Arquivo de Ponto (.txt)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Selecione o arquivo de texto gerado pelo seu relógio de ponto para importar todas as batidas de uma vez.
        </p>
        <input
          type="file"
          accept=".txt"
          onChange={handleFileImport}
          disabled={isProcessing}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </div>

      {/* Mensagem de Feedback */}
      {message && (
        <div className={`p-4 rounded-md text-center font-semibold ${message.includes('Erro') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message}
        </div>
      )}

      {/* Seção de Lançamento Manual (funcionalidade a ser completada no futuro) */}
      <div className="bg-white p-6 rounded-lg shadow-md opacity-50">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Lançamento Manual</h2>
        <p className="text-sm text-gray-600 mb-4">
          Esta funcionalidade para adicionar batidas manualmente será desenvolvida em breve.
        </p>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Funcionário</label>
            <select disabled className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed">
              <option>Selecione um funcionário</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data</label>
              <input type="date" disabled className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hora</label>
              <input type="time" disabled className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed" />
            </div>
          </div>
          <div className="text-right">
            <button type="button" disabled className="bg-blue-300 text-white px-4 py-2 rounded-md cursor-not-allowed">
              Salvar Batida
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}