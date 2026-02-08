// components/EmpresaForm.js

"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function EmpresaForm({ initialData }) {
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isEditing = Boolean(initialData);

    const getInitialState = () => ({
        razao_social: '',
        nome_fantasia: '',
        cnpj: '',
        inscricao_estadual: '',
        inscricao_municipal: '',
        telefone: '',
        email: '',
        cep: '',
        address_street: '',
        address_number: '',
        address_complement: '',
        neighborhood: '',
        city: '',
        state: '',
        responsavel_legal: '',
        meta_business_id: '',
        // =================================================================================
        // NOVOS CAMPOS ADICIONADOS AQUI
        // O PORQUÊ: Adicionamos os campos extraídos do Contrato Social para um
        // cadastro mais completo da empresa.
        // =================================================================================
        objeto_social: '',
        capital_social: '',
        natureza_juridica: '',
    });

    const [formData, setFormData] = useState(initialData || getInitialState());

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: value }));
    };

    const handleMaskedChange = (name, value) => {
        setFormData(prevState => ({ ...prevState, [name]: value }));
    };

    const handleCepBlur = useCallback(async (cep) => {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;

        const promise = fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`).then(async (response) => {
            if (!response.ok) throw new Error('Falha ao buscar CEP.');
            const data = await response.json();
            if (data.erro) throw new Error('CEP não encontrado.');
            return data;
        });

        toast.promise(promise, {
            loading: 'Buscando CEP...',
            success: (data) => {
                setFormData(prev => ({
                    ...prev,
                    address_street: data.logouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    state: data.uf,
                }));
                return 'Endereço preenchido!';
            },
            error: (err) => `Erro: ${err.message}`,
        });
    }, []);

    const { mutate: saveEmpresa, isPending: isSaving } = useMutation({
        mutationFn: async (data) => {
            // Limpa e converte o capital_social para número antes de enviar
            const capitalSocialNumerico = data.capital_social ? parseFloat(String(data.capital_social).replace(/[^0-9,]/g, '').replace(',', '.')) : null;

            const dataToSubmit = { 
                ...data, 
                capital_social: capitalSocialNumerico,
                organizacao_id: user.organizacao_id 
            };
            
            const { id, ...dbData } = dataToSubmit;

            if (isEditing) {
                const { error } = await supabase.from('cadastro_empresa').update(dbData).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('cadastro_empresa').insert(dbData);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success(`Empresa ${isEditing ? 'atualizada' : 'cadastrada'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['empresas'] });
            router.push('/empresas');
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        },
    });

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!user?.organizacao_id) {
            toast.error("Não foi possível identificar a organização. Tente novamente.");
            return;
        }
        saveEmpresa(formData);
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-900">
                {isEditing ? `Editando Empresa: ${initialData.razao_social}` : 'Cadastro de Nova Empresa'}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-8">
                <fieldset className="border-t border-gray-900/10 pt-8">
                    <h2 className="text-xl font-semibold text-gray-800">Dados da Empresa</h2>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium">Razão Social *</label>
                            <input name="razao_social" required onChange={handleChange} value={formData.razao_social || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Nome Fantasia</label>
                            <input name="nome_fantasia" onChange={handleChange} value={formData.nome_fantasia || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">CNPJ *</label>
                            <IMaskInput mask="00.000.000/0000-00" name="cnpj" required onAccept={(v) => handleMaskedChange('cnpj', v)} value={formData.cnpj || ''} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Inscrição Estadual</label>
                            <input name="inscricao_estadual" onChange={handleChange} value={formData.inscricao_estadual || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Inscrição Municipal</label>
                            <input name="inscricao_municipal" onChange={handleChange} value={formData.inscricao_municipal || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                </fieldset>

                {/* ================================================================================= */}
                {/* NOVA SEÇÃO DE DADOS LEGAIS ADICIONADA AQUI */}
                {/* ================================================================================= */}
                <fieldset className="border-t border-gray-900/10 pt-8">
                    <h2 className="text-xl font-semibold text-gray-800">Dados Legais</h2>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium">Natureza Jurídica</label>
                            <input name="natureza_juridica" onChange={handleChange} value={formData.natureza_juridica || ''} placeholder="Ex: Sociedade Empresarial Limitada" className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Capital Social</label>
                             <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true }}}
                                name="capital_social"
                                value={String(formData.capital_social || '')}
                                onAccept={(value) => handleMaskedChange('capital_social', value)}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Objeto Social</label>
                            <textarea name="objeto_social" onChange={handleChange} value={formData.objeto_social || ''} rows="3" placeholder="Descreva as atividades da empresa..." className="mt-1 w-full p-2 border rounded-md"></textarea>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Responsável Legal</label>
                            <input name="responsavel_legal" onChange={handleChange} value={formData.responsavel_legal || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="border-t border-gray-900/10 pt-8">
                    <h2 className="text-xl font-semibold text-gray-800">Integrações</h2>
                     <p className="text-sm text-gray-500 mt-1">Configure os IDs de serviços externos para automatizar processos.</p>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium">ID do Gerenciador de Negócios da Meta</label>
                            <input 
                                name="meta_business_id" 
                                onChange={handleChange} 
                                value={formData.meta_business_id || ''} 
                                className="mt-1 w-full p-2 border rounded-md"
                                placeholder="Cole o ID aqui..."
                            />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="border-t border-gray-900/10 pt-8">
                    <h2 className="text-xl font-semibold text-gray-800">Contato e Endereço</h2>
                     <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                           <label className="block text-sm font-medium">Telefone</label>
                           <IMaskInput mask={['(00) 0000-0000', '(00) 00000-0000']} name="telefone" onAccept={(v) => handleMaskedChange('telefone', v)} value={formData.telefone || ''} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                           <label className="block text-sm font-medium">E-mail</label>
                           <input type="email" name="email" onChange={handleChange} value={formData.email || ''} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">CEP</label>
                            <IMaskInput mask="00000-000" name="cep" onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} value={formData.cep || ''} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Rua / Logradouro</label>
                            <input name="address_street" onChange={handleChange} value={formData.address_street || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Número</label>
                            <input name="address_number" onChange={handleChange} value={formData.address_number || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Complemento</label>
                            <input name="address_complement" onChange={handleChange} value={formData.address_complement || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Bairro</label>
                            <input name="neighborhood" onChange={handleChange} value={formData.neighborhood || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Cidade</label>
                            <input name="city" onChange={handleChange} value={formData.city || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Estado</label>
                            <input name="state" onChange={handleChange} value={formData.state || ''} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>
                </fieldset>

                <div className="mt-6 flex items-center justify-end gap-x-6">
                    <button type="button" onClick={() => router.push('/empresas')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 font-semibold disabled:bg-gray-400 flex items-center gap-2">
                        {isSaving && <FontAwesomeIcon icon={faSpinner} spin />}
                        {isEditing ? 'Salvar Alterações' : 'Salvar Empresa'}
                    </button>
                </div>
            </form>
        </div>
    );
}