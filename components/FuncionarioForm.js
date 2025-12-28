// components/FuncionarioForm.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle, faSpinner, faClock, faDollarSign } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import ConfirmReadmissionModal from './modals/ConfirmReadmissionModal';

const DRAFT_KEY = 'RH_FUNC_FORM_DRAFT';

const HistoricoSalarialModal = ({ isOpen, onClose, onSave, funcionarioId, organizacaoId }) => {
    // ... (Mantido igual, apenas encurtado aqui para foco na lógica principal)
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [novoHistorico, setNovoHistorico] = useState({ data_inicio_vigencia: new Date().toISOString().split('T')[0], salario_base: '', valor_diaria: '', motivo_alteracao: '' });
    if (!isOpen) return null;
    const handleChange = (e) => { const { name, value } = e.target; setNovoHistorico(prev => ({ ...prev, [name]: value })); };
    const handleSave = async () => {
        if (!novoHistorico.data_inicio_vigencia || (!novoHistorico.salario_base && !novoHistorico.valor_diaria)) { toast.error("Dados obrigatórios faltando."); return; }
        setLoading(true); await onSave({ ...novoHistorico, funcionario_id: funcionarioId, organizacao_id: organizacaoId }); setLoading(false); onClose();
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-4">Alteração Salarial</h3>
                {/* ... inputs simplificados visualmente aqui ... */}
                <div className="space-y-4">
                    <input type="date" name="data_inicio_vigencia" value={novoHistorico.data_inicio_vigencia} onChange={handleChange} className="w-full p-2 border rounded" />
                    <IMaskInput mask="R$ num" unmask={true} onAccept={(v) => setNovoHistorico(p => ({...p, salario_base: v}))} className="w-full p-2 border rounded" placeholder="Salário Base" />
                    <IMaskInput mask="R$ num" unmask={true} onAccept={(v) => setNovoHistorico(p => ({...p, valor_diaria: v}))} className="w-full p-2 border rounded" placeholder="Valor Diária" />
                    <input type="text" name="motivo_alteracao" value={novoHistorico.motivo_alteracao} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Motivo" />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button>
                </div>
            </div>
        </div>
    );
};

