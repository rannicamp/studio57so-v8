"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faEye, faTimesCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

export default function FuncionarioForm({ companies, empreendimentos, initialData }) {
  const supabase = createClient();
  const router = useRouter();
  const { canViewSalaries } = useAuth();

  const isEditing = Boolean(initialData);

  const getInitialState = () => ({
    empresa_id: null,
    empreendimento_atual_id: null,
    full_name: '',
    cpf: '',
    rg: '',
    birth_date: '',
    phone: '',
    email: '',
    estado_civil: '',
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    contract_role: '',
    admission_date: '',
    base_salary: '',
    total_salary: '',
    daily_value: '',
    payment_method: '',
    pix_key: '',
    bank_details: '',
    observations: '',
    foto_url: null,
    numero_ponto: null,
  });

  const [formData, setFormData] = useState(initialData || getInitialState());
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [newDocumentFiles, setNewDocumentFiles] = useState({});

  const requiredDocuments = ['Identidade com Foto', 'CTPS', 'Comprovante de Residência', 'ASO'];
  
  useEffect(() => {
    const fetchAndPrepareData = async () => {
      if (initialData) {
        setFormData(initialData);
        if (initialData.foto_url) {
          const { data, error } = await supabase.storage
            .from('funcionarios-documentos')
            .createSignedUrl(initialData.foto_url, 3600); 

          if (error) {
            console.error("Erro ao criar URL da foto:", error);
            setPhotoPreview(null);
          } else {
            setPhotoPreview(data.signedUrl);
          }
        }
        
        const { data: docs } = await supabase.from('documentos_funcionarios').select('*').eq('funcionario_id', initialData.id);
        if (docs) {
          const docsWithUrls = await Promise.all(docs.map(async doc => {
            const { data: urlData } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(doc.caminho_arquivo, 3600);
            return { ...doc, signedUrl: urlData?.signedUrl };
          }));
          setUploadedDocuments(docsWithUrls);
        }
      }
    };
    fetchAndPrepareData();
  }, [initialData, supabase]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
  };
  
  const handleMaskedChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));

  const handlePhotoChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setNewPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };
  
  const handleDocumentChange = (docType, event) => setNewDocumentFiles(prev => ({ ...prev, [docType]: event.target.files[0] }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsUploading(true);
    setMessage('Salvando...');

    let finalFotoPath = formData.foto_url;

    if (newPhotoFile) {
      const fileExtension = newPhotoFile.name.split('.').pop();
      const photoFileName = `perfil/${(formData.cpf || 'novo').replace(/\D/g, '')}-${Date.now()}.${fileExtension}`;
      
      if (formData.foto_url) {
        await supabase.storage.from('funcionarios-documentos').remove([formData.foto_url]);
      }
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('funcionarios-documentos')
        .upload(photoFileName, newPhotoFile);

      if (uploadError) {
        setMessage(`Erro no upload da foto: ${uploadError.message}`);
        setIsUploading(false);
        return;
      }
      finalFotoPath = uploadData.path;
    }
    
    const { id, created_at, ...dbData } = { ...formData, foto_url: finalFotoPath };
    
    let savedEmployee;
    if (isEditing) {
      const { data, error } = await supabase.from('funcionarios').update(dbData).eq('id', id).select().single();
      if (error) { setMessage(`Erro ao atualizar funcionário: ${error.message}`); setIsUploading(false); return; }
      savedEmployee = data;
    } else {
      const { data, error } = await supabase.from('funcionarios').insert([dbData]).select().single();
      if (error) { setMessage(`Erro ao criar funcionário: ${error.message}`); setIsUploading(false); return; }
      savedEmployee = data;
    }

    setMessage(`Funcionário ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`);
    setIsUploading(false);
    setTimeout(() => {
        router.push('/funcionarios');
        router.refresh();
    }, 1500);
  };
  
  const handleCepBlur = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    setMessage('Buscando CEP...');
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        if (!response.ok) throw new Error('CEP não encontrado');
        const data = await response.json();
        if (data.erro) throw new Error('CEP não encontrado');
        setFormData(prev => ({ ...prev, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }));
        setMessage('Endereço preenchido!');
    } catch (error) {
        setMessage(error.message);
    } finally {
        setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteDocument = async (docId, caminhoArquivo) => {
    if (!window.confirm('Tem certeza que deseja remover este documento?')) return;
    setMessage('Removendo documento...');
    try {
      await supabase.storage.from('funcionarios-documentos').remove([caminhoArquivo]);
      await supabase.from('documentos_funcionarios').delete().eq('id', docId);
      setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));
      setMessage('Documento removido com sucesso!');
    } catch (error) {
      setMessage(`Erro ao remover documento: ${error.message}`);
    } finally {
      setTimeout(() => setMessage(''), 3000);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">
        {isEditing ? `Editando Funcionário: ${initialData?.full_name || ''}` : 'Cadastro de Novo Funcionário'}
      </h1>

      {message && <p className={`text-center font-medium mb-4 p-2 rounded-md ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Foto de Perfil</h2>
          <div className="mt-6 flex items-center gap-4">
            {photoPreview ? <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" /> : <FontAwesomeIcon icon={faUserCircle} className="w-24 h-24 text-gray-300" />}
            <input type="file" id="photo-upload" accept="image/*" onChange={handlePhotoChange} disabled={isUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/>
            {isUploading && <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />}
          </div>
        </fieldset>
        
        {/* O restante do formulário JSX continua o mesmo... */}
        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Dados da Empresa</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="empresa_id" className="block text-sm font-medium">Empresa Contratante *</label>
                    <select name="empresa_id" id="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                        <option value="">Selecione...</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="empreendimento_atual_id" className="block text-sm font-medium">Empreendimento Atual</label>
                    <select name="empreendimento_atual_id" id="empreendimento_atual_id" value={formData.empreendimento_atual_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                        <option value="">Nenhum</option>
                        {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                </div>
            </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Dados Pessoais</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Nome Completo *</label>
                    <input name="full_name" required onChange={handleChange} value={formData.full_name || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">CPF *</label>
                    <IMaskInput mask="000.000.000-00" name="cpf" required onAccept={(v) => handleMaskedChange('cpf', v)} value={formData.cpf || ''} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">RG</label>
                    <input name="rg" onChange={handleChange} value={formData.rg || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Data de Nascimento</label>
                    <input type="date" name="birth_date" onChange={handleChange} value={formData.birth_date || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Telefone</label>
                    <IMaskInput mask="(00) 00000-0000" name="phone" onAccept={(v) => handleMaskedChange('phone', v)} value={formData.phone || ''} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Email</label>
                    <input type="email" name="email" onChange={handleChange} value={formData.email || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Estado Civil</label>
                    <input name="estado_civil" onChange={handleChange} value={formData.estado_civil || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
            </div>
        </fieldset>

        <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="button" onClick={() => router.push('/funcionarios')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 font-semibold" disabled={isUploading}>
              {isUploading ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Salvar Funcionário')}
            </button>
        </div>
      </form>
    </div>
  );
}