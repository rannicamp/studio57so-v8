"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faSpinner, faUserCircle, faClock, faBriefcase, faDollarSign 
} from '@fortawesome/free-solid-svg-icons';

import ConfirmReadmissionModal from '../modals/ConfirmReadmissionModal';

const DRAFT_KEY = 'RH_FUNC_MODAL_DRAFT';

// --- SUB-COMPONENTE: MODAL DE SALÁRIO (CORRIGIDO) ---
const HistoricoSalarialModal = ({ isOpen, onClose, onSave, funcionarioId, organizacaoId }) => {
    const supabase = createClient();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    
    // Inicializa com string vazia para evitar problemas com controlled inputs
    const [novoHistorico, setNovoHistorico] = useState({ 
        data_inicio_vigencia: new Date().toISOString().split('T')[0], 
        salario_base: '', 
        valor_diaria: '', 
        motivo_alteracao: '' 
    });

    // Resetar estado ao abrir
    useEffect(() => {
        if (isOpen) {
            setNovoHistorico({ 
                data_inicio_vigencia: new Date().toISOString().split('T')[0], 
                salario_base: '', 
                valor_diaria: '', 
                motivo_alteracao: '' 
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => { 
        const { name, value } = e.target; 
        setNovoHistorico(prev => ({ ...prev, [name]: value })); 
    };

    const handleSave = async () => {
        // Validação: precisa de data e pelo menos um valor financeiro preenchido
        if (!novoHistorico.data_inicio_vigencia || (!novoHistorico.salario_base && !novoHistorico.valor_diaria)) { 
            toast.error("Data e pelo menos um valor (salário ou diária) são obrigatórios."); 
            return; 
        }
        
        setLoading(true);
        
        // Prepara os dados para salvar (converte string monetária para float se necessário, ou mantém se já vier 'unmasked')
        const payload = {
            ...novoHistorico,
            // Garante que se for string vazia, vira null para o banco
            salario_base: novoHistorico.salario_base ? parseFloat(novoHistorico.salario_base.replace(',', '.')) : null,
            valor_diaria: novoHistorico.valor_diaria ? parseFloat(novoHistorico.valor_diaria.replace(',', '.')) : null,
            funcionario_id: funcionarioId, 
            organizacao_id: organizacaoId,
            criado_por_usuario_id: user?.id
        };

        await onSave(payload); 
        setLoading(false); 
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold mb-4">Alteração Salarial</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Data Vigência</label>
                        <input 
                            type="date" 
                            name="data_inicio_vigencia" 
                            value={novoHistorico.data_inicio_vigencia} 
                            onChange={handleChange} 
                            className="w-full p-2 border rounded" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Salário Base</label>
                            {/* CORREÇÃO AQUI: Máscara simplificada e value garantido */}
                            <IMaskInput
                                mask="R$ num"
                                blocks={{
                                    num: {
                                        mask: Number,
                                        thousandsSeparator: '.',
                                        radix: ',',
                                        scale: 2,
                                        padFractionalZeros: true,
                                        normalizeZeros: true,
                                    }
                                }}
                                unmask={true}
                                value={String(novoHistorico.salario_base || '')}
                                onAccept={(value) => setNovoHistorico(prev => ({ ...prev, salario_base: value }))}
                                className="w-full p-2 border rounded"
                                placeholder="0,00" // Placeholder simples
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Valor Diária</label>
                            {/* CORREÇÃO AQUI: Mesmo ajuste para Diária */}
                            <IMaskInput
                                mask="R$ num"
                                blocks={{
                                    num: {
                                        mask: Number,
                                        thousandsSeparator: '.',
                                        radix: ',',
                                        scale: 2,
                                        padFractionalZeros: true,
                                        normalizeZeros: true,
                                    }
                                }}
                                unmask={true}
                                value={String(novoHistorico.valor_diaria || '')}
                                onAccept={(value) => setNovoHistorico(prev => ({ ...prev, valor_diaria: value }))}
                                className="w-full p-2 border rounded"
                                placeholder="0,00"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Motivo</label>
                        <input 
                            type="text" 
                            name="motivo_alteracao" 
                            value={novoHistorico.motivo_alteracao} 
                            onChange={handleChange} 
                            className="w-full p-2 border rounded" 
                            placeholder="Ex: Promoção" 
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center">
                        {loading && <FontAwesomeIcon icon={faSpinner} spin className="mr-2"/>} Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL UNIFICADO ---
export default function FuncionarioModal({ isOpen, onClose, employeeToEdit, onSaveSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const organizacao_id = user?.organizacao_id;
    const isEditing = Boolean(employeeToEdit);

    const { data: auxData, isLoading: isLoadingAux } = useQuery({
        queryKey: ['funcionarioAuxData', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return { companies: [], empreendimentos: [], jornadas: [], cargos: [] };
            const [companies, empreendimentos, jornadas, cargos] = await Promise.all([
                supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacao_id).order('razao_social'),
                supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacao_id).order('nome'),
                supabase.from('jornadas').select('*').eq('organizacao_id', organizacao_id).order('nome_jornada'),
                supabase.from('cargos').select('id, nome').eq('organizacao_id', organizacao_id).order('nome')
            ]);
            return {
                companies: companies.data || [],
                empreendimentos: empreendimentos.data || [],
                jornadas: jornadas.data || [],
                cargos: cargos.data || []
            };
        },
        enabled: isOpen && !!organizacao_id,
        staleTime: 1000 * 60 * 5
    });

    const getInitialState = () => ({
        empresa_id: null, empreendimento_atual_id: null, full_name: '', cpf: '', rg: '',
        birth_date: '', phone: '', email: '', estado_civil: '', cep: '', address_street: '',
        address_number: '', address_complement: '', neighborhood: '', city: '', state: '',
        cargo_id: '', 
        admission_date: new Date().toISOString().split('T')[0], demission_date: null, status: 'Ativo',
        payment_method: '', pix_key: '', bank_details: '', observations: '', foto_url: null,
        numero_ponto: null, jornada_id: null, contato_id: null,
        salario_base: '', valor_diaria: '',
    });

    const [formData, setFormData] = useState(getInitialState());
    const [newPhotoFile, setNewPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const [isModalSalarialOpen, setIsModalSalarialOpen] = useState(false);
    const [isReadmissionModalOpen, setIsReadmissionModalOpen] = useState(false);
    const [existingEmployee, setExistingEmployee] = useState(null);
    const [salarioAtual, setSalarioAtual] = useState({ salario_base: null, valor_diaria: null });

    useEffect(() => {
        if (!isOpen) return;

        if (employeeToEdit) {
            setFormData(prev => ({ ...prev, ...employeeToEdit }));
            if (employeeToEdit.foto_url) {
                if (!employeeToEdit.foto_url.startsWith('http')) {
                    supabase.storage.from('funcionarios-documentos').getPublicUrl(employeeToEdit.foto_url).then(({ data }) => setPhotoPreview(data.publicUrl));
                } else {
                    setPhotoPreview(employeeToEdit.foto_url);
                }
            }
            supabase.from('historico_salarial')
                .select('salario_base, valor_diaria')
                .eq('funcionario_id', employeeToEdit.id)
                .order('data_inicio_vigencia', { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(({ data }) => { if(data) setSalarioAtual(data); });

        } else {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    if (parsed._draftId === 'new') {
                        setFormData(prev => ({ ...prev, ...parsed }));
                        toast.info('Rascunho restaurado.');
                    }
                } catch(e) {}
            } else {
                setFormData(getInitialState());
                setPhotoPreview(null);
            }
        }
    }, [isOpen, employeeToEdit, supabase]);

    useEffect(() => {
        if (isOpen && !employeeToEdit) {
            const draft = { ...formData, _draftId: 'new' };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        }
    }, [formData, isOpen, employeeToEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
    };

    const handleMaskedChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
    
    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSaveHistoricoSalarial = async (novoHistorico) => {
        // CORREÇÃO: novoHistorico já vem com os IDs corretos do modal, só inserimos
        const { error } = await supabase.from('historico_salarial').insert(novoHistorico);
        if (error) toast.error(error.message);
        else {
            toast.success("Histórico atualizado!");
            // Atualiza o display visual do salário atual
            setSalarioAtual({ salario_base: novoHistorico.salario_base, valor_diaria: novoHistorico.valor_diaria });
        }
    };

    const handleCepBlur = async (cep) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;
        const toastId = toast.loading("Buscando CEP...");
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();
            if (data.erro) throw new Error("CEP inválido");
            setFormData(prev => ({ ...prev, address_street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }));
            toast.dismiss(toastId);
            toast.success("Endereço preenchido!");
        } catch (error) {
            toast.dismiss(toastId);
            toast.error("Erro ao buscar CEP");
        }
    };

    const formatCurrency = (val) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'N/A';

    const processSubmit = async () => {
        setIsUploading(true);
        try {
            if (!organizacao_id) throw new Error("Organização inválida.");

            let finalFotoPath = formData.foto_url;
            let finalContatoId = formData.contato_id;

            if (formData.cpf) {
                const { data: existingContact } = await supabase.from('contatos').select('id').eq('cpf', formData.cpf).eq('organizacao_id', organizacao_id).maybeSingle();
                if (existingContact) {
                    finalContatoId = existingContact.id;
                } else {
                    const { data: newContact, error: contactError } = await supabase.from('contatos').insert({
                        nome: formData.full_name, cpf: formData.cpf, personalidade_juridica: 'Pessoa Física', tipo_contato: 'Fornecedor', organizacao_id
                    }).select().single();
                    if (contactError) throw new Error(`Erro contato: ${contactError.message}`);
                    finalContatoId = newContact.id;
                }
            }

            if (newPhotoFile) {
                const ext = newPhotoFile.name.split('.').pop();
                const path = `${organizacao_id}/documentos/${formData.id || 'novo'}/foto_${Date.now()}.${ext}`;
                const { data: upload, error: upError } = await supabase.storage.from('funcionarios-documentos').upload(path, newPhotoFile, { upsert: true });
                if (upError) throw upError;
                finalFotoPath = upload.path;
            }

            const dataToSave = { ...formData };
            delete dataToSave._draftId;
            ['birth_date', 'admission_date', 'demission_date'].forEach(k => { if (!dataToSave[k]) dataToSave[k] = null; });

            const { 
                id, created_at, cadastro_empresa, empreendimentos, documentos_funcionarios, 
                salario_base, valor_diaria, cargos: cargoInfo, ...dbData 
            } = {
                ...dataToSave,
                foto_url: finalFotoPath,
                contato_id: finalContatoId,
                organizacao_id: isEditing ? formData.organizacao_id : organizacao_id
            };

            if (isEditing) {
                const { error } = await supabase.from('funcionarios').update(dbData).eq('id', id);
                if (error) throw error;
            } else {
                const { data: newFunc, error } = await supabase.from('funcionarios').insert([dbData]).select().single();
                if (error) throw error;
                
                // Se é novo funcionário e tem salário preenchido, cria histórico inicial
                if (newFunc && (formData.salario_base || formData.valor_diaria)) {
                    await supabase.from('historico_salarial').insert({
                        funcionario_id: newFunc.id,
                        data_inicio_vigencia: formData.admission_date,
                        // Limpa formatação caso venha com máscara
                        salario_base: parseFloat(String(formData.salario_base || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || null,
                        valor_diaria: parseFloat(String(formData.valor_diaria || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || null,
                        motivo_alteracao: 'Salário inicial',
                        criado_por_usuario_id: user.id,
                        organizacao_id
                    });
                }
            }

            toast.success("Salvo com sucesso!");
            localStorage.removeItem(DRAFT_KEY);
            if (onSaveSuccess) onSaveSuccess();

        } catch (err) {
            toast.error(`Erro: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isEditing) {
            await processSubmit();
        } else {
            if (formData.cpf) {
                const { data: existing } = await supabase.from('funcionarios').select('*').eq('cpf', formData.cpf).eq('status', 'Demitido').eq('organizacao_id', organizacao_id).limit(1).maybeSingle();
                if (existing) {
                    setExistingEmployee(existing);
                    setIsReadmissionModalOpen(true);
                } else {
                    await processSubmit();
                }
            } else {
                await processSubmit();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <ConfirmReadmissionModal 
                isOpen={isReadmissionModalOpen} 
                onClose={() => setIsReadmissionModalOpen(false)} 
                onConfirm={() => { setIsReadmissionModalOpen(false); processSubmit(); }} 
                funcionarioExistente={existingEmployee} 
            />
            <HistoricoSalarialModal 
                isOpen={isModalSalarialOpen} 
                onClose={() => setIsModalSalarialOpen(false)} 
                onSave={handleSaveHistoricoSalarial} 
                funcionarioId={formData.id} 
                organizacaoId={organizacao_id} 
            />

            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isEditing ? `Editando: ${formData.full_name}` : 'Novo Funcionário'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-white">
                        <FontAwesomeIcon icon={faTimes} size="lg"/>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar bg-white flex-1">
                    {isLoadingAux ? (
                        <div className="flex justify-center items-center h-40">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex items-center gap-4 border-b pb-4">
                                {photoPreview ? <img src={photoPreview} className="w-20 h-20 rounded-full object-cover border" /> : <FontAwesomeIcon icon={faUserCircle} className="w-20 h-20 text-gray-300" />}
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
                                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Empresa *</label>
                                    <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                                        <option value="">Selecione...</option>
                                        {auxData?.companies.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Empreendimento</label>
                                    <select name="empreendimento_atual_id" value={formData.empreendimento_atual_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                        <option value="">Nenhum</option>
                                        {auxData?.empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                    </select>
                                </div>
                            </div>

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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                                <div>
                                    <label className="block text-sm font-medium"><FontAwesomeIcon icon={faBriefcase} className="mr-1 text-gray-400"/> Cargo *</label>
                                    <select name="cargo_id" required onChange={handleChange} value={formData.cargo_id || ''} className="mt-1 w-full p-2 border rounded-md">
                                        <option value="">Selecione...</option>
                                        {auxData?.cargos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                    {auxData?.cargos.length === 0 && <p className="text-xs text-red-500 mt-1">Nenhum cargo cadastrado. Vá em Configurações.</p>}
                                </div>
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
                                {formData.status === 'Demitido' && <div><label className="block text-sm font-medium">Data Demissão</label><input type="date" name="demission_date" onChange={handleChange} value={formData.demission_date || ''} className="mt-1 w-full p-2 border rounded-md" /></div>}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium"><FontAwesomeIcon icon={faClock} className="mr-1"/> Jornada</label>
                                    <select name="jornada_id" value={formData.jornada_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                        <option value="">Selecione...</option>
                                        {auxData?.jornadas.map(j => <option key={j.id} value={j.id}>{j.nome_jornada} ({j.carga_horaria_semanal}h)</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-sm font-medium">Nº Ponto</label><input type="number" name="numero_ponto" onChange={handleChange} value={formData.numero_ponto || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold">Financeiro</h2>
                                    {isEditing && <button type="button" onClick={() => setIsModalSalarialOpen(true)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 border border-green-200 font-bold"><FontAwesomeIcon icon={faDollarSign} className="mr-1"/> Alterar Salário</button>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {!isEditing ? (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium">Salário Base</label>
                                                {/* CORREÇÃO AQUI: Máscara correta para o form de cadastro */}
                                                <IMaskInput 
                                                    mask="R$ num" 
                                                    blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true, normalizeZeros: true }}} 
                                                    unmask={true} 
                                                    onAccept={(v) => handleMaskedChange('salario_base', v)} 
                                                    value={String(formData.salario_base || '')} 
                                                    className="mt-1 w-full p-2 border rounded-md"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium">Valor Diária</label>
                                                {/* CORREÇÃO AQUI: Máscara correta para o form de cadastro */}
                                                <IMaskInput 
                                                    mask="R$ num" 
                                                    blocks={{ num: { mask: Number, thousandsSeparator: '.', radix: ',', scale: 2, padFractionalZeros: true, normalizeZeros: true }}} 
                                                    unmask={true} 
                                                    onAccept={(v) => handleMaskedChange('valor_diaria', v)} 
                                                    value={String(formData.valor_diaria || '')} 
                                                    className="mt-1 w-full p-2 border rounded-md"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="md:col-span-2 flex gap-4 text-sm bg-gray-50 p-3 rounded border">
                                            <div><span className="text-gray-500">Salário:</span> <span className="font-bold ml-1">{formatCurrency(salarioAtual.salario_base)}</span></div>
                                            <div><span className="text-gray-500">Diária:</span> <span className="font-bold ml-1">{formatCurrency(salarioAtual.valor_diaria)}</span></div>
                                        </div>
                                    )}
                                    <div><label className="block text-sm font-medium">Pagamento via</label><input name="payment_method" onChange={handleChange} value={formData.payment_method || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="block text-sm font-medium">Chave PIX</label><input name="pix_key" onChange={handleChange} value={formData.pix_key || ''} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div className="md:col-span-2"><label className="block text-sm font-medium">Dados Bancários</label><textarea name="bank_details" onChange={handleChange} value={formData.bank_details || ''} rows="2" className="mt-1 w-full p-2 border rounded-md"></textarea></div>
                                </div>
                            </div>

                            <fieldset className="border-t border-gray-200 pt-4">
                                <h2 className="text-lg font-semibold text-gray-800 mb-2">Endereço</h2>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                    <div className="md:col-span-2"><label className="block text-sm font-medium">CEP</label><IMaskInput mask="00000-000" name="cep" value={formData.cep || ''} onAccept={(v) => handleMaskedChange('cep', v)} onBlur={(e) => handleCepBlur(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                                    <div className="md:col-span-4"><label className="block text-sm font-medium">Logradouro</label><input name="address_street" value={formData.address_street || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div className="md:col-span-1"><label className="block text-sm font-medium">Número</label><input name="address_number" value={formData.address_number || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div className="md:col-span-2"><label className="block text-sm font-medium">Complemento</label><input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div className="md:col-span-3"><label className="block text-sm font-medium">Bairro</label><input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div className="md:col-span-4"><label className="block text-sm font-medium">Cidade</label><input name="city" value={formData.city || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div className="md:col-span-2"><label className="block text-sm font-medium">UF</label><input name="state" value={formData.state || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                                </div>
                            </fieldset>

                            <fieldset className="border-t border-gray-200 pt-4">
                                <label className="block text-sm font-medium">Observações</label>
                                <textarea name="observations" onChange={handleChange} value={formData.observations || ''} rows="3" className="mt-1 w-full p-2 border rounded-md"></textarea>
                            </fieldset>

                            <button type="submit" className="hidden"></button>
                        </form>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 font-medium">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 font-semibold flex items-center"
                        disabled={isUploading || isLoadingAux}
                    >
                        {isUploading ? <><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Salvando...</> : (isEditing ? 'Salvar Alterações' : 'Cadastrar')}
                    </button>
                </div>
            </div>
        </div>
    );
}