export default function FuncionarioForm({ 
    companies = [], 
    empreendimentos = [], 
    initialData, 
    jornadas = [],
    onClose,      
    onSaveSuccess 
}) {
    const supabase = createClient();
    const router = useRouter();
    const { user } = useAuth();
    const isEditing = Boolean(initialData);

    const getInitialState = () => ({
        empresa_id: null, empreendimento_atual_id: null, full_name: '', cpf: '', rg: '',
        birth_date: '', phone: '', email: '', estado_civil: '', cep: '', address_street: '',
        address_number: '', address_complement: '', neighborhood: '', city: '', state: '',
        contract_role: '', admission_date: new Date().toISOString().split('T')[0], demission_date: null, status: 'Ativo',
        payment_method: '', pix_key: '', bank_details: '', observations: '', foto_url: null,
        numero_ponto: null, jornada_id: null, contato_id: null,
        salario_base: '', valor_diaria: '',
    });
    
    const [formData, setFormData] = useState(initialData || getInitialState());
    const [newPhotoFile, setNewPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(initialData?.foto_url || null);
    const [isUploading, setIsUploading] = useState(false);
    const [isModalSalarialOpen, setIsModalSalarialOpen] = useState(false);
    const [salarioAtual, setSalarioAtual] = useState({ salario_base: null, valor_diaria: null });
    const [isReadmissionModalOpen, setIsReadmissionModalOpen] = useState(false);
    const [existingEmployee, setExistingEmployee] = useState(null);

    // --- PERSISTÊNCIA DE RASCUNHO (DRAFT) ---
    // 1. Ao montar, verifica se existe rascunho salvo no localStorage
    useEffect(() => {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const parsedDraft = JSON.parse(savedDraft);
                // Só restaura o rascunho se estivermos no mesmo contexto (mesmo ID de edição ou ambos criando novo)
                const currentId = initialData?.id || 'new';
                const draftId = parsedDraft._draftId || 'new';

                if (currentId === draftId) {
                    setFormData(prev => ({ ...prev, ...parsedDraft }));
                    toast.info('Rascunho restaurado.', { duration: 2000 });
                }
            } catch (e) {
                console.error("Erro ao ler rascunho", e);
            }
        }
    }, [initialData]);

    // 2. Sempre que formData mudar, salva no localStorage
    useEffect(() => {
        const draftData = {
            ...formData,
            _draftId: initialData?.id || 'new' // Marca d'água para saber a quem pertence o rascunho
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    }, [formData, initialData]);

    // 3. Limpa o rascunho ao fechar/cancelar ou salvar com sucesso
    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
    };

    // --- CARREGAMENTO DE DADOS INICIAIS ---
    useEffect(() => {
        const fetchRelatedData = async () => {
            if (initialData?.id) {
                if (initialData.foto_url && !initialData.foto_url.startsWith('http')) {
                    const { data } = supabase.storage.from('funcionarios-documentos').getPublicUrl(initialData.foto_url);
                    setPhotoPreview(data?.publicUrl);
                } else {
                    setPhotoPreview(initialData.foto_url);
                }
                const { data } = await supabase.from('historico_salarial').select('salario_base, valor_diaria').eq('funcionario_id', initialData.id).order('data_inicio_vigencia', { ascending: false }).limit(1).maybeSingle();
                if (data) setSalarioAtual(data);
            }
        };
        if (isEditing) {
            // Se estamos editando, o formData já começa com initialData (pelo useState inicial),
            // mas o fetchRelatedData busca dados extras (salário, url foto).
            fetchRelatedData();
        }
    }, [initialData, supabase, isEditing]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value === '' ? null : value })); };
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
    
    const handleSaveHistoricoSalarial = async (novoHistorico) => {
        const { error } = await supabase.from('historico_salarial').insert(novoHistorico);
        if (error) { toast.error(`Erro: ${error.message}`); } else {
            toast.success("Histórico atualizado!");
            setSalarioAtual({ salario_base: novoHistorico.salario_base, valor_diaria: novoHistorico.valor_diaria });
        }
    };
    
    const proceedWithCreation = async () => {
        setIsUploading(true);
        try {
            const orgId = user?.organizacao_id;
            if (!orgId) throw new Error("Organização não identificada.");

            let finalFotoPath = formData.foto_url;
            let finalContatoId = formData.contato_id;
    
            if (formData.cpf) {
                const contatoData = { nome: formData.full_name, cpf: formData.cpf, personalidade_juridica: 'Pessoa Física', tipo_contato: 'Fornecedor', organizacao_id: orgId };
                const { data: existingContact } = await supabase.from('contatos').select('id').eq('cpf', formData.cpf).eq('organizacao_id', orgId).maybeSingle();
                if (existingContact) { finalContatoId = existingContact.id; } 
                else {
                    const { data: newContact, error: contactError } = await supabase.from('contatos').insert(contatoData).select('id').single();
                    if (contactError) throw new Error(`Erro ao criar Contato: ${contactError.message}`);
                    finalContatoId = newContact.id;
                    if (formData.email) await supabase.from('emails').insert({ contato_id: finalContatoId, email: formData.email, tipo: 'Principal', organizacao_id: orgId });
                    if (formData.phone) await supabase.from('telefones').insert({ contato_id: finalContatoId, telefone: formData.phone.replace(/\D/g, ''), tipo: 'Celular', organizacao_id: orgId });
                }
            }
    
            if (newPhotoFile) {
                const fileExtension = newPhotoFile.name.split('.').pop();
                const filePath = `${orgId}/documentos/${formData.id || 'novo'}/foto_perfil_${Date.now()}.${fileExtension}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('funcionarios-documentos').upload(filePath, newPhotoFile, { upsert: true });
                if (uploadError) throw new Error(`Erro foto: ${uploadError.message}`);
                finalFotoPath = uploadData.path;
            }
            
            const dataToSave = { ...formData };
            // Limpa campos auxiliares do rascunho antes de salvar
            delete dataToSave._draftId; 
            ['birth_date', 'admission_date', 'demission_date'].forEach(key => { if(dataToSave[key] === '') dataToSave[key] = null; });
            
            const { id, created_at, cadastro_empresa, empreendimentos, documentos_funcionarios, salario_base, valor_diaria, ...dbData } = {
                ...dataToSave,
                foto_url: finalFotoPath,
                contato_id: finalContatoId,
                organizacao_id: isEditing ? formData.organizacao_id : orgId
            };
    
            if (isEditing) {
                const { error } = await supabase.from('funcionarios').update(dbData).eq('id', id);
                if (error) throw error;
            } else {
                const { data: newFunc, error } = await supabase.from('funcionarios').insert([dbData]).select().single();
                if (error) throw error;
                if (newFunc && (formData.salario_base || formData.valor_diaria)) {
                    await supabase.from('historico_salarial').insert({
                        funcionario_id: newFunc.id,
                        data_inicio_vigencia: formData.admission_date,
                        salario_base: parseFloat(String(formData.salario_base || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || null,
                        valor_diaria: parseFloat(String(formData.valor_diaria || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || null,
                        motivo_alteracao: 'Salário inicial',
                        criado_por_usuario_id: user.id,
                        organizacao_id: orgId
                    });
                }
            }

            toast.success(`Funcionário ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`);
            clearDraft(); // Limpa rascunho ao salvar com sucesso
            
            if (onSaveSuccess) onSaveSuccess();
            else { router.push('/recursos-humanos'); router.refresh(); }

        } catch (err) {
            toast.error(`Erro: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isEditing) { await proceedWithCreation(); return; }
        if (formData.cpf && user?.organizacao_id) {
            const { data: existing } = await supabase.from('funcionarios').select('full_name, demission_date').eq('cpf', formData.cpf).eq('status', 'Demitido').eq('organizacao_id', user.organizacao_id).limit(1).maybeSingle();
            if (existing) { setExistingEmployee(existing); setIsReadmissionModalOpen(true); } 
            else { await proceedWithCreation(); }
        } else { await proceedWithCreation(); }
    };
     
    const handleCepBlur = async (cep) => { 
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;
        const promise = fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`).then(async (res) => {
            if (!res.ok) throw new Error('CEP não encontrado');
            const data = await res.json();
            if (data.erro) throw new Error('CEP inválido.');
            setFormData(prev => ({ ...prev, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }));
            return 'Endereço preenchido!';
        });
        toast.promise(promise, { loading: 'Buscando CEP...', success: (msg) => msg, error: (err) => err.message });
    };
    
    const formatCurrency = (value) => value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'Não definido';

    // Handler para botão cancelar
    const handleCancel = () => {
        clearDraft();
        if (onClose) onClose();
        else router.back();
    };

    return (
        <div className="bg-white rounded-lg shadow-none p-0">
            <ConfirmReadmissionModal isOpen={isReadmissionModalOpen} onClose={() => setIsReadmissionModalOpen(false)} onConfirm={() => { setIsReadmissionModalOpen(false); proceedWithCreation(); }} funcionarioExistente={existingEmployee} />
            <HistoricoSalarialModal isOpen={isModalSalarialOpen} onClose={() => setIsModalSalarialOpen(false)} onSave={handleSaveHistoricoSalarial} funcionarioId={formData.id} organizacaoId={formData.organizacao_id} />

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* --- SEÇÃO FOTO --- */}
                <div className="flex items-center gap-4 border-b pb-4">
                    {photoPreview ? <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border" /> : <FontAwesomeIcon icon={faUserCircle} className="w-20 h-20 text-gray-300" />}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Foto de Perfil</label>
                        <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={isUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/>
                    </div>
                </div>

                {/* --- DADOS EMPRESA --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Empresa Contratante *</label>
                        <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Empreendimento</label>
                        <select name="empreendimento_atual_id" value={formData.empreendimento_atual_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Nenhum</option>
                            {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                    </div>
                </div>

                {/* --- DADOS PESSOAIS --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Nome Completo *</label>
                        <input name="full_name" required onChange={handleChange} value={formData.full_name || ''} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">CPF *</label>
                        <IMaskInput mask="000.000.000-00" name="cpf" required onAccept={(v) => handleMaskedChange('cpf', v)} value={formData.cpf || ''} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                    <div><label className="block text-sm font-medium">RG</label><input name="rg" onChange={handleChange} value={formData.rg || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">Nascimento</label><input type="date" name="birth_date" onChange={handleChange} value={formData.birth_date || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">Telefone</label><IMaskInput mask="(00) 00000-0000" name="phone" onAccept={(v) => handleMaskedChange('phone', v)} value={formData.phone || ''} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium">Email</label><input type="email" name="email" onChange={handleChange} value={formData.email || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">Estado Civil</label><input name="estado_civil" onChange={handleChange} value={formData.estado_civil || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                </div>

                {/* --- CONTRATO E JORNADA --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div><label className="block text-sm font-medium">Cargo *</label><input name="contract_role" required onChange={handleChange} value={formData.contract_role || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">Admissão *</label><input type="date" name="admission_date" required onChange={handleChange} value={formData.admission_date || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                    <div>
                        <label className="block text-sm font-medium">Status</label>
                        <select name="status" value={formData.status || 'Ativo'} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                            <option value="Ativo">Ativo</option>
                            <option value="Inativo">Inativo</option>
                            <option value="Férias">Férias</option>
                            <option value="Demitido">Demitido</option>
                        </select>
                    </div>
                    {formData.status === 'Demitido' && ( <div><label className="block text-sm font-medium">Data Demissão</label><input type="date" name="demission_date" onChange={handleChange} value={formData.demission_date || ''} className="mt-1 w-full p-2 border rounded-md" /></div> )}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium"><FontAwesomeIcon icon={faClock} className="mr-1"/> Jornada</label>
                        <select name="jornada_id" value={formData.jornada_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione...</option>
                            {jornadas?.map((j) => (<option key={j.id} value={j.id}>{j.nome_jornada} ({j.carga_horaria_semanal}h)</option>))}
                        </select>
                    </div>
                    <div><label className="block text-sm font-medium">Nº Ponto</label><input type="number" name="numero_ponto" onChange={handleChange} value={formData.numero_ponto || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                </div>
                
                {/* --- FINANCEIRO --- */}
                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Financeiro</h2>
                        {isEditing && <button type="button" onClick={() => setIsModalSalarialOpen(true)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-semibold border border-green-200">Alterar Salário</button>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {!isEditing ? (
                            <>
                                <div><label className="block text-sm font-medium">Salário Base</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} unmask={true} onAccept={(v) => handleMaskedChange('salario_base', v)} value={formData.salario_base || ''} className="mt-1 w-full p-2 border rounded-md"/></div>
                                <div><label className="block text-sm font-medium">Valor Diária</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} unmask={true} onAccept={(v) => handleMaskedChange('valor_diaria', v)} value={formData.valor_diaria || ''} className="mt-1 w-full p-2 border rounded-md"/></div>
                            </>
                        ) : (
                            <div className="md:col-span-2 flex gap-4 text-sm bg-gray-50 p-2 rounded border">
                                <div><span className="text-gray-500">Salário:</span> <span className="font-bold">{formatCurrency(salarioAtual.salario_base)}</span></div>
                                <div><span className="text-gray-500">Diária:</span> <span className="font-bold">{formatCurrency(salarioAtual.valor_diaria)}</span></div>
                            </div>
                        )}
                        <div><label className="block text-sm font-medium">Pagamento via</label><input name="payment_method" onChange={handleChange} value={formData.payment_method || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Chave PIX</label><input name="pix_key" onChange={handleChange} value={formData.pix_key || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium">Dados Bancários</label><textarea name="bank_details" onChange={handleChange} value={formData.bank_details || ''} rows="2" className="mt-1 w-full p-2 border rounded-md"></textarea></div>
                    </div>
                </div>
                
                {/* --- ENDEREÇO --- */}
                <fieldset className="border-t border-gray-900/10 pt-8">
                    <h2 className="text-xl font-semibold text-gray-800">Endereço</h2>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-6">
                        <div className="md:col-span-2"><label className="block text-sm font-medium">CEP</label><IMaskInput mask="00000-000" name="cep" value={formData.cep || ''} onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
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
                    <div className="mt-6">
                        <label className="block text-sm font-medium">Observações</label>
                        <textarea name="observations" onChange={handleChange} value={formData.observations || ''} rows="4" className="mt-1 w-full p-2 border rounded-md"></textarea>
                    </div>
                </fieldset>
                
                <div className="mt-6 flex items-center justify-end gap-x-6">
                    <button type="button" onClick={handleCancel} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
                    <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-600 font-semibold" disabled={isUploading}>
                        {isUploading ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Processando...</> : (isEditing ? 'Salvar Alterações' : 'Cadastrar')}
                    </button>
                </div>
            </form>
        </div>
    );
}