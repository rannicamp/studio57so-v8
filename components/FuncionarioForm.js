"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faFileAlt, faTimesCircle, faEye, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

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
    numero_ponto: null, // Campo adicionado
  });

  const [formData, setFormData] = useState(initialData || getInitialState());
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initialData?.foto_url || null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [newDocumentFiles, setNewDocumentFiles] = useState({});

  const requiredDocuments = ['Identidade com Foto', 'CTPS', 'Comprovante de Residência', 'ASO'];
  
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setPhotoPreview(initialData.foto_url || null);
      const fetchDocuments = async () => {
        const { data, error } = await supabase
          .from('documentos_funcionarios')
          .select('*')
          .eq('funcionario_id', initialData.id);
        if (error) {
          console.error("Erro ao buscar documentos:", error);
          setMessage("Erro ao carregar documentos existentes.");
        } else {
          const docsWithSignedUrls = await Promise.all(data.map(async (doc) => {
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('funcionarios-documentos')
              .createSignedUrl(doc.caminho_arquivo, 3600);
            return {
              ...doc,
              signedUrl: signedUrlError ? null : signedUrlData.signedUrl
            };
          }));
          setUploadedDocuments(docsWithSignedUrls);
        }
      };
      fetchDocuments();
    }
  }, [initialData, supabase]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalValue =
      (name === 'empresa_id' || name === 'empreendimento_atual_id' || name === 'numero_ponto') && value === ''
        ? null
        : value;
    setFormData(prevState => ({ ...prevState, [name]: finalValue }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
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

  const handlePhotoChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setNewPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDocumentChange = (docType, event) => {
    const file = event.target.files[0];
    setNewDocumentFiles(prev => ({ ...prev, [docType]: file }));
  };

  const uploadFile = async (file, path, bucketName, oldFilePath = null) => {
    if (!file) return { data: null, error: null };

    if (oldFilePath) {
      const { error: deleteError } = await supabase.storage.from(bucketName).remove([oldFilePath]);
      if (deleteError) console.warn(`Erro ao deletar arquivo antigo em ${bucketName}:`, deleteError.message);
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, file);

    if (error) {
      return { data: null, error };
    }

    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(data.path);
    return { data: { path: data.path, publicUrl }, error: null };
  };

  const getPendingIssues = useCallback(() => {
    const issues = [];
    const requiredFields = {
      full_name: 'Nome Completo',
      cpf: 'CPF',
      empresa_id: 'Empresa Contratante',
      contract_role: 'Cargo',
      admission_date: 'Data de Admissão',
    };
    
    for (const field in requiredFields) {
      if (!formData[field]) {
        issues.push(`Campo '${requiredFields[field]}'`);
      }
    }

    requiredDocuments.forEach(docType => {
      const hasUploaded = uploadedDocuments.some(doc => doc.nome_documento === docType) || newDocumentFiles[docType];
      if (!hasUploaded) {
        issues.push(`Documento '${docType}'`);
      }
    });
    return issues;
  }, [formData, uploadedDocuments, newDocumentFiles, requiredDocuments]);


  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const pendingIssues = getPendingIssues();
    if (pendingIssues.length > 0) {
      setMessage(`Atenção: As seguintes pendências foram identificadas e o funcionário será salvo com elas:\n${pendingIssues.join(', ')}.`);
    }

    setIsUploading(true);
    setMessage(prev => (prev === '' ? (isEditing ? 'Atualizando...' : 'Cadastrando...') : prev));

    let finalFotoUrl = formData.foto_url;
    let employeeId = formData.id;

    if (newPhotoFile) {
        const fileExtension = newPhotoFile.name.split('.').pop();
        const photoFileName = `perfil/${(formData.cpf || 'new').replace(/\D/g, '')}-${Date.now()}.${fileExtension}`;
        const oldPhotoPath = isEditing && formData.foto_url ? formData.foto_url.split('/funcionarios-documentos/')[1] : null;

        const { data: photoUploadData, error: photoUploadError } = await uploadFile(newPhotoFile, photoFileName, 'funcionarios-documentos', oldPhotoPath);
        
        if (photoUploadError) {
            setMessage(`Erro no upload da foto: ${photoUploadError.message}`);
            setIsUploading(false);
            return;
        }
        finalFotoUrl = photoUploadData.publicUrl;
    }

    const { id, created_at, ...dbData } = { ...formData, foto_url: finalFotoUrl };
    delete dbData.newPhotoFile;

    let employeeSaveError;
    let savedEmployeeData;

    if (isEditing) {
        const { data, error: updateError } = await supabase.from('funcionarios').update(dbData).eq('id', id).select().single();
        employeeSaveError = updateError;
        savedEmployeeData = data;
    } else {
        const { data, error: insertError } = await supabase.from('funcionarios').insert([dbData]).select().single();
        employeeSaveError = insertError;
        savedEmployeeData = data;
    }

    if (employeeSaveError) {
        setMessage(`Erro ao salvar funcionário: ${employeeSaveError.message}`);
        setIsUploading(false);
        return;
    }
    employeeId = savedEmployeeData.id;

    for (const docType in newDocumentFiles) {
      const file = newDocumentFiles[docType];
      if (file) {
        const fileExtension = file.name.split('.').pop();
        const docFileName = `${employeeId}/${docType.replace(/\s/g, '_')}-${Date.now()}.${fileExtension}`;
        
        const existingDoc = uploadedDocuments.find(d => d.nome_documento === docType);
        const oldDocPath = existingDoc ? existingDoc.caminho_arquivo : null;

        const { data: docUploadData, error: docUploadError } = await uploadFile(file, docFileName, 'funcionarios-documentos', oldDocPath);

        if (docUploadError) {
          setMessage(`Erro ao enviar ${docType}: ${docUploadError.message}`);
          setIsUploading(false);
          return;
        }

        const docRecord = {
          funcionario_id: employeeId,
          nome_documento: docType,
          caminho_arquivo: docUploadData.path,
          criado_por_usuario_id: null,
        };

        if (existingDoc) {
          await supabase.from('documentos_funcionarios').update(docRecord).eq('id', existingDoc.id);
        } else {
          await supabase.from('documentos_funcionarios').insert([docRecord]);
        }
      }
    }

    if (pendingIssues.length === 0) {
        setMessage(`Funcionário ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`);
    } else {
        setMessage(`Funcionário ${isEditing ? 'atualizado' : 'cadastrado'} com pendências! Verifique a lista.`);
    }
    
    setIsUploading(false);
    setTimeout(() => {
        router.push('/funcionarios');
        router.refresh();
    }, 1500);
  };

  const handleDeleteDocument = async (docId, caminhoArquivo) => {
    if (!window.confirm('Tem certeza que deseja remover este documento?')) return;
    setMessage('Removendo documento...');
    try {
      const { error: storageError } = await supabase.storage.from('funcionarios-documentos').remove([caminhoArquivo]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('documentos_funcionarios').delete().eq('id', docId);
      if (dbError) throw dbError;

      setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));
      setMessage('Documento removido com sucesso!');
    } catch (error) {
      setMessage(`Erro ao remover documento: ${error.message}`);
      console.error("Erro ao remover documento:", error);
    } finally {
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">
        {isEditing ? `Editando Funcionário: ${initialData.full_name}` : 'Cadastro de Novo Funcionário'}
      </h1>

      {message && <p className={`text-center font-medium mb-4 p-2 rounded-md ${message.includes('Erro') ? 'bg-red-100 text-red-700' : (message.includes('Atenção') ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}`}>{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Foto de Perfil</h2>
          <div className="mt-6 flex items-center gap-4">
            {photoPreview ? <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" /> : <FontAwesomeIcon icon={faUserCircle} className="w-24 h-24 text-gray-300" />}
            <input type="file" id="photo-upload" onChange={handlePhotoChange} disabled={isUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/>
            {isUploading && <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />}
          </div>
        </fieldset>

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

        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Endereço</h2>
             <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium">CEP</label>
                    <IMaskInput mask="00000-000" name="cep" value={formData.cep || ''} onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                <div className="md:col-span-4"><label className="block text-sm font-medium">Logradouro</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div className="md:col-span-3"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium">Estado (UF)</label><input name="state" value={formData.state || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados Contratuais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2"><label className="block text-sm font-medium">Cargo *</label><input name="contract_role" required onChange={handleChange} value={formData.contract_role || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium">Data de Admissão *</label><input type="date" name="admission_date" required onChange={handleChange} value={formData.admission_date || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
            {/* NOVO CAMPO ADICIONADO AQUI */}
            <div>
              <label htmlFor="numero_ponto" className="block text-sm font-medium">Número Ponto</label>
              <input type="number" name="numero_ponto" id="numero_ponto" value={formData.numero_ponto || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
            </div>
            {canViewSalaries && (<>
                <div><label className="block text-sm font-medium">Salário Base</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="base_salary" value={formData.base_salary || ''} onAccept={(v) => handleMaskedChange('base_salary', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
                <div><label className="block text-sm font-medium">Salário Total</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="total_salary" value={formData.total_salary || ''} onAccept={(v) => handleMaskedChange('total_salary', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
                <div><label className="block text-sm font-medium">Valor Diária</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="daily_value" value={formData.daily_value || ''} onAccept={(v) => handleMaskedChange('daily_value', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
            </>)}
          </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Dados de Pagamento</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div><label className="block text-sm font-medium">Método de Pagamento</label><input name="payment_method" onChange={handleChange} value={formData.payment_method || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium">Chave PIX</label><input name="pix_key" onChange={handleChange} value={formData.pix_key || ''} className="mt-1 w-full p-2 border rounded-md"/></div>
                <div><label className="block text-sm font-medium">Dados Bancários</label><input name="bank_details" onChange={handleChange} value={formData.bank_details || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
            </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Documentos do Funcionário</h2>
            <div className="mt-6 space-y-4">
                {requiredDocuments.map((docType) => (
                    <div key={docType} className="flex flex-col md:flex-row md:items-center gap-2">
                        <label className="block text-sm font-medium md:w-1/3">{docType} *</label>
                        <div className="flex-1 flex items-center gap-2">
                            <input
                                type="file"
                                accept=".pdf,image/*"
                                onChange={(e) => handleDocumentChange(docType, e)}
                                disabled={isUploading}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100 disabled:opacity-50"
                            />
                            {isUploading && <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />}
                            {uploadedDocuments.some(doc => doc.nome_documento === docType) && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-green-600 font-semibold">Anexado!</span>
                                    {uploadedDocuments.find(doc => doc.nome_documento === docType)?.signedUrl && (
                                        <a href={uploadedDocuments.find(doc => doc.nome_documento === docType).signedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700" title="Ver Documento">
                                            <FontAwesomeIcon icon={faEye} />
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteDocument(uploadedDocuments.find(doc => doc.nome_documento === docType).id, uploadedDocuments.find(doc => doc.nome_documento === docType).caminho_arquivo)}
                                        className="text-red-500 hover:text-red-700"
                                        title="Remover Documento"
                                    >
                                        <FontAwesomeIcon icon={faTimesCircle} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </fieldset>

        <fieldset className="border-t border-gray-900/10 pt-8">
            <h2 className="text-xl font-semibold text-gray-800">Outras Informações</h2>
            <div className="mt-6">
                <label htmlFor="observations" className="block text-sm font-medium text-gray-700">Observações</label>
                <textarea name="observations" id="observations" value={formData.observations || ''} onChange={handleChange} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
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