// components/empresas/EmpresaFormModal.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSave, faImage } from '@fortawesome/free-solid-svg-icons';
import ThumbnailUploader from '@/components/shared/ThumbnailUploader';

export default function EmpresaFormModal({ isOpen, onClose, initialData }) {
 const supabase = createClient();
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
 objeto_social: '',
 capital_social: '',
 natureza_juridica: '',
 logo_url: '',
 });

 const [formData, setFormData] = useState(getInitialState());

 useEffect(() => {
 if (isOpen) {
 setFormData(initialData || getInitialState());
 }
 }, [initialData, isOpen]);

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData(prevState => ({ ...prevState, [name]: value }));
 };

 const handleMaskedChange = (name, value) => {
 setFormData(prevState => ({ ...prevState, [name]: value }));
 };

 const handleImageUpdate = (field, url) => {
 setFormData(prev => ({ ...prev, [field]: url }));
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
 address_street: data.logradouro || data.logouro, // Ajuste para a API viacep
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
 const capitalSocialNumerico = data.capital_social ? parseFloat(String(data.capital_social).replace(/[^0-9,]/g, '').replace(',', '.')) : null;

 const dataToSubmit = {
 ...data,
 capital_social: capitalSocialNumerico,
 organizacao_id: user.organizacao_id
 };

 const { id, ...dbData } = dataToSubmit;

 if (isEditing) {
 const { data: updatedData, error } = await supabase.from('cadastro_empresa').update(dbData).eq('id', id).select().single();
 if (error) throw error;
 return updatedData;
 } else {
 const { data: insertedData, error } = await supabase.from('cadastro_empresa').insert(dbData).select().single();
 if (error) throw error;
 return insertedData;
 }
 },
 onSuccess: (savedData) => {
 toast.success(`Empresa ${isEditing ? 'atualizada' : 'cadastrada'} com sucesso!`);
 queryClient.invalidateQueries({ queryKey: ['empresas'] });
 onClose(savedData); // Retorna a empresa salva para o componente pai atualizar a view
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

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col slide-in-bottom">

 {/* Header do Modal */}
 <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
 <h2 className="text-xl font-bold text-gray-800">
 {isEditing ? `Editar: ${initialData.nome_fantasia || initialData.razao_social}` : 'Nova Empresa'}
 </h2>
 <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600 transition-colors p-2">
 <FontAwesomeIcon icon={faTimes} className="text-xl" />
 </button>
 </div>

 {/* Corpo (Scrollable) */}
 <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
 <form id="empresa-form" onSubmit={handleSubmit} className="space-y-8">
 <fieldset>
 <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
 <FontAwesomeIcon icon={faImage} className="text-blue-500" />
 Identidade Visual
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
 <div>
 <ThumbnailUploader
 label="Logo da Empresa (Formato Quadrado/Horizontal)"
 url={formData.logo_url}
 onUpload={(url) => handleImageUpdate('logo_url', url)}
 bucketName="empresas"
 aspectRatio="aspect-square"
 objectFit="object-contain"
 />
 </div>
 </div>
 </fieldset>

 <fieldset>
 <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Dados da Empresa</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700">Razão Social *</label>
 <input name="razao_social" required onChange={handleChange} value={formData.razao_social || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Nome legal completo" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700">Nome Fantasia</label>
 <input name="nome_fantasia" onChange={handleChange} value={formData.nome_fantasia || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Como a empresa é conhecida" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700">CNPJ *</label>
 <IMaskInput mask="00.000.000/0000-00" name="cnpj" required onAccept={(v) => handleMaskedChange('cnpj', v)} value={formData.cnpj || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="00.000.000/0000-00" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700">Inscrição Estadual</label>
 <input name="inscricao_estadual" onChange={handleChange} value={formData.inscricao_estadual || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700">Inscrição Municipal</label>
 <input name="inscricao_municipal" onChange={handleChange} value={formData.inscricao_municipal || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 </div>
 </fieldset>

 <fieldset>
 <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Dados Legais</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700">Natureza Jurídica</label>
 <input name="natureza_juridica" onChange={handleChange} value={formData.natureza_juridica || ''} placeholder="Ex: Sociedade Empresarial Limitada" className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700">Capital Social</label>
 <IMaskInput
 mask="R$ num"
 blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true } }}
 name="capital_social"
 value={String(formData.capital_social || '')}
 onAccept={(value) => handleMaskedChange('capital_social', value)}
 className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
 placeholder="R$ 0,00"
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-gray-700">Objeto Social</label>
 <textarea name="objeto_social" onChange={handleChange} value={formData.objeto_social || ''} rows="2" placeholder="Descreva as atividades da empresa conforme contrato social..." className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"></textarea>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700">Responsável Legal</label>
 <input name="responsavel_legal" onChange={handleChange} value={formData.responsavel_legal || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Nome do representante principal" />
 </div>
 </div>
 </fieldset>

 <fieldset>
 <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Integrações</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700">ID Meta Business (Gerenciador)</label>
 <input
 name="meta_business_id"
 onChange={handleChange}
 value={formData.meta_business_id || ''}
 className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
 placeholder="Ex: 1900130190871246"
 />
 </div>
 </div>
 </fieldset>

 <fieldset>
 <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Contato e Endereço</h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700">Telefone</label>
 <IMaskInput mask={['(00) 0000-0000', '(00) 00000-0000']} name="telefone" onAccept={(v) => handleMaskedChange('telefone', v)} value={formData.telefone || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="(00) 00000-0000" />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-gray-700">E-mail</label>
 <input type="email" name="email" onChange={handleChange} value={formData.email || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="contato@empresa.com.br" />
 </div>

 <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
 <div className="md:col-span-1">
 <label className="block text-sm font-medium text-gray-700">CEP</label>
 <IMaskInput mask="00000-000" name="cep" onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} value={formData.cep || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="00000-000" />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-gray-700">Rua / Logradouro</label>
 <input name="address_street" onChange={handleChange} value={formData.address_street || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 <div className="md:col-span-1">
 <label className="block text-sm font-medium text-gray-700">Número</label>
 <input name="address_number" onChange={handleChange} value={formData.address_number || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 <div className="md:col-span-1">
 <label className="block text-sm font-medium text-gray-700">Complemento</label>
 <input name="address_complement" onChange={handleChange} value={formData.address_complement || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 <div className="md:col-span-3 grid grid-cols-3 gap-4">
 <div className="col-span-1">
 <label className="block text-sm font-medium text-gray-700">Bairro</label>
 <input name="neighborhood" onChange={handleChange} value={formData.neighborhood || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 <div className="col-span-1">
 <label className="block text-sm font-medium text-gray-700">Cidade</label>
 <input name="city" onChange={handleChange} value={formData.city || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
 </div>
 <div className="col-span-1">
 <label className="block text-sm font-medium text-gray-700">Estado</label>
 <input name="state" onChange={handleChange} value={formData.state || ''} className="mt-1 w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-transform-uppercase" maxLength="2" />
 </div>
 </div>
 </div>
 </div>
 </fieldset>
 </form>
 </div>

 {/* Footer do Modal */}
 <div className="px-6 py-4 border-t bg-gray-50 flex justify-end items-center gap-3 flex-shrink-0">
 <button type="button" onClick={() => onClose()} disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
 Cancelar
 </button>
 <button type="submit" form="empresa-form" disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
 {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
 {isSaving ? 'Salvando...' : 'Salvar Empresa'}
 </button>
 </div>
 </div>
 </div>
 );
}
