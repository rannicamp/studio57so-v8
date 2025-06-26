"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';

export default function RdoForm({ initialRdoData, selectedEmpreendimento }) {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState('');
  const [loadingForm, setLoadingForm] = useState(true);
  const [isUploading, setIsUploading] = useState(false); 

  const [rdoFormData, setRdoFormData] = useState({});
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
  
  const setupFormWithData = useCallback(async (rdoData) => {
    if (!rdoData) {
      setLoadingForm(false);
      return;
    }
    setLoadingForm(true);

    try {
      setRdoFormData({
        id: rdoData.id,
        data_relatorio: rdoData.data_relatorio,
        rdo_numero: rdoData.rdo_numero,
        condicoes_climaticas: rdoData.condicoes_climaticas,
        condicoes_trabalho: rdoData.condicoes_trabalho,
        empreendimento_id: rdoData.empreendimento_id
      });
      setAllOccurrences(rdoData.ocorrencias || []);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      const empreendimentoId = rdoData.empreendimento_id;

      const { data: activitiesData } = await supabase.from('activities').select('id, nome, status').eq('empreendimento_id', empreendimentoId);
      const { data: employeesData } = await supabase.from('funcionarios').select('id, full_name, status').eq('empreendimento_atual_id', empreendimentoId);
      const activeEmployees = (employeesData || []).filter(emp => emp.status === 'Ativo');

      const savedMaoDeObra = rdoData.mao_de_obra || [];
      setEmployeePresences(activeEmployees.map(emp => {
        const savedStatus = savedMaoDeObra.find(s => s.id === emp.id);
        return { id: emp.id, name: emp.full_name, present: savedStatus?.present ?? true, observacao: savedStatus?.observacao || '' };
      }));
      
      const savedStatusAtividades = rdoData.status_atividades || [];
      const todayFormatted = new Date().toISOString().split('T')[0];
      const isTodayRdo = rdoData.data_relatorio === todayFormatted;
      setActivityStatuses((activitiesData || []).map(dbAct => {
        const rdoActivity = savedStatusAtividades.find(sa => sa.id === dbAct.id);
        const status = isTodayRdo ? dbAct.status : (rdoActivity?.status || dbAct.status);
        const observacao = rdoActivity?.observacao || '';
        return { id: dbAct.id, nome: dbAct.nome, status, observacao };
      }));
      
      const photoPromises = (rdoData.rdo_fotos_uploads || []).map(async (photo) => {
        const { data } = await supabase.storage.from('rdo-fotos').createSignedUrl(photo.caminho_arquivo, 3600);
        return { ...photo, signedUrl: data?.signedUrl };
      });
      setAllPhotosMetadata(await Promise.all(photoPromises));
      
      setIsRdoLocked(rdoData.data_relatorio !== todayFormatted);
    } catch (error) {
      console.error("Erro ao carregar dados do RDO:", error);
      setMessage("Erro ao carregar os detalhes do RDO.");
    } finally {
      setLoadingForm(false);
    }
  }, [supabase]);

  useEffect(() => {
    const initializeForm = async () => {
        if (initialRdoData) {
            await setupFormWithData(initialRdoData);
        } else if (selectedEmpreendimento) {
            setLoadingForm(true);
            const today = new Date().toISOString().split('T')[0];
            
            // Tenta buscar o RDO de hoje para o empreendimento selecionado
            let { data: rdo, error } = await supabase
                .from('diarios_obra')
                .select('*, empreendimentos(*), ocorrencias(*), rdo_fotos_uploads(*)')
                .eq('empreendimento_id', selectedEmpreendimento.id)
                .eq('data_relatorio', today)
                .maybeSingle();

            // Se não encontrar, cria um novo RDO para hoje
            if (!rdo && !error) {
                const { data: { user } } = await supabase.auth.getUser();
                const { data: newRdo, error: insertError } = await supabase
                    .from('diarios_obra')
                    .insert({
                        empreendimento_id: selectedEmpreendimento.id,
                        data_relatorio: today,
                        rdo_numero: `RDO-${selectedEmpreendimento.id}-${today}`,
                        responsavel_rdo: user?.email,
                        condicoes_climaticas: 'Ensolarado',
                        condicoes_trabalho: 'Praticável',
                        status_atividades: [],
                        mao_de_obra: []
                    })
                    .select('*, empreendimentos(*), ocorrencias(*), rdo_fotos_uploads(*)')
                    .single();
                
                if (insertError) {
                    setMessage(`Erro ao criar novo RDO: ${insertError.message}`);
                    setLoadingForm(false);
                    return;
                }
                rdo = newRdo;
            }
            
            if(rdo) {
                await setupFormWithData(rdo);
            } else {
                 setLoadingForm(false);
            }
        } else {
            setLoadingForm(false);
        }
    };
    initializeForm();
  }, [initialRdoData, selectedEmpreendimento, supabase, setupFormWithData]);


  const handleRdoFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRdoFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 'Praticável' : 'Não Praticável') : value }));
  };

  const saveSectionData = useCallback(async (data) => {
    if (!rdoFormData.id || isRdoLocked) return;
    setMessage('Salvando...');
    const { error } = await supabase.from('diarios_obra').update(data).eq('id', rdoFormData.id);
    if (error) setMessage(`Erro: ${error.message}`);
    else {
      setMessage('Salvo!');
      setTimeout(() => setMessage(''), 2000);
    }
  }, [isRdoLocked, rdoFormData.id, supabase]);

  const handleActivityStatusChange = useCallback(async (activityId, newStatus, newObservation) => {
      const updatedStatuses = activityStatuses.map(act => act.id === activityId ? { ...act, status: newStatus, observacao: newObservation } : act);
      setActivityStatuses(updatedStatuses);
      saveSectionData({ status_atividades: updatedStatuses });
      await supabase.from('activities').update({ status: newStatus }).eq('id', activityId);
  }, [activityStatuses, saveSectionData, supabase]);
  
  const handleEmployeeChange = useCallback(async (employeeId, field, value) => {
      const updatedPresences = employeePresences.map(emp => emp.id === employeeId ? { ...emp, [field]: value } : emp);
      setEmployeePresences(updatedPresences);
      saveSectionData({ mao_de_obra: updatedPresences });
  }, [employeePresences, saveSectionData]);

  const handleNewOccurrenceChange = (e) => {
    const { name, value } = e.target;
    setCurrentNewOccurrence(prev => ({ ...prev, [name]: value }));
  };

  const handleAddOccurrence = async () => {
    if (isRdoLocked || !currentNewOccurrence.descricao.trim()) return;
    const { data, error } = await supabase.from('ocorrencias').insert({
        ...currentNewOccurrence,
        diario_obra_id: rdoFormData.id,
        empreendimento_id: rdoFormData.empreendimento_id,
        data_ocorrencia: new Date().toLocaleDateString('pt-BR'),
        hora_ocorrencia: new Date().toLocaleTimeString('pt-BR'),
    }).select().single();
    if (error) setMessage(`Erro: ${error.message}`);
    else {
      setAllOccurrences(prev => [...prev, data]);
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
    if (e.target.files?.[0]) setCurrentPhotoFile(e.target.files[0]);
    else setCurrentPhotoFile(null);
  };

  const handleAddPhoto = async () => {
    if (isRdoLocked || !currentPhotoFile) return;
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
      setMessage(`Erro: ${dbError.message}`);
      await supabase.storage.from('rdo-fotos').remove([fileData.path]); 
    } else {
      const { data: signedUrlData } = await supabase.storage.from('rdo-fotos').createSignedUrl(dbData.caminho_arquivo, 3600);
      setAllPhotosMetadata(prev => [...prev, { ...dbData, signedUrl: signedUrlData?.signedUrl }]);
      setMessage('Foto adicionada!');
      setCurrentPhotoFile(null);
      setCurrentPhotoDescription('');
      if(document.getElementById('photo-file-input')) {
        document.getElementById('photo-file-input').value = "";
      }
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

  if (loadingForm) {
    return <p className="text-center mt-10">Carregando dados do RDO...</p>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Detalhes do RDO</h2>
      
      {isRdoLocked && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
          <p className="font-bold">RDO Fechado!</p>
          <p>Este RDO é de uma data passada e não pode ser editado. Apenas visualização é permitida.</p>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Informações Gerais */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data</label>
              <input type="date" value={rdoFormData.data_relatorio || ''} readOnly disabled className="mt-1 block w-full p-2 bg-gray-100 border-gray-300 rounded-md"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">RDO Nº</label>
              <input type="text" value={rdoFormData.rdo_numero || ''} readOnly disabled className="mt-1 block w-full p-2 bg-gray-100 border-gray-300 rounded-md"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Responsável</label>
              <p className="mt-1 p-2 bg-gray-100 rounded-md text-sm">{currentUser?.email || '...'}</p>
            </div>
          </div>
        </div>

        {/* Condições Climáticas */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Condições Climáticas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">Condição</label>
              <select name="condicoes_climaticas" value={rdoFormData.condicoes_climaticas || ''} onChange={handleRdoFormChange} disabled={isRdoLocked} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                {weatherOptions.map(option => (<option key={option} value={option}>{option}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="condicoes_trabalho" checked={rdoFormData.condicoes_trabalho === 'Praticável'} onChange={handleRdoFormChange} disabled={isRdoLocked} className="h-4 w-4"/>
              <label className="text-sm font-medium text-gray-700">Condições Praticáveis?</label>
            </div>
          </div>
        </div>

        {/* Status das Atividades */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Status das Atividades</h3>
          <ul className="divide-y divide-gray-200">
            {activityStatuses.map((activity) => (
              <li key={activity.id} className="py-3 flex flex-col md:flex-row md:items-center gap-2">
                <span className="font-medium w-full md:w-2/5">{activity.nome}</span>
                <select value={activity.status || 'Não Iniciado'} onChange={(e) => handleActivityStatusChange(activity.id, e.target.value, activity.observacao)} disabled={isRdoLocked} className="p-1 border rounded-md text-sm w-full md:w-1/5">
                  <option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option>
                </select>
                <input type="text" placeholder="Observação..." value={activity.observacao || ''} onChange={(e) => handleActivityStatusChange(activity.id, activity.status, e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm"/>
              </li>
            ))}
          </ul>
        </div>

        {/* Mão de Obra */}
        <div className="border-b border-gray-200 pb-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Mão de Obra</h3>
            <ul className="divide-y divide-gray-200">
                {employeePresences.map((employee) => (
                <li key={employee.id} className="py-3 flex flex-col md:flex-row md:items-center gap-2">
                    <span className="font-medium w-full md:w-2/5">{employee.name}</span>
                    <div className="flex items-center gap-2 w-full md:w-1/5">
                        <button type="button" onClick={() => handleEmployeeChange(employee.id, 'present', !employee.present)} disabled={isRdoLocked} className={`relative inline-flex h-6 w-11 items-center rounded-full ${employee.present ? 'bg-green-500' : 'bg-red-500'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${employee.present ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span>{employee.present ? 'Presente' : 'Faltou'}</span>
                    </div>
                    <input type="text" placeholder="Observação..." value={employee.observacao || ''} onChange={(e) => handleEmployeeChange(employee.id, 'observacao', e.target.value)} disabled={isRdoLocked} className="block w-full md:w-2/5 p-2 border rounded-md text-sm"/>
                </li>
                ))}
            </ul>
        </div>
        
        {/* Ocorrências do Dia */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Ocorrências do Dia</h3>
          <div className="flex flex-col md:flex-row gap-4 mb-3">
            <select name="tipo" value={currentNewOccurrence.tipo} onChange={handleNewOccurrenceChange} disabled={isRdoLocked} className="flex-1 block w-full p-2 border rounded-md text-sm">
                {occurrenceTypes.map(type => (<option key={type} value={type}>{type}</option>))}
            </select>
            <textarea name="descricao" value={currentNewOccurrence.descricao} onChange={handleNewOccurrenceChange} rows="1" placeholder="Descreva a ocorrência..." disabled={isRdoLocked} className="flex-grow w-full md:w-1/2 block p-2 border rounded-md text-sm"></textarea>
            <button type="button" onClick={handleAddOccurrence} disabled={isRdoLocked || !currentNewOccurrence.descricao.trim()} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400">Adicionar</button>
          </div>
          <ul className="divide-y border rounded-md">
            {allOccurrences.map((occ) => (
              <li key={occ.id} className="p-3 flex justify-between items-center text-sm">
                <div><span className="font-semibold">{occ.tipo}:</span> {occ.descricao} <span className="text-xs text-gray-500">({new Date(occ.created_at).toLocaleString('pt-BR')})</span></div>
                <button type="button" onClick={() => handleRemoveOccurrence(occ.id)} disabled={isRdoLocked} className="text-red-500 hover:text-red-700 disabled:opacity-50">&times;</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Fotos do Dia */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Fotos do Dia</h3>
          <div className="flex flex-col md:flex-row gap-4 mb-3 items-end">
            <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Arquivo</label>
                <input type="file" id="photo-file-input" accept="image/*" onChange={handlePhotoFileSelect} disabled={isRdoLocked || isUploading} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100 disabled:opacity-50"/>
            </div>
            <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Descrição</label>
                <input type="text" value={currentPhotoDescription} onChange={(e) => setCurrentPhotoDescription(e.target.value)} placeholder="Descrição da foto..." disabled={isRdoLocked || isUploading} className="mt-1 block w-full p-2 border rounded-md text-sm"/>
            </div>
            <button type="button" onClick={handleAddPhoto} disabled={isRdoLocked || !currentPhotoFile || isUploading} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400">{isUploading ? 'Enviando...' : 'Adicionar Foto'}</button>
          </div>
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
        </div>
        
        {message && <p className="text-center mt-4 text-sm font-medium">{message}</p>}
      </form>
    </div>
  );
}