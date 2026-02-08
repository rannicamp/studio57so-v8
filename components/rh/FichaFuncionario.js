//components\FichaFuncionario.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Por que: Adicionamos este helper para formatar datas no formato 'YYYY-MM-DD'
// para 'DD/MM/YYYY' de forma segura, sem causar problemas com fuso horário.
const formatSimpleDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        return 'N/A';
    }
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

// Componente para exibir um campo de informação no modo de visualização
const InfoField = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

// Componente para um campo de input no modo de edição
const EditField = ({ label, name, value, onChange, type = "text", required = false }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type={type}
            name={name}
            id={name}
            value={value || ''}
            onChange={onChange}
            required={required}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
        />
    </div>
);

// Componente para um campo de input com máscara (CPF, Telefone, etc.)
const EditMaskedField = ({ label, name, value, onAccept, onBlur, mask, blocks, required = false }) => (
     <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <IMaskInput
            mask={mask}
            blocks={blocks}
            id={name}
            name={name}
            value={value || ''}
            onAccept={onAccept}
            onBlur={onBlur}
            required={required}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
        />
    </div>
);


export default function FichaFuncionario({ initialEmployee, companies, empreendimentos }) {
  const supabase = createClient();
  const router = useRouter();
  const { canViewSalaries } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [employee, setEmployee] = useState(initialEmployee);
  const [formData, setFormData] = useState(initialEmployee || {});
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(initialEmployee?.foto_url || null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleMaskedChange = (name, value) => {
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };
  
  const handleCepBlur = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    const promise = () => new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        if (!response.ok) throw new Error('CEP não encontrado na base de dados.');
        const data = await response.json();
        if (data.erro) throw new Error('CEP inválido ou não encontrado.');

        setFormData(prev => ({
            ...prev,
            address_street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
        }));
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(promise, {
        loading: 'Buscando CEP...',
        success: 'Endereço preenchido!',
        error: (err) => err.message,
    });
  };
  
  const handlePhotoChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);

    const promise = () => new Promise(async (resolve, reject) => {
        const fileExtension = file.name.split('.').pop();
        const newFileName = `public/${employee.id}-${Date.now()}.${fileExtension}`;
        
        if (formData.foto_url) {
            const oldFilePath = formData.foto_url.split('/funcionarios-documentos/')[1];
            if (oldFilePath) {
                await supabase.storage.from('funcionarios-documentos').remove([oldFilePath]);
            }
        }

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('funcionarios-documentos')
            .upload(newFileName, file);
        
        if (uploadError) {
            return reject(uploadError);
        }

        const { data: { publicUrl } } = supabase.storage
            .from('funcionarios-documentos')
            .getPublicUrl(uploadData.path);

        setFormData(prev => ({ ...prev, foto_url: publicUrl }));
        setPhotoPreview(publicUrl);
        resolve(publicUrl);
    });
    
    toast.promise(promise, {
        loading: 'Enviando foto...',
        success: 'Foto carregada! Salve as alterações para confirmar.',
        error: (err) => `Erro no upload: ${err.message}`,
        finally: () => setIsUploading(false)
    });
  };

  const handleSaveChanges = async () => {
    const promise = async () => {
        const { id, created_at, cadastro_empresa, empreendimentos, documentos_funcionarios, ...updateData } = formData;
        
        const { data, error } = await supabase
          .from('funcionarios')
          .update(updateData)
          .eq('id', employee.id)
          .select(`*, cadastro_empresa(*), empreendimentos(*), documentos_funcionarios(*)`)
          .single();

        if (error) {
            console.error(error);
            throw error;
        }

        setEmployee(data);
        setIsEditing(false);
        return data;
    };

    toast.promise(promise, {
        loading: 'Salvando alterações...',
        success: 'Funcionário atualizado com sucesso!',
        error: (err) => `Erro ao salvar: ${err.message}`,
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {isEditing ? `Editando Ficha de ${employee.full_name}` : `Ficha de ${employee.full_name}`}
        </h2>
        <div>
            {isEditing && (
                <button onClick={() => { setIsEditing(false); setFormData(employee); }} className="text-sm text-gray-600 hover:text-gray-900 mr-4 font-semibold">
                    Cancelar
                </button>
            )}
            <button
                onClick={() => isEditing ? handleSaveChanges() : setIsEditing(true)}
                className={`${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-md font-semibold`}
            >
                {isEditing ? 'Salvar Alterações' : 'Editar Ficha'}
            </button>
        </div>
      </div>
      
      {isEditing ? (
        // --- MODO DE EDIÇÃO ---
        <div className="space-y-10">
            <fieldset>
                <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Foto de Perfil</legend>
                <div className="flex items-center gap-4">
                    {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                        <FontAwesomeIcon icon={faUserCircle} className="w-24 h-24 text-gray-300" />
                    )}
                    <input type="file" id="photo-upload" onChange={handlePhotoChange} disabled={isUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/>
                    {isUploading && <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />}
                </div>
            </fieldset>

            <fieldset>
                <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Dados Pessoais</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <EditField label="Nome Completo" name="full_name" value={formData.full_name} onChange={handleChange} required />
                    <EditMaskedField label="CPF" name="cpf" value={formData.cpf} onAccept={(v) => handleMaskedChange('cpf', v)} mask="000.000.000-00" required />
                    <EditField label="RG" name="rg" value={formData.rg} onChange={handleChange} />
                    <EditField label="Data de Nascimento" name="birth_date" value={formData.birth_date} onChange={handleChange} type="date" />
                    <EditMaskedField label="Telefone" name="phone" value={formData.phone} onAccept={(v) => handleMaskedChange('phone', v)} mask="(00) 00000-0000" />
                    <EditField label="Email" name="email" value={formData.email} onChange={handleChange} type="email" />
                    <EditField label="Estado Civil" name="estado_civil" value={formData.estado_civil} onChange={handleChange} />
                </div>
            </fieldset>

            <fieldset>
                <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Endereço</legend>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                    <div className="md:col-span-2">
                        <EditMaskedField label="CEP" name="cep" value={formData.cep} onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} mask="00000-000" />
                    </div>
                    <div className="md:col-span-4"><EditField label="Logradouro" name="address_street" value={formData.address_street} onChange={handleChange} /></div>
                    <div className="md:col-span-1"><EditField label="Número" name="address_number" value={formData.address_number} onChange={handleChange} /></div>
                    <div className="md:col-span-2"><EditField label="Complemento" name="address_complement" value={formData.address_complement} onChange={handleChange} /></div>
                    <div className="md:col-span-3"><EditField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleChange} /></div>
                    <div className="md:col-span-4"><EditField label="Cidade" name="city" value={formData.city} onChange={handleChange} /></div>
                    <div className="md:col-span-2"><EditField label="Estado (UF)" name="state" value={formData.state} onChange={handleChange} /></div>
                </div>
            </fieldset>

            <fieldset>
                <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Dados Contratuais</legend>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label htmlFor="empresa_id" className="block text-sm font-medium">Empresa</label>
                        <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="empreendimento_atual_id" className="block text-sm font-medium">Empreendimento Atual</label>
                         <select name="empreendimento_atual_id" value={formData.empreendimento_atual_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Nenhum</option>
                            {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                    </div>
                    <EditField label="Cargo" name="contract_role" value={formData.contract_role} onChange={handleChange} required />
                    <EditField label="Data de Admissão" name="admission_date" value={formData.admission_date} onChange={handleChange} type="date" required />
                    
                    {canViewSalaries && (
                        <>
                           <EditMaskedField label="Salário Base" name="base_salary" value={formData.base_salary} onAccept={(v) => handleMaskedChange('base_salary', v)} mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} />
                           <EditMaskedField label="Salário Total" name="total_salary" value={formData.total_salary} onAccept={(v) => handleMaskedChange('total_salary', v)} mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} />
                           <EditMaskedField label="Valor Diária" name="daily_value" value={formData.daily_value} onAccept={(v) => handleMaskedChange('daily_value', v)} mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' } }} />
                        </>
                    )}
                 </div>
            </fieldset>

             <fieldset>
                <legend className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Outras Informações</legend>
                <div>
                    <label htmlFor="observations" className="block text-sm font-medium text-gray-700">Observações</label>
                    <textarea name="observations" id="observations" value={formData.observations || ''} onChange={handleChange} rows="4" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
                </div>
             </fieldset>
        </div>
      ) : (
        // --- MODO DE VISUALIZAÇÃO ---
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                {employee.foto_url ? (
                    <img src={employee.foto_url} alt="Foto do Funcionário" className="w-24 h-24 rounded-full object-cover" />
                ) : (
                    <FontAwesomeIcon icon={faUserCircle} className="w-24 h-24 text-gray-300" />
                )}
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-8">
                <InfoField label="Nome Completo" value={employee.full_name} />
                <InfoField label="CPF" value={employee.cpf} />
                <InfoField label="Cargo" value={employee.contract_role} />
                <InfoField label="Empresa" value={employee.cadastro_empresa?.razao_social} />
                <InfoField label="Empreendimento Atual" value={employee.empreendimentos?.nome} />
                {/* Por que: Aplicamos o helper para formatar a data corretamente no modo de visualização. */}
                <InfoField label="Data de Admissão" value={formatSimpleDate(employee.admission_date)}/>
                <InfoField label="Telefone" value={employee.phone} />
                <InfoField label="Email" value={employee.email} />
                <InfoField label="Status" value={employee.status} />

                {canViewSalaries && (
                    <>
                      <InfoField label="Salário Base" value={employee.base_salary} />
                      <InfoField label="Salário Total" value={employee.total_salary} />
                      <InfoField label="Valor Diária" value={employee.daily_value} />
                    </>
                )}
            </dl>
        </div>
      )}
    </div>
  );
}