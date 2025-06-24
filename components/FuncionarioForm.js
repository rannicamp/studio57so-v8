"use client";

import { useState, useEffect, useRef } from 'react'; // Importado useRef
import { createClient } from '../utils/supabase/client';
import { IMaskInput } from 'react-imask';

// Função para validar CPF
function validaCPF(cpf) {
    cpf = String(cpf).replace(/[^\d]/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
    let soma = 0;
    let resto;
    for (let i = 1; i <= 9; i++) {
        soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) {
        soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

export default function FuncionarioForm({ companies, empreendimentos }) {
  const supabase = createClient();
  
  const initialState = {
    empresa_id: '', empreendimento_atual_id: null, full_name: '', cpf: '', rg: '',
    birth_date: '', phone: '', email: '', estado_civil: '', address_street: '', address_number: '',
    address_complement: '', cep: '', city: '', state: '', neighborhood: '',
    contract_role: '', admission_date: '', base_salary: '', total_salary: '',
    daily_value: '', payment_method: '', pix_key: '', bank_details: '', observations: ''
  };

  const [formData, setFormData] = useState(initialState);
  const [photoFile, setPhotoFile] = useState(null);
  const [asoFile, setAsoFile] = useState(null);
  const [contractFile, setContractFile] = useState(null);
  const [identityFile, setIdentityFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [cpfError, setCpfError] = useState('');

  // Adicionando refs para os inputs de arquivo
  const photoInputRef = useRef(null);
  const asoInputRef = useRef(null);
  const contractInputRef = useRef(null);
  const identityInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value === '' ? null : value }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleCpfBlur = () => {
    if (formData.cpf && !validaCPF(formData.cpf)) {
        setCpfError('CPF inválido. Por favor, verifique.');
    } else {
        setCpfError('');
    }
  };

  const handleFileChange = (setter) => (e) => {
    if (e.target.files && e.target.files[0]) setter(e.target.files[0]);
    else setter(null);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        setPhotoFile(file);
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(URL.createObjectURL(file));
    } else {
        setPhotoFile(null);
        setPhotoPreview(null);
    }
  };

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  // Função para buscar CEP no ViaCEP
  const handleCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    if (cep.length === 8) {
      try {
        setMessage('Buscando CEP...');
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
          setMessage('CEP não encontrado. Verifique e digite o endereço manualmente.');
          setFormData(prev => ({ 
            ...prev,
            address_street: '',
            address_complement: '',
            neighborhood: '',
            city: '',
            state: ''
          }));
        } else {
          setMessage(''); // Limpa a mensagem se o CEP for encontrado
          setFormData(prev => ({
            ...prev,
            address_street: data.logradouro || '',
            address_complement: data.complemento || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || ''
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
        setMessage('Erro ao buscar CEP. Tente novamente.');
      }
    } else {
      setMessage('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    handleCpfBlur();
    if (formData.cpf && !validaCPF(formData.cpf)) {
        setMessage('Não é possível salvar com um CPF inválido.');
        return;
    }
    
    setIsUploading(true);
    setMessage('Cadastrando funcionário...');

    const { data: funcionarioData, error: funcionarioError } = await supabase
      .from('funcionarios').insert([formData]).select().single();

    if (funcionarioError) {
      setMessage(`Erro: ${funcionarioError.message}`);
      setIsUploading(false);
      return;
    }

    const funcionarioId = funcionarioData.id;
    const updates = {};
    const uploadFile = async (file, docType) => {
      if (!file) return;
      // Garante que o nome do arquivo seja único e seguro para URL
      const safeFileName = `${docType}-${Date.now()}-${file.name.replace(/\s/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const filePath = `${funcionarioId}/${safeFileName}`;
      const { error } = await supabase.storage.from('funcionarios-documentos').upload(filePath, file);
      if (error) throw new Error(`Falha no upload (${docType}): ${error.message}`);
      updates[docType] = filePath;
    };

    try {
      await uploadFile(photoFile, 'foto_url');
      await uploadFile(asoFile, 'aso_doc');
      await uploadFile(contractFile, 'contract_doc');
      await uploadFile(identityFile, 'identity_doc');
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from('funcionarios').update(updates).eq('id', funcionarioId);
        if (updateError) throw new Error(`Falha ao salvar documentos: ${updateError.message}`);
      }
      setMessage('Funcionário cadastrado com sucesso!');
      setFormData(initialState);
      setPhotoFile(null); setAsoFile(null); setContractFile(null); setIdentityFile(null);
      setPhotoPreview(null); setCpfError('');

      // Limpa os campos de input de arquivo usando as referências
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (asoInputRef.current) asoInputRef.current.value = "";
      if (contractInputRef.current) contractInputRef.current.value = "";
      if (identityInputRef.current) identityInputRef.current.value = "";

    } catch (error) {
      setMessage(`Erro: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Cadastro de Novo Funcionário</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-xl font-semibold text-gray-800">Vínculos Profissionais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="empresa_id" className="block text-sm font-medium text-gray-700">Empresa Contratante</label>
              <select id="empresa_id" name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                <option value="">Selecione...</option>
                {companies?.map((c) => (<option key={c.id} value={c.id}>{c.razao_social}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="empreendimento_atual_id" className="block text-sm font-medium text-gray-700">Empreendimento</label>
              <select id="empreendimento_atual_id" name="empreendimento_atual_id" value={formData.empreendimento_atual_id || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                <option value="">Nenhum</option>
                {empreendimentos?.map((e) => (<option key={e.id} value={e.id}>{e.nome}</option>))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados Pessoais</h2>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <label htmlFor="photo" className="block text-sm font-medium text-gray-700">Foto do Perfil</label>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 bg-gray-50">
                  <div className="text-center">
                      {photoPreview ? <img src={photoPreview} alt="Pré-visualização" className="mx-auto h-32 w-32 rounded-full object-cover" /> : <svg className="mx-auto h-12 w-12 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5a.75.75 0 002.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" /></svg>}
                      <div className="mt-4 flex text-sm text-gray-600">
                          <label htmlFor="photo" className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 hover:text-blue-500">
                              <span>Enviar arquivo</span>
                              <input id="photo" name="photo" type="file" ref={photoInputRef} className="sr-only" accept="image/*" onChange={handlePhotoChange} />
                          </label>
                          <p className="pl-1">ou arraste</p>
                      </div>
                      <p className="text-xs text-gray-600">PNG, JPG, GIF até 10MB</p>
                  </div>
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-col gap-6">
                <div><label htmlFor="full_name" className="block text-sm font-medium">Nome Completo</label><input type="text" id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} required className="mt-1 block w-full p-2 border rounded-md"/></div>
                <div className="grid sm:grid-cols-2 gap-6">
                    <div><label htmlFor="cpf" className="block text-sm font-medium">CPF</label><IMaskInput mask="000.000.000-00" id="cpf" name="cpf" value={formData.cpf} unmask onAccept={(v) => handleMaskedChange('cpf', v)} onBlur={handleCpfBlur} required className={`mt-1 w-full p-2 border rounded-md ${cpfError ? 'border-red-500':'border-gray-300'}`}/>{cpfError && <p className="text-red-500 text-xs mt-1">{cpfError}</p>}</div>
                    <div><label htmlFor="rg" className="block text-sm font-medium">RG</label><input type="text" id="rg" name="rg" value={formData.rg || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                    <div><label htmlFor="birth_date" className="block text-sm font-medium">Data de Nascimento</label><input type="date" id="birth_date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div><label htmlFor="estado_civil" className="block text-sm font-medium">Estado Civil</label><select id="estado_civil" name="estado_civil" value={formData.estado_civil || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option><option>Solteiro(a)</option><option>Casado(a)</option><option>Divorciado(a)</option><option>Viúvo(a)</option><option>União Estável</option></select></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                    <div><label htmlFor="phone" className="block text-sm font-medium">Telefone</label><IMaskInput mask="(00) 00000-0000" id="phone" name="phone" value={formData.phone} unmask onAccept={(v) => handleMaskedChange('phone', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div><label htmlFor="email" className="block text-sm font-medium">Email</label><input type="email" id="email" name="email" value={formData.email || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                </div>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-xl font-semibold text-gray-800">Endereço</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-6 gap-6">
            <div className="sm:col-span-2">
              <label htmlFor="cep" className="block text-sm font-medium">CEP</label>
              <IMaskInput 
                mask="00000-000" 
                id="cep" 
                name="cep" 
                value={formData.cep} 
                unmask 
                onAccept={(v) => handleMaskedChange('cep', v)} 
                onBlur={handleCepBlur} // Adicionado o evento onBlur para buscar o CEP
                className="mt-1 w-full p-2 border rounded-md"
              />
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="address_street" className="block text-sm font-medium">Rua / Logradouro</label>
              <input type="text" id="address_street" name="address_street" value={formData.address_street || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="address_number" className="block text-sm font-medium">Número</label>
              <input type="text" id="address_number" name="address_number" value={formData.address_number || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="address_complement" className="block text-sm font-medium">Complemento</label>
              <input type="text" id="address_complement" name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="neighborhood" className="block text-sm font-medium">Bairro</label>
              <input type="text" id="neighborhood" name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="city" className="block text-sm font-medium">Cidade</label>
              <input type="text" id="city" name="city" value={formData.city || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="state" className="block text-sm font-medium">Estado</label>
              <input type="text" id="state" name="state" value={formData.state || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados Contratuais</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2"><label htmlFor="contract_role" className="block text-sm font-medium">Cargo</label><input id="contract_role" type="text" name="contract_role" value={formData.contract_role} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" /></div>
            <div><label htmlFor="admission_date" className="block text-sm font-medium">Data de Admissão</label><input id="admission_date" type="date" name="admission_date" value={formData.admission_date} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" /></div>
            <div><label htmlFor="base_salary" className="block text-sm font-medium">Salário Base</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} id="base_salary" value={String(formData.base_salary || '')} onAccept={(v) => handleMaskedChange('base_salary', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label htmlFor="total_salary" className="block text-sm font-medium">Salário Total</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} id="total_salary" value={String(formData.total_salary || '')} onAccept={(v) => handleMaskedChange('total_salary', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label htmlFor="daily_value" className="block text-sm font-medium">Valor Diária</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} id="daily_value" value={String(formData.daily_value || '')} onAccept={(v) => handleMaskedChange('daily_value', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
          </div>
        </div>
        
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-xl font-semibold text-gray-800">Dados de Pagamento</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label htmlFor="payment_method" className="block text-sm font-medium">Método</label><input id="payment_method" type="text" name="payment_method" value={formData.payment_method || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label htmlFor="pix_key" className="block text-sm font-medium">Chave PIX</label><input id="pix_key" type="text" name="pix_key" value={formData.pix_key || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2"><label htmlFor="bank_details" className="block text-sm font-medium">Dados Bancários</label><textarea id="bank_details" name="bank_details" value={formData.bank_details || ''} onChange={handleChange} rows="3" className="mt-1 w-full p-2 border rounded-md"></textarea></div>
          </div>
        </div>

        <div className="border-b border-gray-900/10 pb-8">
            <h2 className="text-xl font-semibold text-gray-800">Documentos Adicionais</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div><label htmlFor="aso_doc" className="block text-sm font-medium">Documento ASO</label><input id="aso_doc" name="aso_doc" type="file" ref={asoInputRef} onChange={handleFileChange(setAsoFile)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/></div>
                <div><label htmlFor="contract_doc" className="block text-sm font-medium">Contrato</label><input id="contract_doc" name="contract_doc" type="file" ref={contractInputRef} onChange={handleFileChange(setContractFile)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/></div>
                <div><label htmlFor="identity_doc" className="block text-sm font-medium">Doc. de Identidade</label><input id="identity_doc" name="identity_doc" type="file" ref={identityInputRef} onChange={handleFileChange(setIdentityFile)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/></div>
            </div>
        </div>

        <div>
            <label htmlFor="observations" className="block text-sm font-medium">Observações</label>
            <textarea id="observations" name="observations" value={formData.observations || ''} onChange={handleChange} rows="4" className="mt-1 w-full p-2 border rounded-md"></textarea>
        </div>
        
        <div className="mt-6 flex items-center justify-end gap-x-6">
          <button type="submit" disabled={isUploading} className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 disabled:bg-gray-400">
            {isUploading ? 'Salvando...' : 'Salvar Funcionário'}
          </button>
        </div>
        
        {message && <p className="text-center font-medium mt-4">{message}</p>}
      </form>
    </div>
  );
}