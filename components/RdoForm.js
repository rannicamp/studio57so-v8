"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/client';

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
  const supabase = createClient();
  const [activities, setActivities] = useState([]);
  const [employees, setEmployees] = useState([]); // Lista completa de funcionários do empreendimento
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState('');
  const [loadingForm, setLoadingForm] = useState(true);
  const [isUploading, setIsUploading] = useState(false); // Para controlar o estado do upload de fotos

  // Estado principal do formulário RDO
  const [rdoFormData, setRdoFormData] = useState({
    id: null,
    data_relatorio: new Date().toISOString().split('T')[0],
    rdo_numero: '',
    condicoes_climaticas: 'Ensolarado',
    condicoes_trabalho: 'Praticável',
  });

  // Estados para as seções dinâmicas
  const [activityStatuses, setActivityStatuses] = useState([]);
  const [employeePresences, setEmployeePresences] = useState([]); // Estado que guarda a lista de presença (com present: true/false)
  
  // --- NOVOS ESTADOS PARA OCORRÊNCIAS E FOTOS ---
  const [allOccurrences, setAllOccurrences] = useState([]);
  const [currentNewOccurrence, setCurrentNewOccurrence] = useState({ tipo: 'Informativa', descricao: '' });
  const [allPhotosMetadata, setAllPhotosMetadata] = useState([]);
  const [currentPhotoFile, setCurrentPhotoFile] = useState(null);
  const [currentPhotoDescription, setCurrentPhotoDescription] = useState('');

  const [isRdoLocked, setIsRdoLocked] = useState(false);

  const weatherOptions = ["Ensolarado", "Nublado", "Chuvoso", "Parcialmente Nublado", "Ventania", "Tempestade"];
  const occurrenceTypes = ["Informativa", "Alerta", "Grave", "Acidente de Trabalho", "Condição Insegura"];


  const debouncedSaveRdoMain = useRef(
    debounce(async (dataToUpdate) => {
      setMessage('Salvando automaticamente...');
      const { error } = await supabase
        .from('diarios_obra')
        .update({
          condicoes_climaticas: dataToUpdate.condicoes_climaticas,
          condicoes_trabalho: dataToUpdate.condicoes_trabalho,
          mao_de_obra: dataToUpdate.mao_de_obra, 
          status_atividades: dataToUpdate.status_atividades,
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

  useEffect(() => {
    if (!rdoFormData.data_relatorio) return;
    const todayFormatted = new Date().toISOString().split('T')[0];
    const rdoDateFormatted = rdoFormData.data_relatorio;
    const locked = rdoDateFormatted !== todayFormatted;
    setIsRdoLocked(locked);
    if (locked) {
      setMessage('Este RDO está fechado para edição.');
    } else {
      setMessage('');
    }
  }, [rdoFormData.data_relatorio]);


  // Efeito de carregamento inicial do RDO (ou criação)
  useEffect(() => {
    const loadRdoData = async () => {
      setLoadingForm(true);
      setMessage('');

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setCurrentUser(user);

        // 1. Busca atividades e funcionários (sempre o mais atualizado)
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('activities')
          .select('id, nome, status')
          .eq('empreendimento_id', selectedEmpreendimento.id)
          .order('nome');
        if (activitiesError) throw activitiesError;
        setActivities(activitiesData || []); // Guarda a lista completa de atividades

        const { data: employeesData, error: employeesError } = await supabase
          .from('funcionarios')
          .select('id, full_name, status') // Inclui o status para filtrar ativos
          .eq('empreendimento_atual_id', selectedEmpreendimento.id)
          .order('full_name');
        if (employeesError) throw employeesError;
        
        // Filtra apenas funcionários ativos para o RDO
        const activeEmployees = (employeesData || []).filter(emp => emp.status === 'Ativo');
        setEmployees(activeEmployees); // Guarda a lista completa de funcionários ATIVOS no estado `employees`

        // 2. Tenta buscar o RDO existente para a data e empreendimento
        const { data: existingRdo, error: fetchRdoError } = await supabase
          .from('diarios_obra')
          .select('*, ocorrencias(*), rdo_fotos_uploads(*)')
          .eq('empreendimento_id', selectedEmpreendimento.id)
          .eq('data_relatorio', rdoFormData.data_relatorio)
          .limit(1);

        let currentRdoId = null;
        let initialEmployeePresences = [];
        let initialActivityStatuses = [];
        let initialOccurrences = [];
        let initialPhotos = [];

        if (existingRdo && existingRdo.length > 0) {
          // --- RDO EXISTENTE ---
          const rdo = existingRdo[0];
          currentRdoId = rdo.id;

          setRdoFormData({
            id: rdo.id,
            data_relatorio: rdo.data_relatorio,
            rdo_numero: rdo.rdo_numero,
            condicoes_climaticas: rdo.condicoes_climaticas,
            condicoes_trabalho: rdo.condicoes_trabalho,
          });

          // Carrega dados relacionados do RDO EXISTENTE
          initialOccurrences = rdo.ocorrencias || [];
          initialPhotos = rdo.rdo_fotos_uploads || [];

          // Mescla funcionários ATIVOS do empreendimento com os dados de presença salvos no RDO
          // Garante que todos os funcionários ativos do empreendimento apareçam,
          // e se já tiverem presença registrada no RDO, usa essa info.
          const savedMaoDeObra = (rdo.mao_de_obra && Array.isArray(rdo.mao_de_obra) ? rdo.mao_de_obra : []);
          initialEmployeePresences = activeEmployees.map(emp => {
              const savedStatus = savedMaoDeObra.find(s => s.id === emp.id);
              return {
                  id: emp.id,
                  name: emp.full_name,
                  present: savedStatus ? savedStatus.present : true, // Padrão para presente se não salvo
                  observacao: savedStatus ? savedStatus.observacao : '',
              };
          });

          // Mescla atividades do empreendimento com os status salvos no RDO
          const savedStatusAtividades = (rdo.status_atividades && Array.isArray(rdo.status_atividades) ? rdo.status_atividades : []);
          initialActivityStatuses = (activitiesData || []).map(dbAct => {
              const rdoActivity = savedStatusAtividades.find(sa => sa.id === dbAct.id);
              return {
                  id: dbAct.id,
                  nome: dbAct.nome,
                  status: rdoActivity ? rdoActivity.status : dbAct.status, // Usa status do RDO ou o padrão da atividade
                  observacao: rdoActivity ? rdoActivity.observacao : '',
              };
          });

        } else {
          // --- CRIAR NOVO RDO ---
          const { data: latestRdoNumData } = await supabase.from('diarios_obra').select('rdo_numero').eq('empreendimento_id', selectedEmpreendimento.id).order('rdo_numero', { ascending: false }).limit(1);
          const nextRdoNum = (latestRdoNumData && latestRdoNumData.length > 0) ? parseInt(latestRdoNumData[0].rdo_numero || '0') + 1 : 1;
          
          // Inicializa 'employeePresences' e 'activityStatuses' com base nos dados recém-buscados
          initialEmployeePresences = activeEmployees.map(emp => ({ id: emp.id, name: emp.full_name, present: true, observacao: '' }));
          initialActivityStatuses = (activitiesData || []).map(act => ({ id: act.id, nome: act.nome, status: act.status, observacao: '' }));

          const initialRdoData = {
            empreendimento_id: selectedEmpreendimento.id,
            data_relatorio: rdoFormData.data_relatorio,
            rdo_numero: nextRdoNum.toString(),
            responsavel_rdo: user ? user.email : 'Usuário Desconhecido',
            condicoes_climaticas: rdoFormData.condicoes_climaticas,
            condicoes_trabalho: rdoFormData.condicoes_trabalho,
            mao_de_obra: initialEmployeePresences, // Salva a lista inicial de presenças
            status_atividades: initialActivityStatuses, // Salva a lista inicial de status de atividades
          };

          const { data: newRdoData, error: createError } = await supabase.from('diarios_obra').insert([initialRdoData]).select();
          if (createError) throw createError;
          currentRdoId = newRdoData[0].id;

          setRdoFormData(prev => ({ ...prev, id: currentRdoId, rdo_numero: nextRdoNum.toString() }));
        }

        // Define os estados após todo o carregamento/inicialização
        setEmployeePresences(initialEmployeePresences);
        setActivityStatuses(initialActivityStatuses);
        setAllOccurrences(initialOccurrences);
        setAllPhotosMetadata(initialPhotos);


      } catch (error) {
        console.error("Erro no carregamento/inicialização do RDO:", error);
        setMessage(`Erro ao carregar/iniciar RDO: ${error.message}`);
      } finally {
        setLoadingForm(false);
      }
    };

    if (selectedEmpreendimento) {
      loadRdoData();
    }
  }, [selectedEmpreendimento, rdoFormData.data_relatorio, supabase]); // Adicionado `supabase` às dependências


  // Efeito para autosave
  useEffect(() => {
    // Apenas salva se o RDO existe e não está bloqueado
    if (rdoFormData.id && !isRdoLocked) {
      debouncedSaveRdoMain({
        id: rdoFormData.id,
        condicoes_climaticas: rdoFormData.condicoes_climaticas,
        condicoes_trabalho: rdoFormData.condicoes_trabalho,
        mao_de_obra: employeePresences, // Passa o estado de presença completo
        status_atividades: activityStatuses, // Passa o estado de status de atividades completo
      });
    }
  }, [rdoFormData.condicoes_climaticas, rdoFormData.condicoes_trabalho, employeePresences, activityStatuses, rdoFormData.id, isRdoLocked, debouncedSaveRdoMain]);

  // Funções de manipulação de formulário
  const handleRdoFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRdoFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 'Praticável' : 'Não Praticável') : value }));
  };

  const handleActivityStatusChange = useCallback(async (activityId, newStatus, newObservation) => {
    if (isRdoLocked) return;
    setActivityStatuses(prev => prev.map(act => act.id === activityId ? { ...act, status: newStatus, observacao: newObservation } : act));
    setMessage('Atualizando atividade no RDO...');
    setTimeout(() => setMessage(''), 2000);
  }, [isRdoLocked]);

  const handleEmployeeObservationChange = useCallback((employeeId, newObservation) => {
    if (isRdoLocked) return;
    setEmployeePresences(prev => prev.map(emp => emp.id === employeeId ? { ...emp, observacao: newObservation } : emp));
    setMessage('Atualizando observação de funcionário no RDO...');
    setTimeout(() => setMessage(''), 2000);
  }, [isRdoLocked]);
  
  const handleEmployeePresenceToggle = useCallback((employeeId) => {
    if (isRdoLocked) return;
    setEmployeePresences(prev => prev.map(emp => 
        emp.id === employeeId ? { ...emp, present: !emp.present } : emp
    ));
    setMessage('Atualizando presença de funcionário no RDO...');
    setTimeout(() => setMessage(''), 2000);
  }, [isRdoLocked]);
  
  // --- FUNÇÕES PARA OCORRÊNCIAS ---
  const handleNewOccurrenceChange = (e) => {
    const { name, value } = e.target;
    setCurrentNewOccurrence(prev => ({ ...prev, [name]: value }));
  };

  const handleAddOccurrence = async () => {
    if (isRdoLocked || !currentNewOccurrence.descricao.trim() || !rdoFormData.id) return;

    const dataOcorrencia = new Date();
    const occurrenceToSave = {
      ...currentNewOccurrence,
      diario_obra_id: rdoFormData.id,
      empreendimento_id: selectedEmpreendimento.id,
      data_ocorrencia: dataOcorrencia.toLocaleDateString('pt-BR'),
      hora_ocorrencia: dataOcorrencia.toLocaleTimeString('pt-BR'),
    };
    
    const { data, error } = await supabase.from('ocorrencias').insert(occurrenceToSave).select();
    if (error) {
      setMessage(`Erro ao adicionar ocorrência: ${error.message}`);
    } else {
      setAllOccurrences(prev => [...prev, data[0]]);
      setCurrentNewOccurrence({ tipo: occurrenceTypes[0], descricao: '' });
      setMessage('Ocorrência adicionada!');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleRemoveOccurrence = async (occurrenceId) => {
    if (isRdoLocked) return;
    const { error } = await supabase.from('ocorrencias').delete().eq('id', occurrenceId);
    if (error) {
      setMessage(`Erro ao remover ocorrência: ${error.message}`);
    } else {
      setAllOccurrences(prev => prev.filter(occ => occ.id !== occurrenceId));
      setMessage('Ocorrência removida.');
    }
  };

  // --- FUNÇÕES PARA FOTOS ---
  const handlePhotoFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) setCurrentPhotoFile(e.target.files[0]);
    else setCurrentPhotoFile(null);
  };

  const handleAddPhoto = async () => {
    if (isRdoLocked || !currentPhotoFile || !rdoFormData.id || !currentUser) return;
    setIsUploading(true);
    setMessage('Enviando foto...');

    // Gera um nome de arquivo único para evitar colisões
    const fileExtension = currentPhotoFile.name.split('.').pop();
    const safeFileName = `${Date.now()}-${currentPhotoFile.name.replace(/\s/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const filePath = `${rdoFormData.id}/${safeFileName}`; // Caminho com ID do RDO para organização

    const { data: fileData, error: fileError } = await supabase.storage
      .from('rdo-fotos')
      .upload(filePath, currentPhotoFile);

    if (fileError) {
      setMessage(`Erro no upload: ${fileError.message}`);
      setIsUploading(false);
      return;
    }
    
    const photoMetadata = {
      diario_obra_id: rdoFormData.id,
      caminho_arquivo: fileData.path,
      descricao: currentPhotoDescription || null
    };

    const { data: dbData, error: dbError } = await supabase.from('rdo_fotos_uploads').insert(photoMetadata).select();
    
    if (dbError) {
      setMessage(`Erro ao salvar no banco: ${dbError.message}`);
      await supabase.storage.from('rdo-fotos').remove([fileData.path]); // Tenta remover o arquivo do storage
    } else {
      setAllPhotosMetadata(prev => [...prev, dbData[0]]);
      setMessage('Foto adicionada com sucesso!');
      setCurrentPhotoFile(null);
      setCurrentPhotoDescription('');
      document.getElementById('photo-file-input').value = ""; // Limpa o input de arquivo
    }
    setIsUploading(false);
  };
  
  const handleRemovePhoto = async (photoId, photoPath) => {
      if (isRdoLocked) return;
      
      // 1. Remove do Storage
      const { error: storageError } = await supabase.storage.from('rdo-fotos').remove([photoPath]);
      if (storageError) {
          setMessage(`Erro ao remover arquivo do Storage: ${storageError.message}`);
          return;
      }
      
      // 2. Remove do Banco de Dados
      const { error: dbError } = await supabase.from('rdo_fotos_uploads').delete().eq('id', photoId);
      if (dbError) {
          setMessage(`Erro ao remover do banco: ${dbError.message}`);
      } else {
          setAllPhotosMetadata(prev => prev.filter(p => p.id !== photoId));
          setMessage('Foto removida.');
      }
  };

  if (loadingForm) return <p className="text-center mt-10">Carregando dados do empreendimento...</p>;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Detalhes do RDO para {selectedEmpreendimento.nome}</h2>
      
      {isRdoLocked && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
          <p className="font-bold">RDO Fechado!</p>
          <p>Este RDO não pode mais ser editado, pois não é a data atual.</p>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Seção 1: Cabeçalho do RDO */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="data_relatorio" className="block text-sm font-medium text-gray-700">Data</label>
              <input type="date" name="data_relatorio" id="data_relatorio" value={rdoFormData.data_relatorio} readOnly disabled className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-gray-100"/>
            </div>
            <div>
              <label htmlFor="rdo_numero" className="block text-sm font-medium text-gray-700">RDO Nº</label>
              <input type="text" name="rdo_numero" id="rdo_numero" value={rdoFormData.rdo_numero} readOnly disabled className="mt-1 block w-full p-2 border border-gray-300 rounded-md bg-gray-100"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Responsável</label>
              <p className="mt-1 p-2 bg-gray-100 rounded-md text-sm">{currentUser ? currentUser.email : 'Carregando...'}</p>
            </div>
          </div>
        </div>

        {/* Seção 2: Condições Climáticas e Praticáveis */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Condições Climáticas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label htmlFor="condicoes_climaticas" className="block text-sm font-medium text-gray-700">Condição</label>
              <select name="condicoes_climaticas" id="condicoes_climaticas" value={rdoFormData.condicoes_climaticas} onChange={handleRdoFormChange} disabled={isRdoLocked} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                {weatherOptions.map(option => (<option key={option} value={option}>{option}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="condicoes_trabalho" id="condicoes_trabalho" checked={rdoFormData.condicoes_trabalho === 'Praticável'} onChange={handleRdoFormChange} disabled={isRdoLocked} className="h-4 w-4"/>
              <label htmlFor="condicoes_trabalho" className="text-sm font-medium text-gray-700">Condições Praticáveis?</label>
            </div>
          </div>
        </div>

        {/* Seção 3: Status das Atividades */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Status das Atividades</h3>
          {activityStatuses.length === 0 ? <p className="text-gray-500">Nenhuma atividade encontrada.</p> : (
            <ul className="divide-y divide-gray-200">
              {activityStatuses.map((activity) => (
                <li key={activity.id} className="py-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <span className="font-medium w-full md:w-2/5">{activity.nome}</span>
                    <select value={activity.status} onChange={(e) => handleActivityStatusChange(activity.id, e.target.value, activity.observacao)} disabled={isRdoLocked} className="p-1 border rounded-md text-sm w-full md:w-1/5">
                      <option value="Não iniciado">Não Iniciado</option><option value="Em andamento">Em Andamento</option><option value="Concluído">Concluído</option><option value="Pausado">Pausado</option><option value="Aguardando material">Aguardando Material</option><option value="Cancelado">Cancelado</option>
                    </select>
                    <input type="text" placeholder="Observação..." value={activity.observacao} onChange={(e) => handleActivityStatusChange(activity.id, activity.status, e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm"/>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Seção 4: Mão de Obra */}
        <div className="border-b border-gray-200 pb-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Mão de Obra</h3>
            {employeePresences.length === 0 ? (
                <p className="text-gray-500">Nenhum funcionário ativo alocado a este empreendimento. Por favor, aloque funcionários na página de gerenciamento de funcionários.</p>
            ) : (
            <ul className="divide-y divide-gray-200">
                {employeePresences.map((employee) => (
                <li key={employee.id} className="py-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <span className="font-medium w-full md:w-2/5">{employee.name}</span>
                    <div className="flex items-center gap-2 w-full md:w-1/5">
                        <button type="button" onClick={() => handleEmployeePresenceToggle(employee.id)} disabled={isRdoLocked} className={`relative inline-flex h-6 w-11 items-center rounded-full ${employee.present ? 'bg-green-500' : 'bg-red-500'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${employee.present ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span>{employee.present ? 'Presente' : 'Faltou'}</span>
                    </div>
                    <input type="text" placeholder="Observação..." value={employee.observacao} onChange={(e) => handleEmployeeObservationChange(employee.id, e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm"/>
                    </div>
                </li>
                ))}
            </ul>
            )}
        </div>
        
        {/* Seção 5: Ocorrências do Dia */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Ocorrências do Dia</h3>
          <div className="flex flex-col md:flex-row gap-4 mb-3">
            <div className="flex-1">
              <label htmlFor="occurrence-type" className="sr-only">Tipo</label>
              <select id="occurrence-type" name="tipo" value={currentNewOccurrence.tipo} onChange={handleNewOccurrenceChange} disabled={isRdoLocked} className="block w-full p-2 border rounded-md text-sm">
                {occurrenceTypes.map(type => (<option key={type} value={type}>{type}</option>))}
              </select>
            </div>
            <div className="flex-grow w-full md:w-1/2">
              <label htmlFor="occurrence-description" className="sr-only">Descrição</label>
              <textarea id="occurrence-description" name="descricao" value={currentNewOccurrence.descricao} onChange={handleNewOccurrenceChange} rows="1" placeholder="Descreva a ocorrência..." disabled={isRdoLocked} className="block w-full p-2 border rounded-md text-sm"></textarea>
            </div>
            <button type="button" onClick={handleAddOccurrence} disabled={isRdoLocked || !rdoFormData.id || !currentNewOccurrence.descricao.trim()} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400">Adicionar</button>
          </div>
          {allOccurrences.length === 0 ? <p className="text-gray-500 text-sm">Nenhuma ocorrência adicionada.</p> : (
            <ul className="divide-y border rounded-md">
              {allOccurrences.map((occ) => (
                <li key={occ.id} className="p-3 flex justify-between items-center text-sm">
                  <div><span className="font-semibold">{occ.tipo}:</span> {occ.descricao} <span className="text-xs text-gray-500">({occ.data_ocorrencia} {occ.hora_ocorrencia})</span></div>
                  <button type="button" onClick={() => handleRemoveOccurrence(occ.id)} disabled={isRdoLocked} className="text-red-500 hover:text-red-700 disabled:opacity-50">&times;</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Seção 6: Fotos do Dia */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Fotos do Dia</h3>
          <div className="flex flex-col md:flex-row gap-4 mb-3 items-end">
            <div className="flex-1">
                <label htmlFor="photo-file-input" className="block text-sm font-medium text-gray-700">Arquivo</label>
                <input type="file" id="photo-file-input" accept="image/*" onChange={handlePhotoFileSelect} disabled={isRdoLocked || isUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100 disabled:opacity-50"/>
            </div>
            <div className="flex-1">
                <label htmlFor="photo-description-input" className="block text-sm font-medium text-gray-700">Descrição</label>
                <input type="text" id="photo-description-input" value={currentPhotoDescription} onChange={(e) => setCurrentPhotoDescription(e.target.value)} placeholder="Descrição da foto..." disabled={isRdoLocked || isUploading} className="block w-full p-2 border rounded-md text-sm"/>
            </div>
            <button type="button" onClick={handleAddPhoto} disabled={isRdoLocked || !currentPhotoFile || !rdoFormData.id || isUploading} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400">{isUploading ? 'Enviando...' : 'Adicionar Foto'}</button>
          </div>
          {allPhotosMetadata.length === 0 ? <p className="text-gray-500 text-sm">Nenhuma foto adicionada.</p> : (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {allPhotosMetadata.map((photo) => (
                <div key={photo.id} className="relative group border rounded-md overflow-hidden">
                  <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rdo-fotos/${photo.caminho_arquivo}`} alt={photo.descricao || 'Foto do RDO'} className="object-cover w-full h-32"/>
                  {/* Removido o elemento <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">{photo.descricao}</div> para simplificar o overlay */}
                  <button type="button" onClick={() => handleRemovePhoto(photo.id, photo.caminho_arquivo)} disabled={isRdoLocked || isUploading} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 disabled:opacity-50">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {message && <p className="text-center mt-4 text-sm font-medium">{message}</p>}
      </form>
    </div>
  );
}