"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faClock } from '@fortawesome/free-solid-svg-icons';

export default function FuncionarioForm({ companies, empreendimentos, initialData, jornadas }) {
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
    demission_date: '',
    status: 'Ativo',
    base_salary: '',
    total_salary: '',
    daily_value: '',
    payment_method: '',
    pix_key: '',
    bank_details: '',
    observations: '',
    foto_url: null,
    numero_ponto: null,
    jornada_id: null,
  });

  const [formData, setFormData] = useState(initialData || getInitialState());
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initialData?.foto_url || null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Busca a URL assinada da foto se ela existir
    const getSignedUrlForPhoto = async () => {
        if (initialData?.foto_url) {
            // A URL já pode ser pública ou uma blob (para preview local)
            if (initialData.foto_url.startsWith('blob:') || initialData.foto_url.includes('supabase.co')) {
                setPhotoPreview(initialData.foto_url);
            } else {
                // Se for um caminho de arquivo, busca a URL assinada
                const bucket = initialData.foto_url.includes('documentos/') ? 'funcionarios-documentos' : 'avatars';
                const { data } = await supabase.storage.from(bucket).createSignedUrl(initialData.foto_url, 3600);
                setPhotoPreview(data?.signedUrl);
            }
        }
    };
    getSignedUrlForPhoto();
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsUploading(true);
    setMessage('Salvando...');

    let finalFotoPath = formData.foto_url;

    // ***** LÓGICA DE UPLOAD CORRIGIDA *****
    if (newPhotoFile) {
      const fileExtension = newPhotoFile.name.split('.').pop();
      const employeeId = formData.id; // Pega o ID do funcionário que está sendo editado
      
      // Define o caminho do arquivo para o bucket 'funcionarios-documentos'
      const filePath = `documentos/${employeeId}/foto_perfil_${Date.now()}.${fileExtension}`;

      // Salva no mesmo bucket dos outros documentos
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('funcionarios-documentos') 
        .upload(filePath, newPhotoFile, { upsert: true });

      if (uploadError) {
        setMessage(`Erro no upload da foto: ${uploadError.message}`);
        setIsUploading(false);
        return;
      }
      finalFotoPath = uploadData.path; // Armazena o caminho completo do arquivo
    }

    // Continua com o salvamento dos dados do formulário
    const { id, created_at, cadastro_empresa, empreendimentos, documentos_funcionarios, ...dbData } = { ...formData, foto_url: finalFotoPath };

    if (isEditing) {
      const { error } = await supabase.from('funcionarios').update(dbData).eq('id', id);
      if (error) { setMessage(`Erro ao atualizar funcionário: ${error.message}`); setIsUploading(false); return; }
    } else {
      const { error } = await supabase.from('funcionarios').insert([dbData]);
      if (error) { setMessage(`Erro ao criar funcionário: ${error.message}`); setIsUploading(false); return; }
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
        if (data.erro) throw new Error('CEP inválido.');
        setFormData(prev => ({ ...prev, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }));
        setMessage('Endereço preenchido!');
    } catch (error) {
        setMessage(error.message);
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
            <h2 className="text-xl font-semibold text-gray-800">Dados Contratuais e Jornada</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium">Cargo *</label>
                    <input name="contract_role" required onChange={handleChange} value={formData.contract_role || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Data de Admissão *</label>
                    <input type="date" name="admission_date" required onChange={handleChange} value={formData.admission_date || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Status *</label>
                    <select name="status" value={formData.status || 'Ativo'} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                        <option value="Férias">Férias</option>
                        <option value="Demitido">Demitido</option>
                    </select>
                </div>
                 {formData.status === 'Demitido' && (
                    <div>
                        <label className="block text-sm font-medium">Data de Demissão</label>
                        <input type="date" name="demission_date" onChange={handleChange} value={formData.demission_date || ''} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                )}
                <div>
                    <label htmlFor="jornada_id" className="block text-sm font-medium text-gray-700">
                        <FontAwesomeIcon icon={faClock} className="mr-2" />
                        Jornada de Trabalho
                    </label>
                    <select name="jornada_id" id="jornada_id" value={formData.jornada_id || ''} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                        <option value="">Nenhuma jornada definida</option>
                        {jornadas?.map((jornada) => (<option key={jornada.id} value={jornada.id}> {jornada.nome_jornada} ({jornada.carga_horaria_semanal}h) </option>))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Número do Ponto</label>
                    <input type="number" name="numero_ponto" onChange={handleChange} value={formData.numero_ponto || ''} className="mt-1 w-full p-2 border rounded-md" />
                </div>
            </div>
        </fieldset>

        {canViewSalaries && (
            <fieldset className="border-t border-gray-900/10 pt-8">
                <h2 className="text-xl font-semibold text-gray-800">Informações Financeiras</h2>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium">Salário Base</label>
                        <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="base_salary" onAccept={(v) => handleMaskedChange('base_salary', v)} value={String(formData.base_salary || '')} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Salário Total</label>
                        <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="total_salary" onAccept={(v) => handleMaskedChange('total_salary', v)} value={String(formData.total_salary || '')} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Valor Diária</label>
                        <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} name="daily_value" onAccept={(v) => handleMaskedChange('daily_value', v)} value={String(formData.daily_value || '')} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Método de Pagamento</label>
                        <input name="payment_method" onChange={handleChange} value={formData.payment_method || ''} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                     <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Chave PIX</label>
                        <input name="pix_key" onChange={handleChange} value={formData.pix_key || ''} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                     <div className="md:col-span-3">
                        <label className="block text-sm font-medium">Dados Bancários</label>
                        <textarea name="bank_details" onChange={handleChange} value={formData.bank_details || ''} rows="3" className="mt-1 w-full p-2 border rounded-md"></textarea>
                    </div>
                </div>
            </fieldset>
        )}
        
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
            <h2 className="text-xl font-semibold text-gray-800">Outras Informações</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Observações</label>
                    <textarea name="observations" onChange={handleChange} value={formData.observations || ''} rows="4" className="mt-1 w-full p-2 border rounded-md"></textarea>
                </div>
            </div>
        </fieldset>
        
        <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="button" onClick={() => router.back()} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 font-semibold" disabled={isUploading}>
              {isUploading ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Salvando...</> : (isEditing ? 'Salvar Alterações' : 'Salvar Funcionário')}
            </button>
        </div>
      </form>
    </div>
  );
}