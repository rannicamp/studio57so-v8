const fs = require('fs');

let file = fs.readFileSync('app/(main)/atividades/actions-ai.js', 'utf8');

// 1. ADD TO SCHEMA
const schemaSearch = `duracao_dias: { type: "number", description: "Duração em dias. OBRIGATÓRIO PARA TAREFAS.", nullable: true },`;
const schemaReplace = `duracao_dias: { type: "number", description: "Duração em dias. OBRIGATÓRIO PARA TAREFAS.", nullable: true },
              is_recorrente: { type: "boolean", description: "Atividade repete (true/false)?", nullable: true },
              recorrencia_tipo: { type: "string", description: "diaria, semanal, mensal, ou anual.", nullable: true },
              recorrencia_intervalo: { type: "integer", description: "De quanto em quanto tempo se repete (ex: 1 = toda semana).", nullable: true },
              recorrencia_dias_semana: { type: "array", items: { type: "integer" }, description: "Array numérico: Segunda = 1, Terca = 2, Sexta = 5.", nullable: true },
              recorrencia_fim: { type: "string", description: "Data limite YYYY-MM-DD, opcional.", nullable: true },`;

file = file.replace(schemaSearch, schemaReplace);

// 2. ADD TO PROMPT
const promptSearch = `REGRA #3 - EDIÇÃO EXIGE BUSCA (TOOL CALLING):`;
const promptReplace = `REGRA #4 - ATIVIDADES RECORRENTES / ROTINAS:
        Se o usuário falar em rotina diária/semanal/mensal (ex: "verificar ordens de compra de segunda a sexta"), configure:
        - 'is_recorrente' = true.
        - 'recorrencia_tipo' = "semanal".
        - 'recorrencia_intervalo' = 1.
        - 'recorrencia_dias_semana' = [1, 2, 3, 4, 5] (para seg a sex).

        REGRA #3 - EDIÇÃO EXIGE BUSCA (TOOL CALLING):`;

file = file.replace(promptSearch, promptReplace);

// 3. ADD TO PAYLOAD
const payloadSearch = `duracao_horas: isEvent ? (activity.duracao_horas || 1) : null,`;
const payloadReplace = `duracao_horas: isEvent ? (activity.duracao_horas || 1) : null,

  is_recorrente: activity.is_recorrente || false,
  recorrencia_tipo: activity.recorrencia_tipo || null,
  recorrencia_intervalo: activity.recorrencia_intervalo || null,
  recorrencia_dias_semana: activity.recorrencia_dias_semana ? JSON.stringify(activity.recorrencia_dias_semana) : null,
  recorrencia_fim: activity.recorrencia_fim || null,`;

file = file.replace(payloadSearch, payloadReplace);

fs.writeFileSync('app/(main)/atividades/actions-ai.js', file);
