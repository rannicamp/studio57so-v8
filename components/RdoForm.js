"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/client'; //

// Função auxiliar para debounce
const debounce = (func, delay) => {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
};

export default function RdoForm({ selectedEmpreendimento }) {
  const supabase = createClient(); //
  const [activities, setActivities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState('');
  const [loadingForm, setLoadingForm] = useState(true);

  // Estado principal do formulário RDO (diarios_obra)
  const [rdoFormData, setRdoFormData] = useState({
    id: null, // ID do RDO existente, se houver
    data_relatorio: new Date().toISOString().split('T')[0], // Data de hoje por padrão
    rdo_numero: '',
    condicoes_climaticas: 'Ensolarado',
    condicoes_trabalho: 'Praticável',
  });

  // Estados para as seções dinâmicas que serão salvas separadamente
  const [activityStatuses, setActivityStatuses] = useState([]);
  const [employeePresences, setEmployeePresences] = useState([]);
  // Removido estados relacionados a Ocorrências e Fotos para simplificar

  const [isRdoLocked, setIsRdoLocked] = useState(false); // Novo estado para controlar o bloqueio

  const weatherOptions = ["Ensolarado", "Nublado", "Chuvoso", "Parcialmente Nublado", "Ventania", "Tempestade"];

  // Refs para debouncing de saves
  const debouncedSaveRdoMain = useRef(
    debounce(async (dataToUpdate) => { // Recebe os dados para atualização
      setMessage('Salvando automaticamente...');
      const { error } = await supabase
        .from('diarios_obra') //
        .update({
          condicoes_climaticas: dataToUpdate.condicoes_climaticas,
          condicoes_trabalho: dataToUpdate.condicoes_trabalho,
          mao_de_obra: dataToUpdate.mao_de_obra, // Salvando a lista atualizada de mão de obra
          status_atividades: dataToUpdate.status_atividades, // Salvando o status das atividades como JSONB
        })
        .eq('id', dataToUpdate.id);

      if (error) {
        console.error("Erro no autosave do RDO principal:", error);
        setMessage(`Erro no salvamento automático: ${error.message}`);
      } else {
        setMessage('Salvo automaticamente!');
        setTimeout(() => setMessage(''), 2000);
      }
    }, 1000)
  ).current;

  // --- EFEITO PARA DETERMINAR O BLOQUEIO DO RDO ---
  // Este useEffect roda sempre que rdoFormData.data_relatorio muda
  useEffect(() => {
    if (!rdoFormData.data_relatorio) return; // Garante que a data esteja disponível

    // Formata a data atual e a data do RDO para strings 'YYYY-MM-DD' para comparação
    const todayFormatted = new Date().toISOString().split('T')[0];
    const rdoDateFormatted = rdoFormData.data_relatorio;
    
    // Lógica de bloqueio simplificada: bloqueado se a data do RDO NÃO É hoje
    const locked = rdoDateFormatted !== todayFormatted;

    setIsRdoLocked(locked);
    if (locked) {
      setMessage('Este RDO está fechado para edição.');
    } else {
      setMessage(''); // Limpa a mensagem se não estiver bloqueado
    }
  }, [rdoFormData.data_relatorio]); // Dispara quando a data do RDO muda


  // --- EFEITO DE CARREGAMENTO INICIAL DO RDO (OU CRIAÇÃO) ---
  useEffect(() => {
    const loadRdoData = async () => {
      setLoadingForm(true); // Garante que o estado de carregamento está ativo
      setMessage('');

      try { // Adicionado try-catch-finally para capturar erros
        // 1. Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setCurrentUser(user);

        // 2. Fetch existing RDO for selected empreendimento and today's date
        // Removido rdo_fotos_uploads(*) e ocorrencias(*) para simplificar a busca e evitar o erro
        const { data: existingRdo, error: fetchRdoError } = await supabase
          .from('diarios_obra') //
          .select('*') // Agora busca apenas os campos diretos de diarios_obra
          .eq('empreendimento_id', selectedEmpreendimento.id) //
          .eq('data_relatorio', rdoFormData.data_relatorio) // Busca pelo RDO de hoje
          .limit(1);

        if (fetchRdoError) throw fetchRdoError;

        // Fetch atividades e funcionários (sempre necessários para o formulário)
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('activities') //
          .select('id, nome, status')
          .eq('empreendimento_id', selectedEmpreendimento.id) //
          .order('nome');

        if (activitiesError) throw activitiesError;
        setActivities(activitiesData || []);

        const { data: employeesData, error: employeesError } = await supabase
          .from('funcionarios') //
          .select('id, full_name')
          .eq('empreendimento_atual_id', selectedEmpreendimento.id) //
          .order('full_name');

        if (employeesError) throw employeesError;
        setEmployees(employeesData || []);


        let currentRdoId = null;
        let nextRdoNum = 1; // Default para novo RDO

        if (existingRdo && existingRdo.length > 0) {
          // --- RDO EXISTENTE ENCONTRADO ---
          const rdo = existingRdo[0];
          currentRdoId = rdo.id;

          setRdoFormData({
            id: rdo.id,
            data_relatorio: rdo.data_relatorio,
            rdo_numero: rdo.rdo_numero,
            condicoes_climaticas: rdo.condicoes_climaticas,
            condicoes_trabalho: rdo.condicoes_trabalho,
          });

          // GARANTIR QUE mao_de_obra e status_atividades SÃO SEMPRE ARRAYS
          // Corrigido para tratar rdo.mao_de_obra como JSONB que pode ser null
          setEmployeePresences(rdo.mao_de_obra && typeof rdo.mao_de_obra === 'object' ? rdo.mao_de_obra : []);
          // Removido carregamento de Ocorrências e Fotos
          // setAllOccurrences(rdo.ocorrencias || []);
          // setAllPhotosMetadata(rdo.rdo_fotos_uploads || []);

          // Mesclar status das atividades do DB com o snapshot salvo no RDO
          const mergedActivities = (activitiesData || []).map(dbAct => {
              // Corrigido para tratar rdo.status_atividades como JSONB que pode ser null
              const rdoActivity = (rdo.status_atividades && typeof rdo.status_atividades === 'object' ? rdo.status_atividades : []).find(sa => sa.id === dbAct.id); //
              return {
                  id: dbAct.id,
                  nome: dbAct.nome,
                  status: rdoActivity ? rdoActivity.status : dbAct.status, // Use RDO status if available, else DB status
                  observacao: rdoActivity ? rdoActivity.observacao : '',
              };
          });
          setActivityStatuses(mergedActivities);

        } else {
          // --- NENHUM RDO EXISTENTE: CRIAR UM NOVO ---
          const { data: latestRdoNumData, error: numError } = await supabase
            .from('diarios_obra') //
            .select('rdo_numero') //
            .eq('empreendimento_id', selectedEmpreendimento.id) //
            .order('rdo_numero', { ascending: false }) //
            .limit(1);

          if (!numError && latestRdoNumData && latestRdoNumData.length > 0) {
            nextRdoNum = parseInt(latestRdoNumData[0].rdo_numero || '0') + 1;
          }
          
          // Dados iniciais para o novo RDO (baseado no estado inicial do rdoFormData)
          const initialRdoData = {
            empreendimento_id: selectedEmpreendimento.id, //
            data_relatorio: rdoFormData.data_relatorio, //
            rdo_numero: nextRdoNum.toString(), //
            responsavel_rdo: user ? user.email : 'Usuário Desconhecido', //
            condicoes_climaticas: rdoFormData.condicoes_climaticas, //
            condicoes_trabalho: rdoFormData.condicoes_trabalho, //
            mao_de_obra: (employeesData || []).map(emp => ({ id: emp.id, name: emp.full_name, present: true, observacao: '' })), // Inicializa mao_de_obra com todos presentes
            status_atividades: (activitiesData || []).map(act => ({ id: act.id, nome: act.nome, status: act.status, observacao: '' })), // Inicializa status_atividades
          };

          const { data: newRdoData, error: createError } = await supabase
            .from('diarios_obra') //
            .insert([initialRdoData])
            .select();

          if (createError) throw createError;

          currentRdoId = newRdoData[0].id;
          // Atualiza o estado do formulário com o ID e número gerados
          setRdoFormData(prev => ({
              ...prev,
              id: currentRdoId,
              rdo_numero: nextRdoNum.toString(),
          }));
          
          // Resetar estados para o novo RDO
          setEmployeePresences((employeesData || []).map(emp => ({ id: emp.id, name: emp.full_name, present: true, observacao: '' })));
          setActivityStatuses((activitiesData || []).map(act => ({ id: act.id, nome: act.nome, status: act.status, observacao: '' })));
          // Removido reset de Ocorrências e Fotos
          // setAllOccurrences([]);
          // setAllPhotosMetadata([]);
        }
      } catch (error) {
        console.error("Erro no carregamento/inicialização do RDO:", error);
        setMessage(`Erro ao carregar/iniciar RDO: ${error.message}`);
      } finally {
        setLoadingForm(false); // Garante que o estado de carregamento seja desativado
      }
    };

    if (selectedEmpreendimento) {
      loadRdoData();
    }
  }, [selectedEmpreendimento, rdoFormData.data_relatorio, supabase]); // Depende do empreendimento e da data do RDO

  // --- EFEITO PARA AUTOSAVE DO RDO PRINCIPAL (condições, mao_de_obra, status_atividades) ---
  useEffect(() => {
    // Só faz autosave se o RDO já tem um ID (já foi criado/carregado) e não está bloqueado
    if (rdoFormData.id && !isRdoLocked) {
      // Passa todos os dados relevantes para o debounce
      debouncedSaveRdoMain({
        id: rdoFormData.id,
        condicoes_climaticas: rdoFormData.condicoes_climaticas,
        condicoes_trabalho: rdoFormData.condicoes_trabalho,
        mao_de_obra: employeePresences,
        status_atividades: activityStatuses, // Inclui activityStatuses para autosave
      });
    }
  }, [
    rdoFormData.condicoes_climaticas,
    rdoFormData.condicoes_trabalho,
    employeePresences, // Mão de obra também
    activityStatuses, // E status das atividades
    rdoFormData.id,
    isRdoLocked,
    debouncedSaveRdoMain
  ]);


  const handleRdoFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRdoFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'Praticável' : 'Não Praticável') : value,
    }));
  };

  const handleActivityStatusChange = async (activityId, newStatus, newObservation) => {
    if (isRdoLocked) return;

    // Atualiza o estado local das atividades
    const updatedActivityStatuses = activityStatuses.map(act =>
      act.id === activityId ? { ...act, status: newStatus, observacao: newObservation } : act
    );
    setActivityStatuses(updatedActivityStatuses);

    setMessage('Atualizando atividade...');
    // Atualiza o status global da atividade na tabela 'activities'
    const { error: activityTableUpdateError } = await supabase
      .from('activities') //
      .update({ status: newStatus }) //
      .eq('id', activityId);

    if (activityTableUpdateError) {
      console.error(`Erro ao atualizar status da atividade ${activityId} na tabela activities:`, activityTableUpdateError);
      setMessage(`Erro ao atualizar atividade global: ${activityTableUpdateError.message}`);
    } else {
        setMessage('Status da atividade atualizado!');
        setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleEmployeeObservationChange = (employeeId, newObservation) => {
    if (isRdoLocked) return;
    setEmployeePresences(prev =>
      prev.map(emp =>
        emp.id === employeeId ? { ...emp, observacao: newObservation } : emp
      )
    );
    // O autosave do RDO principal (que inclui employeePresences) já cuidará disso
  };

  // Removido handleNewOccurrenceChange, handleAddOccurrence, handleRemoveOccurrence para simplificar

  const handlePhotoFileSelect = (e) => {
    if (isRdoLocked) return;
    if (e.target.files && e.target.files[0]) {
      setCurrentPhotoFile(e.target.files[0]);
    } else {
      setCurrentPhotoFile(null);
    }
  };

  // Removido handleAddPhotoToList, handleRemovePhoto para simplificar

  const handleFinalSave = async (e) => {
    e.preventDefault(); // Previna o comportamento padrão do formulário
    if (isRdoLocked) return;

    setMessage('Finalizando e salvando RDO...');

    // Este botão garante que os dados principais do RDO (incluindo status_atividades)
    // e mão de obra sejam salvos uma última vez, caso o debounce não tenha sido acionado.
    const { error: finalRdoUpdateError } = await supabase
      .from('diarios_obra') //
      .update({
        condicoes_climaticas: rdoFormData.condicoes_climaticas, //
        condicoes_trabalho: rdoFormData.condicoes_trabalho, //
        mao_de_obra: employeePresences, //
        status_atividades: activityStatuses, // Salva o snapshot final dos status das atividades no RDO
      })
      .eq('id', rdoFormData.id);

    if (finalRdoUpdateError) {
      setMessage(`Erro ao finalizar RDO: ${finalRdoUpdateError.message}`);
      console.error("Erro ao finalizar RDO:", finalRdoUpdateError);
    } else {
      setMessage('RDO salvo e finalizado com sucesso!');
      // Resetar formulário para um novo RDO do dia seguinte ou para nova seleção
      const nextRdoNum = parseInt(rdoFormData.rdo_numero) + 1;
      setRdoFormData({
        id: null,
        data_relatorio: new Date().toISOString().split('T')[0],
        rdo_numero: nextRdoNum.toString(),
        condicoes_climaticas: 'Ensolarado',
        condicoes_trabalho: 'Praticável',
      });
      setActivityStatuses([]);
      setEmployees([]);
      setEmployeePresences([]);
      // Removido reset de Ocorrências e Fotos
      // setAllOccurrences([]);
      // setAllPhotosMetadata([]);
      // setCurrentNewOccurrence({ tipo: occurrenceTypes[0], descricao: '' });
      setCurrentPhotoFile(null);
      setCurrentPhotoDescription('');
      setTimeout(() => setMessage(''), 5000);
      // Recarregar os dados do empreendimento para um RDO limpo, caso o usuário não troque
      // window.location.reload(); // Pode ser uma opção mais agressiva
    }
  };


  if (loadingForm) {
    return <p className="text-center mt-10">Carregando dados do empreendimento...</p>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Detalhes do RDO para {selectedEmpreendimento.nome}</h2>
      <p className="text-gray-700 mb-4">
        **Endereço:** {selectedEmpreendimento.address_street || 'N/A'}, {selectedEmpreendimento.address_number || 'N/A'} - {selectedEmpreendimento.neighborhood || 'N/A'}, {selectedEmpreendimento.city || 'N/A'} - {selectedEmpreendimento.state || 'N/A'}
      </p>

      {isRdoLocked && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
          <p className="font-bold">RDO Fechado!</p>
          <p>Este RDO não pode mais ser editado, pois não é a data atual.</p>
        </div>
      )}

      <form onSubmit={handleFinalSave} className="space-y-6">
        {/* Seção 1: Cabeçalho do RDO */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="data_relatorio" className="block text-sm font-medium text-gray-700">Data do Relatório</label>
              <input type="date" name="data_relatorio" id="data_relatorio" value={rdoFormData.data_relatorio} readOnly disabled={true} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"/>
            </div>
            <div>
              <label htmlFor="rdo_numero" className="block text-sm font-medium text-gray-700">Número do RDO</label>
              <input type="text" name="rdo_numero" id="rdo_numero" value={rdoFormData.rdo_numero} readOnly disabled={true} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"/>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Responsável pelo Preenchimento</label>
              <p className="mt-1 p-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 text-sm">
                {currentUser ? currentUser.email : 'Carregando...'}
              </p>
            </div>
          </div>
        </div>

        {/* Seção 2: Condições Climáticas e Praticáveis */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Condições Climáticas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label htmlFor="condicoes_climaticas" className="block text-sm font-medium text-gray-700">Condição</label>
              <select name="condicoes_climaticas" id="condicoes_climaticas" value={rdoFormData.condicoes_climaticas} onChange={handleRdoFormChange} disabled={isRdoLocked} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                {weatherOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="condicoes_trabalho" className="block text-sm font-medium text-gray-700 cursor-pointer">Condições Praticáveis?</label>
              <input
                type="checkbox"
                name="condicoes_trabalho"
                id="condicoes_trabalho"
                checked={rdoFormData.condicoes_trabalho === 'Praticável'}
                onChange={handleRdoFormChange}
                disabled={isRdoLocked}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                {rdoFormData.condicoes_trabalho === 'Praticável' ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>
        </div>

        {/* Seção 3: Status das Atividades */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Status das Atividades</h3>
          {activities.length === 0 ? (
            <p className="text-gray-500">Nenhuma atividade encontrada para este empreendimento.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {activityStatuses.map((activity) => (
                <li key={activity.id} className="py-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <span className="font-medium text-gray-900 w-full md:w-1/2">{activity.nome}</span>
                    <select
                      value={activity.status}
                      onChange={(e) => handleActivityStatusChange(activity.id, e.target.value, activity.observacao)}
                      disabled={isRdoLocked}
                      className="p-1 border border-gray-300 rounded-md text-sm w-full md:w-1/4"
                    >
                      <option value="Não iniciado">Não Iniciado</option>
                      <option value="Em andamento">Em Andamento</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Pausado">Pausado</option>
                      <option value="Aguardando material">Aguardando Material</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Observação..."
                      value={activity.observacao}
                      onChange={(e) => handleActivityStatusChange(activity.id, activity.status, e.target.value)}
                      disabled={isRdoLocked}
                      className="mt-1 md:mt-0 block w-full md:w-1/4 p-2 border border-gray-300 rounded-md shadow-sm text-sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Seção 4: Mão de Obra */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Mão de Obra</h3>
          {employees.length === 0 ? (
            <p className="text-gray-500">Nenhum funcionário alocado a este empreendimento.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {employeePresences.map((employee) => (
                <li key={employee.id} className="py-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <span className="font-medium text-gray-900 w-full md:w-1/2">{employee.name}</span>
                    <div className="flex items-center gap-2 w-full md:w-1/4">
                      <button
                        type="button"
                        onClick={() => { if (!isRdoLocked) setEmployeePresences(prev => prev.map(emp => emp.id === employee.id ? { ...emp, present: !emp.present } : emp)); }}
                        disabled={isRdoLocked}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          employee.present ? 'bg-green-500' : 'bg-red-500'
                        } ${isRdoLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        role="switch"
                        aria-checked={employee.present}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            employee.present ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`ml-1 text-sm font-medium ${employee.present ? 'text-green-700' : 'text-red-700'}`}>
                        {employee.present ? 'Presente' : 'Faltou'}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Observação do funcionário..."
                      value={employee.observacao}
                      onChange={(e) => handleEmployeeObservationChange(employee.id, e.target.value)}
                      disabled={isRdoLocked}
                      className="mt-1 md:mt-0 block w-full md:w-1/4 p-2 border border-gray-300 rounded-md shadow-sm text-sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Seção 5: Ocorrências do Dia - Removida */}
        {/*
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Ocorrências do Dia</h3>
          <div className="flex flex-col md:flex-row gap-4 mb-3">
            <div className="flex-1">
              <label htmlFor="occurrence-type" className="sr-only">Tipo de Ocorrência</label>
              <select
                id="occurrence-type"
                name="tipo"
                value={currentNewOccurrence.tipo}
                onChange={handleNewOccurrenceChange}
                disabled={isRdoLocked}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
              >
                {occurrenceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="flex-2 w-full md:w-1/2">
              <label htmlFor="occurrence-description" className="sr-only">Descrição da Ocorrência</label>
              <textarea
                id="occurrence-description"
                name="descricao"
                value={currentNewOccurrence.descricao}
                onChange={handleNewOccurrenceChange}
                rows="1"
                placeholder="Descreva a ocorrência..."
                disabled={isRdoLocked}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
              ></textarea>
            </div>
            <button
              type="button"
              onClick={handleAddOccurrence}
              disabled={isRdoLocked || !rdoFormData.id}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 self-end md:self-auto disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Adicionar
            </button>
          </div>
          {allOccurrences.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma ocorrência adicionada para este RDO.</p>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
              {allOccurrences.map((occ) => (
                <li key={occ.id} className="p-3 flex justify-between items-center text-sm">
                  <div>
                    <span className={`font-semibold ${occ.tipo === 'Grave' || occ.tipo === 'Gravíssimo' ? 'text-red-600' : 'text-blue-700'}`}>
                      {occ.tipo}:
                    </span> {occ.descricao}
                    <span className="block text-gray-500 text-xs">({occ.data_ocorrencia} {occ.hora_ocorrencia})</span>
                  </div>
                  <button type="button" onClick={() => handleRemoveOccurrence(occ.id)} disabled={isRdoLocked} className="text-red-500 hover:text-red-700 text-lg px-2 py-1 leading-none disabled:opacity-50 disabled:cursor-not-allowed">&times;</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        */}

        {/* Seção 6: Fotos do Dia - Removida */}
        {/*
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Fotos do Dia</h3>
          <div className="flex flex-col md:flex-row gap-4 mb-3 items-end">
            <div className="flex-1">
              <label htmlFor="photo-file-input" className="block text-sm font-medium text-gray-700">Selecionar Arquivo</label>
              <input
                type="file"
                id="photo-file-input"
                accept="image/*"
                onChange={handlePhotoFileSelect}
                disabled={isRdoLocked}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="photo-description-input" className="block text-sm font-medium text-gray-700">Descrição da Foto (Opcional)</label>
              <input
                type="text"
                id="photo-description-input"
                value={currentPhotoDescription}
                onChange={(e) => setCurrentPhotoDescription(e.target.value)}
                placeholder="Descrição da foto..."
                disabled={isRdoLocked}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAddPhotoToList}
              disabled={isRdoLocked || !currentPhotoFile || !rdoFormData.id}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 self-end md:self-auto disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Adicionar Foto
            </button>
          </div>

          {allPhotosMetadata.length === 0 ? (
            <p className="text-gray-500 text-sm mt-3">Nenhuma foto adicionada para este RDO.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {allPhotosMetadata.map((photo) => (
                <div key={photo.id} className="relative aspect-video overflow-hidden rounded-md group border border-gray-200">
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rdo-fotos/${photo.caminho_arquivo}`}
                    alt={`Foto do RDO ${photo.id}`}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gray-800 bg-opacity-75 text-white text-xs p-1">
                    {photo.descricao && <span className="block truncate">{photo.descricao}</span>}
                    <span className="block text-gray-300">{new Date(photo.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo.id)}
                    disabled={isRdoLocked}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Remover foto"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        */}

        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={isRdoLocked} className="bg-blue-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
            {isRdoLocked ? 'RDO Fechado' : 'Salvar RDO'}
          </button>
        </div>
        {message && <p className="text-center mt-4 text-sm font-medium">{message}</p>}
      </form>
    </div>
  );
}