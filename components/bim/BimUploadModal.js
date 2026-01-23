// Caminho: app/components/bim/BimUploadModal.js
'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faTimes, faSpinner, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

export default function BimUploadModal({ isOpen, onClose, preSelectedContext, onSuccess }) {
  const supabase = createClientComponentClient();
  
  // Estados de Dados
  const [empresas, setEmpresas] = useState([]);
  const [obras, setObras] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);

  // Estados do Formulário
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedObra, setSelectedObra] = useState('');
  const [selectedDisciplina, setSelectedDisciplina] = useState('');
  const [file, setFile] = useState(null);
  
  // Estados de Interface
  const [loadingLists, setLoadingLists] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusStep, setStatusStep] = useState(''); 
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Carregar Listas Iniciais (COM DEBUG E getSession)
  useEffect(() => {
    if (!isOpen) return;

    async function loadInitialData() {
        setLoadingLists(true);
        setErrorMsg('');

        try {
            // --- MUDANÇA AQUI: Usamos getSession em vez de getUser ---
            // getSession é mais rápido e menos propenso a falhar se o cookie estiver ok
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session?.user) {
                console.error("Erro de Sessão:", sessionError);
                throw new Error("Sessão inválida. Tente recarregar a página ou fazer login novamente.");
            }

            const userId = session.user.id;
            console.log("Usuário Autenticado:", userId);

            // B. Busca o organizacao_id na tabela de usuários
            const { data: userProfile, error: profileError } = await supabase
                .from('usuarios')
                .select('organizacao_id')
                .eq('id', userId)
                .single();

            if (profileError || !userProfile) {
                console.error("Erro ao buscar perfil:", profileError);
                throw new Error("Perfil de usuário não encontrado no banco.");
            }

            const orgId = userProfile.organizacao_id;
            console.log("Organização ID:", orgId);

            // C. Busca Empresas filtradas pela Organização
            const { data: emp, error: empError } = await supabase
                .from('cadastro_empresa')
                .select('id, nome_fantasia')
                .eq('organizacao_id', orgId)
                .order('nome_fantasia');

            if (empError) throw new Error("Erro ao buscar empresas: " + empError.message);
            setEmpresas(emp || []);

            // D. Busca Disciplinas filtradas pela Organização
            const { data: disc, error: discError } = await supabase
                .from('disciplinas_projetos')
                .select('*')
                .eq('organizacao_id', orgId)
                .order('sigla');

            if (discError) throw new Error("Erro ao buscar disciplinas: " + discError.message);
            setDisciplinas(disc || []);
            
            // Pré-preenchimento
            if (preSelectedContext) {
                setSelectedEmpresa(preSelectedContext.empresaId);
                setTimeout(() => {
                    setSelectedObra(preSelectedContext.obraId);
                    if (preSelectedContext.type === 'folder') {
                        setSelectedDisciplina(preSelectedContext.id);
                    }
                }, 500);
            }

        } catch (error) {
            console.error("ERRO FATAL NO MODAL:", error);
            setErrorMsg(error.message);
        } finally {
            setLoadingLists(false);
        }
    }
    loadInitialData();
  }, [isOpen, preSelectedContext]);

  // 2. Carregar Obras quando escolhe Empresa (Mantido Igual)
  useEffect(() => {
    if (!selectedEmpresa) {
        setObras([]);
        return;
    }
    async function fetchObras() {
        const { data } = await supabase
            .from('empreendimentos')
            .select('id, nome')
            .eq('empresa_proprietaria_id', selectedEmpresa)
            .order('nome');
        setObras(data || []);
    }
    fetchObras();
  }, [selectedEmpresa]);

  // 3. Upload (Mantido Igual, mas seguro)
  const handleUpload = async () => {
    if (!file || !selectedObra || !selectedDisciplina) return;

    setUploading(true);
    setErrorMsg('');

    try {
        // A. Upload Storage
        setStatusStep('1/4: Salvando Backup Seguro...');
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: storageError } = await supabase.storage
            .from('bim-arquivos')
            .upload(filePath, file);

        if (storageError) throw new Error('Erro Storage: ' + storageError.message);

        // B. Metadados
        setStatusStep('2/4: Registrando Metadados...');
        
        // Pega orgId de novo para garantir
        const { data: { session } } = await supabase.auth.getSession();
        const { data: userProfile } = await supabase.from('usuarios').select('organizacao_id').eq('id', session.user.id).single();
        
        const { data: projetoRef, error: dbError } = await supabase
            .from('projetos_bim')
            .insert({
                nome_arquivo: file.name,
                tamanho_bytes: file.size,
                caminho_storage: filePath,
                status: 'Processando',
                empresa_id: selectedEmpresa,
                empreendimento_id: selectedObra,
                disciplina_id: selectedDisciplina,
                versao: 1, 
                organizacao_id: userProfile.organizacao_id
            })
            .select()
            .single();

        if (dbError) throw new Error('Erro Banco: ' + dbError.message);

        // C. Autodesk API
        setStatusStep('3/4: Enviando para Nuvem Autodesk...');
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/aps/upload', { method: 'POST', body: formData });
        let apiData;
        try { apiData = await res.json(); } catch(e) { throw new Error('Erro Fatal na API (500)'); }

        if (!res.ok) throw new Error(apiData.error || 'Erro na API Autodesk');
        if (!apiData.urn) throw new Error('Servidor não retornou URN');

        // D. Salvar URN
        setStatusStep('4/4: Finalizando...');
        const { error: updateError } = await supabase
            .from('projetos_bim')
            .update({ urn_autodesk: apiData.urn, status: 'Concluido' })
            .eq('id', projetoRef.id);

        if (updateError) throw new Error('Erro ao salvar URN.');

        setStatusStep('Sucesso!');
        setTimeout(() => {
            onSuccess(); 
            onClose(); 
            setUploading(false);
            setFile(null);
        }, 1000);

    } catch (error) {
        console.error(error);
        setErrorMsg(error.message);
        setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Novo Upload BIM</h3>
            <button onClick={onClose} disabled={uploading} className="text-gray-400 hover:text-gray-600">
                <FontAwesomeIcon icon={faTimes} />
            </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
            
            {/* Seletor de Empresa */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa Proprietária</label>
                <select 
                    value={selectedEmpresa}
                    onChange={(e) => setSelectedEmpresa(e.target.value)}
                    disabled={uploading || loadingLists}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Selecione a empresa...</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia}</option>)}
                </select>
                {loadingLists && <p className="text-[10px] text-gray-400 mt-1">Carregando empresas...</p>}
            </div>

            {/* Seletor de Obra */}
            <div className={`transition-opacity ${!selectedEmpresa ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empreendimento</label>
                <select 
                    value={selectedObra}
                    onChange={(e) => setSelectedObra(e.target.value)}
                    disabled={uploading}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Selecione o empreendimento...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
            </div>

            {/* Seletor de Disciplina */}
            <div className={`transition-opacity ${!selectedObra ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Disciplina / Pasta</label>
                <select 
                    value={selectedDisciplina}
                    onChange={(e) => setSelectedDisciplina(e.target.value)}
                    disabled={uploading}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">Selecione a disciplina (Ex: ARQ, HID)...</option>
                    {disciplinas.map(d => <option key={d.id} value={d.id}>{d.sigla} - {d.nome}</option>)}
                </select>
            </div>

            {/* Área de Arquivo */}
            <div className={`mt-4 pt-4 border-t border-gray-100 ${!selectedDisciplina ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Arquivo Revit (.rvt)</label>
                
                {!file ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-blue-500 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <FontAwesomeIcon icon={faCloudUploadAlt} className="text-3xl text-gray-400 mb-2"/>
                            <p className="text-sm text-gray-500"><span className="font-semibold">Clique para enviar</span> ou arraste</p>
                            <p className="text-xs text-gray-400">RVT (Max. 200MB)</p>
                        </div>
                        <input type="file" className="hidden" accept=".rvt" onChange={(e) => setFile(e.target.files[0])} />
                    </label>
                ) : (
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-200 p-2 rounded text-blue-700">
                                <FontAwesomeIcon icon={faCheckCircle} />
                            </div>
                            <div className="text-sm overflow-hidden">
                                <p className="font-bold text-blue-900 truncate max-w-[200px]">{file.name}</p>
                                <p className="text-xs text-blue-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        {!uploading && (
                            <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline">Remover</button>
                        )}
                    </div>
                )}
            </div>

            {/* Status e Erros */}
            {uploading && (
                <div className="bg-gray-100 rounded-lg p-3 text-center animate-pulse">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-600 mr-2"/>
                    <span className="text-sm text-gray-600 font-bold">{statusStep}</span>
                </div>
            )}

            {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="mt-1"/>
                    <span>{errorMsg}</span>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button 
                onClick={onClose} 
                disabled={uploading}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={handleUpload}
                disabled={!file || !selectedDisciplina || uploading}
                className={`
                    px-6 py-2 text-sm font-bold text-white rounded-lg transition-all flex items-center gap-2
                    ${(!file || !selectedDisciplina || uploading) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'}
                `}
            >
                {uploading ? 'Enviando...' : 'Iniciar Upload'}
            </button>
        </div>

      </div>
    </div>
  );
}