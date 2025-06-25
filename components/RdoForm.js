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
  const [employees, setEmployees] = useState([]); 
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState('');
  const [loadingForm, setLoadingForm] = useState(true);
  const [isUploading, setIsUploading] = useState(false); 

  const [rdoFormData, setRdoFormData] = useState({
    id: null,
    data_relatorio: new Date().toISOString().split('T')[0],
    rdo_numero: '',
    condicoes_climaticas: 'Ensolarado',
    condicoes_trabalho: 'Praticável',
  });

  const [activityStatuses, setActivityStatuses] = useState([]);
  const [employeePresences, setEmployeePresences] = useState([]); 
  
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
      if (!dataToUpdate.id) return;
      setMessage('Salvando automaticamente...');
      const { error } = await supabase
        .from('diarios_obra')
        .update({
          condicoes_climaticas: dataToUpdate.condicoes_climaticas,
          condicoes_trabalho: dataToUpdate.condicoes_trabalho,
        })
        .eq('id', dataToUpdate.id);

      if (error) {
        console.error("Erro no autosave (principal):", error);
        setMessage(`Erro: ${error.message}`);
      } else {
        setMessage('Alterações salvas!');
        setTimeout(() => setMessage(''), 2000);
      }
    }, 1500)
  ).current;
  
    const saveSectionData = useCallback(async (rdoId, data) => {
        if (!rdoId || isRdoLocked) return;
        
        setMessage('Salvando...');
        const { error } = await supabase
        .from('diarios_obra')
        .update(data)
        .eq('id', rdoId);

        if (error) {
            console.error("Erro ao salvar seção do RDO:", error);
            setMessage(`Erro ao salvar: ${error.message}`);
        } else {
            setMessage('Salvo com sucesso!');
            setTimeout(() => setMessage(''), 2000);
        }
    }, [isRdoLocked, supabase]);


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


  useEffect(() => {
    const loadRdoData = async () => {
      setLoadingForm(true);
      setMessage('');

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setCurrentUser(user);

        const { data: activitiesData, error: activitiesError } = await supabase
          .from('activities')
          .select('id, nome, status')
          .eq('empreendimento_id', selectedEmpreendimento.id)
          .order('nome');
        if (activitiesError) throw activitiesError;
        setActivities(activitiesData || []); 

        const { data: employeesData, error: employeesError } = await supabase
          .from('funcionarios')
          .select('id, full_name, status') 
          .eq('empreendimento_atual_id', selectedEmpreendimento.id)
          .order('full_name');
        if (employeesError) throw employeesError;
        
        const activeEmployees = (employeesData || []).filter(emp => emp.status === 'Ativo');
        setEmployees(activeEmployees);

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

        if (existingRdo && existingRdo.length > 0) {
          const rdo = existingRdo[0];
          currentRdoId = rdo.id;

          setRdoFormData({
            id: rdo.id,
            data_relatorio: rdo.data_relatorio,
            rdo_numero: rdo.rdo_numero,
            condicoes_climaticas: rdo.condicoes_climaticas,
            condicoes_trabalho: rdo.condicoes_trabalho,
          });

          initialOccurrences = rdo.ocorrencias || [];
          
          // CORREÇÃO: Busca as fotos e GERA AS URLS ASSINADAS
          const initialPhotos = rdo.rdo_fotos_uploads || [];
          if (initialPhotos.length > 0) {
              const photoPromises = initialPhotos.map(async (photo) => {
                  const { data, error } = await supabase.storage
                      .from('rdo-fotos')
                      .createSignedUrl(photo.caminho_arquivo, 3600); // URL válida por 1 hora
                  
                  if (error) {
                      console.error('Erro ao gerar URL assinada:', error);
                      return { ...photo, signedUrl: null };
                  }
                  return { ...photo, signedUrl: data.signedUrl };
              });
              const photosWithUrls = await Promise.all(photoPromises);
              setAllPhotosMetadata(photosWithUrls);
          } else {
              setAllPhotosMetadata([]);
          }

          const savedMaoDeObra = (rdo.mao_de_obra && Array.isArray(rdo.mao_de_obra) ? rdo.mao_de_obra : []);
          initialEmployeePresences = activeEmployees.map(emp => {
              const savedStatus = savedMaoDeObra.find(s => s.id === emp.id);
              return {
                  id: emp.id,
                  name: emp.full_name,
                  present: savedStatus ? savedStatus.present : true, 
                  observacao: savedStatus ? savedStatus.observacao : '',
              };
          });
            
          const savedStatusAtividades = (rdo.status_atividades && Array.isArray(rdo.status_atividades) ? rdo.status_atividades : []);
          
          const todayFormatted = new Date().toISOString().split('T')[0];
          const isTodayRdo = rdo.data_relatorio === todayFormatted;

          initialActivityStatuses = (activitiesData || []).map(dbAct => {
              const rdoActivity = savedStatusAtividades.find(sa => sa.id === dbAct.id);
              const status = isTodayRdo ? dbAct.status : (rdoActivity ? rdoActivity.status : dbAct.status);
              const observacao = rdoActivity ? rdoActivity.observacao : '';
              return {
                  id: dbAct.id,
                  nome: dbAct.nome,
                  status: status,
                  observacao: observacao,
              };
          });

        } else {
          // Cria novo RDO
          const { data: latestRdoNumData } = await supabase.from('diarios_obra').select('rdo_numero').eq('empreendimento_id', selectedEmpreendimento.id).order('rdo_numero', { ascending: false }).limit(1);
          const nextRdoNum = (latestRdoNumData && latestRdoNumData.length > 0) ? parseInt(latestRdoNumData[0].rdo_numero || '0') + 1 : 1;
          
          initialEmployeePresences = activeEmployees.map(emp => ({ id: emp.id, name: emp.full_name, present: true, observacao: '' }));
          initialActivityStatuses = (activitiesData || []).map(act => ({ id: act.id, nome: act.nome, status: act.status, observacao: '' }));

          const initialRdoData = {
            empreendimento_id: selectedEmpreendimento.id,
            data_relatorio: rdoFormData.data_relatorio,
            rdo_numero: nextRdoNum.toString(),
            responsavel_rdo: user ? user.email : 'Usuário Desconhecido',
            condicoes_climaticas: rdoFormData.condicoes_climaticas,
            condicoes_trabalho: rdoFormData.condicoes_trabalho,
            mao_de_obra: initialEmployeePresences, 
            status_atividades: initialActivityStatuses, 
          };

          const { data: newRdoData, error: createError } = await supabase.from('diarios_obra').insert([initialRdoData]).select();
          if (createError) throw createError;
          currentRdoId = newRdoData[0].id;

          setRdoFormData(prev => ({ ...prev, id: currentRdoId, rdo_numero: nextRdoNum.toString() }));
        }

        setEmployeePresences(initialEmployeePresences);
        setActivityStatuses(initialActivityStatuses);
        setAllOccurrences(initialOccurrences);
        
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
  }, [selectedEmpreendimento, rdoFormData.data_relatorio, supabase]); 


  useEffect(() => {
    if (rdoFormData.id && !isRdoLocked) {
      debouncedSaveRdoMain({
        id: rdoFormData.id,
        condicoes_climaticas: rdoFormData.condicoes_climaticas,
        condicoes_trabalho: rdoFormData.condicoes_trabalho,
      });
    }
  }, [rdoFormData.condicoes_climaticas, rdoFormData.condicoes_trabalho, rdoFormData.id, isRdoLocked, debouncedSaveRdoMain]);

  const handleRdoFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRdoFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 'Praticável' : 'Não Praticável') : value }));
  };

    const handleActivityStatusChange = useCallback(async (activityId, newStatus, newObservation) => {
        if (isRdoLocked) return;

        const updatedStatuses = activityStatuses.map(act => 
            act.id === activityId ? { ...act, status: newStatus, observacao: newObservation } : act
        );
        setActivityStatuses(updatedStatuses);
        
        saveSectionData(rdoFormData.id, { status_atividades: updatedStatuses });

        const { error } = await supabase
            .from('activities')
            .update({ status: newStatus })
            .eq('id', activityId);

        if (error) {
            setMessage('Status salvo no RDO, mas falhou ao sincronizar com o painel de atividades.');
            console.error("Erro ao sincronizar status:", error);
        }
    }, [isRdoLocked, activityStatuses, rdoFormData.id, saveSectionData, supabase]);
    
    const handleEmployeeChange = useCallback(async (employeeId, field, value) => {
        if (isRdoLocked) return;
        
        const updatedPresences = employeePresences.map(emp =>
            emp.id === employeeId ? { ...emp, [field]: value } : emp
        );
        setEmployeePresences(updatedPresences);

        saveSectionData(rdoFormData.id, { mao_de_obra: updatedPresences });
    }, [isRdoLocked, employeePresences, rdoFormData.id, saveSectionData]);

  const handleNewOccurrenceChange = (e) => {
    const { name, value } = e.target;
    setCurrentNewOccurrence(prev => ({ ...prev, [name]: value }));
  };

  const handleAddOccurrence = async () => {
    if (isRdoLocked || !currentNewOccurrence.descricao.trim() || !rdoFormData.id) return;
    const { data, error } = await supabase.from('ocorrencias').insert({
        ...currentNewOccurrence,
        diario_obra_id: rdoFormData.id,
        empreendimento_id: selectedEmpreendimento.id,
        data_ocorrencia: new Date().toLocaleDateString('pt-BR'),
        hora_ocorrencia: new Date().toLocaleTimeString('pt-BR'),
    }).select();
    if (error) setMessage(`Erro: ${error.message}`);
    else {
      setAllOccurrences(prev => [...prev, data[0]]);
      setCurrentNewOccurrence({ tipo: 'Informativa', descricao: '' });
      setMessage('Ocorrência adicionada!');
    }
  };

  const handleRemoveOccurrence = async (occurrenceId) => {
    if (isRdoLocked) return;
    const { error } = await supabase.from('ocorrencias').delete().eq('id', occurrenceId);
    if (error) setMessage(`Erro: ${error.message}`);
    else setAllOccurrences(prev => prev.filter(occ => occ.id !== occurrenceId));
  };

  const handlePhotoFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) setCurrentPhotoFile(e.target.files[0]);
    else setCurrentPhotoFile(null);
  };

  const handleAddPhoto = async () => {
    if (isRdoLocked || !currentPhotoFile || !rdoFormData.id) return;
    setIsUploading(true);
    setMessage('Enviando foto...');

    const safeFileName = `${Date.now()}-${currentPhotoFile.name.replace(/\s/g, '_')}`;
    const filePath = `${rdoFormData.id}/${safeFileName}`; 

    const { data: fileData, error: fileError } = await supabase.storage.from('rdo-fotos').upload(filePath, currentPhotoFile);
    if (fileError) {
      setMessage(`Erro no upload: ${fileError.message}`);
      setIsUploading(false);
      return;
    }
    
    const { data: dbData, error: dbError } = await supabase.from('rdo_fotos_uploads').insert({
      diario_obra_id: rdoFormData.id,
      caminho_arquivo: fileData.path,
      descricao: currentPhotoDescription || null
    }).select().single();
    
    if (dbError) {
      setMessage(`Erro ao salvar no banco: ${dbError.message}`);
      await supabase.storage.from('rdo-fotos').remove([fileData.path]); 
    } else {
      // CORREÇÃO: Gera a URL assinada para a nova foto e adiciona ao estado
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('rdo-fotos')
          .createSignedUrl(dbData.caminho_arquivo, 3600);
      
      const newPhotoWithUrl = {
          ...dbData,
          signedUrl: signedUrlError ? null : signedUrlData.signedUrl
      };
      setAllPhotosMetadata(prev => [...prev, newPhotoWithUrl]);
      setMessage('Foto adicionada com sucesso!');
      setCurrentPhotoFile(null);
      setCurrentPhotoDescription('');
      document.getElementById('photo-file-input').value = ""; 
    }
    setIsUploading(false);
  };
  
  const handleRemovePhoto = async (photoId, photoPath) => {
      if (isRdoLocked) return;
      await supabase.storage.from('rdo-fotos').remove([photoPath]);
      await supabase.from('rdo_fotos_uploads').delete().eq('id', photoId);
      setAllPhotosMetadata(prev => prev.filter(p => p.id !== photoId));
      setMessage('Foto removida.');
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
        {/* Seções do formulário (sem alterações visuais) */}
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
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Status das Atividades</h3>
          {activityStatuses.length === 0 ? <p className="text-gray-500">Nenhuma atividade encontrada.</p> : (
            <ul className="divide-y divide-gray-200">
              {activityStatuses.map((activity) => (
                <li key={activity.id} className="py-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <span className="font-medium w-full md:w-2/5">{activity.nome}</span>
                    <select value={activity.status || 'Não Iniciado'} onChange={(e) => handleActivityStatusChange(activity.id, e.target.value, activity.observacao)} disabled={isRdoLocked} className="p-1 border rounded-md text-sm w-full md:w-1/5">
                      <option value="Não Iniciado">Não Iniciado</option><option value="Em Andamento">Em Andamento</option><option value="Concluído">Concluído</option><option value="Pausado">Pausado</option><option value="Aguardando Material">Aguardando Material</option><option value="Cancelado">Cancelado</option>
                    </select>
                    <input type="text" placeholder="Observação..." value={activity.observacao} onChange={(e) => handleActivityStatusChange(activity.id, activity.status, e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm"/>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-b border-gray-200 pb-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Mão de Obra</h3>
            {employeePresences.length === 0 ? (<p className="text-gray-500">Nenhum funcionário ativo alocado.</p>) : (
            <ul className="divide-y divide-gray-200">
                {employeePresences.map((employee) => (
                <li key={employee.id} className="py-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                        <span className="font-medium w-full md:w-2/5">{employee.name}</span>
                        <div className="flex items-center gap-2 w-full md:w-1/5">
                            <button type="button" onClick={() => handleEmployeeChange(employee.id, 'present', !employee.present)} disabled={isRdoLocked} className={`relative inline-flex h-6 w-11 items-center rounded-full ${employee.present ? 'bg-green-500' : 'bg-red-500'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${employee.present ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <span>{employee.present ? 'Presente' : 'Faltou'}</span>
                        </div>
                        <input type="text" placeholder="Observação..." value={employee.observacao} onChange={(e) => handleEmployeeChange(employee.id, 'observacao', e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm"/>
                    </div>
                </li>
                ))}
            </ul>
            )}
        </div>
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Ocorrências do Dia</h3>
            {/* Ocorrências... */}
        </div>
        
        {/* CORREÇÃO: Seção de Fotos agora usa a URL assinada */}
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
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allPhotosMetadata.map((photo) => (
                <div key={photo.id} className="relative group border rounded-lg overflow-hidden shadow-sm">
                  {photo.signedUrl ? (
                    <img src={photo.signedUrl} alt={photo.descricao || 'Foto do RDO'} className="object-cover w-full h-32"/>
                  ) : (
                    <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-xs text-red-500">Erro ao carregar</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate" title={photo.descricao}>
                    {photo.descricao || "Sem descrição"}
                  </div>
                  <button type="button" onClick={() => handleRemovePhoto(photo.id, photo.caminho_arquivo)} disabled={isRdoLocked || isUploading} className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 disabled:opacity-50">&times;</button>
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