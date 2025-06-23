"use client";

import { Chart } from "react-google-charts";

export default function GanttChart({ activities }) {
  // Dados de exemplo para teste
  const exampleActivities = [
    { id: '1', nome: 'Tarefa de Exemplo 1', status: 'Em Andamento', data_inicio_prevista: '2025-06-01', data_fim_prevista: '2025-06-05', progresso: 50 },
    { id: '2', nome: 'Tarefa de Exemplo 2', status: 'Não Iniciado', data_inicio_prevista: '2025-06-06', data_fim_prevista: '2025-06-10', progresso: 0, dependencies: '1' },
    { id: '3', nome: 'Tarefa de Exemplo 3', status: 'Concluído', data_inicio_prevista: '2025-05-20', data_fim_prevista: '2025-05-25', progresso: 100 },
  ];

  // 1. Define as colunas que o Google Gantt espera
  const columns = [
    { type: "string", label: "ID da Tarefa" },
    { type: "string", label: "Nome da Tarefa" },
    { type: "string", label: "Recurso" }, // Podemos usar para status ou categoria
    { type: "date", label: "Data de Início" },
    { type: "date", label: "Data de Fim" },
    { type: "number", label: "Duração (em ms)" },
    { type: "number", label: "Progresso (%)" },
    { type: "string", label: "Dependências" },
  ];

  // 2. Transforma os dados dos nossos exemplos para o formato do Google Charts
  const rows = exampleActivities.map(act => {
    const startDate = act.data_inicio_prevista ? new Date(act.data_inicio_prevista.replace(/-/g, '/')) : null;
    const endDate = act.data_fim_prevista ? new Date(act.data_fim_prevista.replace(/-/g, '/')) : null;
    
    const duration = null;

    return [
      act.id.toString(),
      act.nome,
      act.status,
      startDate,
      endDate,
      duration,
      act.progresso || 0,
      act.dependencies || null,
    ];
  });

  const data = [columns, ...rows];

  // 3. Opções de customização para o gráfico
  const options = {
    height: (exampleActivities.length * 45) + 50,
    gantt: {
      trackHeight: 45,
      barHeight: 25,
      criticalPathEnabled: false,
      arrow: {
        angle: 100,
        width: 2,
        color: '#64748b',
        radius: 0
      },
    },
  };

  return (
    <div className="p-4 w-full">
      <Chart
        chartType="Gantt"
        width="100%"
        height="100%"
        data={data}
        options={options}
      />
    </div>
  );
}