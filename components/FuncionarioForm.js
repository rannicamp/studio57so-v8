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

// Componente para o modal de alteração de salário
const HistoricoSalarialModal = ({ isOpen, onClose, onSave, funcionarioId, organizacaoId }) => {
    const supabase = createClient();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [novoHistorico, setNovoHistorico] = useState({
        data_inicio_vigencia: new Date().toISOString().split('T')[0],
        salario_base: '',
        valor_diaria: '',
        motivo_alteracao: ''
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNovoHistorico(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!novoHistorico.data_inicio_vigencia || (!novoHistorico.salario_base && !novoHistorico.valor_diaria)) {
            toast.error("A data de início e pelo menos um dos valores (salário ou diária) são obrigatórios.");
            return;
        }
        setLoading(true);
        await onSave({
            ...novoHistorico,
            funcionario_id: funcionarioId,
            criado_por_usuario_id: user.id,
            organizacao_id: organizacaoId // Garante a organização
        });
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-4">Registrar Alteração Salarial</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Data de Início da Vigência *</label>
                        <input type="date" name="data_inicio_vigencia" value={novoHistorico.data_inicio_vigencia} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Novo Salário Base</label>
                            <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} unmask={true} onAccept={(value) => setNovoHistorico(prev => ({...prev, salario_base: value}))} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Novo Valor Diária</label>
                            <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} unmask={true} onAccept={(value) => setNovoHistorico(prev => ({...prev, valor_diaria: value}))} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Motivo da Alteração *</label>
                        <input type="text" name="motivo_alteracao" value={novoHistorico.motivo_alteracao} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Dissídio, Promoção"/>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Alteração'}
                    </button>
                </div>
            </div>
        </div>
    );
};


export default function FuncionarioForm({ companies, empreendimentos, initialData, jornadas }) {
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
        salario_base: '',
        valor_diaria: '',
    });
    
    const [formData, setFormData] = useState(initialData || getInitialState());
    const [newPhotoFile, setNewPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(initialData?.foto_url || null);
    const [isUploading, setIsUploading] = useState(false);
    const [isModalSalarialOpen, setIsModalSalarialOpen] = useState(false);
    
    const [salarioAtual, setSalarioAtual] = useState({ salario_base: null, valor_diaria: null });

    useEffect(() => {
        const fetchRelatedData = async () => {
            if (initialData?.id) {
                if (initialData.foto_url) {
                    const { data } = supabase.storage.from('funcionarios-documentos').getPublicUrl(initialData.foto_url);
                    setPhotoPreview(data?.publicUrl);
                }
                
                const { data, error } = await supabase
                    .from('historico_salarial')
                    .select('salario_base, valor_diaria')
                    .eq('funcionario_id', initialData.id)
                    .order('data_inicio_vigencia', { ascending: false })
                    .limit(1)
                    .single();
                
                if (!error && data) {
                    setSalarioAtual(data);
                }
            }
        };

        if (isEditing) {
            setFormData(initialData);
            fetchRelatedData();
        }
    }, [initialData, supabase, isEditing]);


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
            toast.info(`Arquivo "${file.name}" selecionado. Clique em Salvar para confirmar.`);
        }
    };
    
    const handleSaveHistoricoSalarial = async (novoHistorico) => {
        const { error } = await supabase.from('historico_salarial').insert(novoHistorico);

        if (error) {
            toast.error(`Erro ao registrar alteração: ${error.message}`);
        } else {
            toast.success("Histórico salarial atualizado com sucesso!");
            setSalarioAtual({
                salario_base: novoHistorico.salario_base,
                valor_diaria: novoHistorico.valor_diaria
            });
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsUploading(true);
    
        const promise = new Promise(async (resolve, reject) => {
            const orgId = user?.organizacao_id;
            if (!orgId) {
                return reject(new Error("Não foi possível identificar a organização do usuário."));
            }

            let finalFotoPath = formData.foto_url;
            let finalContatoId = formData.contato_id;
    
            if (formData.cpf) {
                const contatoData = {
                    nome: formData.full_name, cpf: formData.cpf, personalidade_juridica: 'Pessoa Física',
                    tipo_contato: 'Fornecedor', organizacao_id: orgId
                };
                const { data: existingContact } = await supabase.from('contatos').select('id').eq('cpf', formData.cpf).eq('organizacao_id', orgId).single();
    
                if (existingContact) {
                    finalContatoId = existingContact.id;
                } else {
                    const { data: newContact, error: contactError } = await supabase.from('contatos').insert(contatoData).select('id').single();
                    if (contactError) return reject(new Error(`Erro ao criar 'Contato': ${contactError.message}`));
                    finalContatoId = newContact.id;
                    if (formData.email) await supabase.from('emails').insert({ contato_id: finalContatoId, email: formData.email, tipo: 'Principal', organizacao_id: orgId });
                    if (formData.phone) await supabase.from('telefones').insert({ contato_id: finalContatoId, telefone: formData.phone.replace(/\D/g, ''), tipo: 'Celular', organizacao_id: orgId });
                }
            }
    
            if (newPhotoFile) {
                const fileExtension = newPhotoFile.name.split('.').pop();
                const employeeIdForPath = formData.id || 'novo_funcionario';
                const filePath = `${orgId}/documentos/${employeeIdForPath}/foto_perfil_${Date.now()}.${fileExtension}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('funcionarios-documentos').upload(filePath, newPhotoFile, { upsert: true });
                if (uploadError) return reject(new Error(`Erro no upload da foto: ${uploadError.message}`));
                finalFotoPath = uploadData.path;
            }
            
            const dataToSave = { ...formData };
            if (dataToSave.birth_date === '') dataToSave.birth_date = null;
            if (dataToSave.admission_date === '') dataToSave.admission_date = null;
            if (dataToSave.demission_date === '') dataToSave.demission_date = null;
            
            const { id, created_at, cadastro_empresa, empreendimentos, documentos_funcionarios, salario_base, valor_diaria, ...dbData } = {
                ...dataToSave,
                foto_url: finalFotoPath,
                contato_id: finalContatoId,
                organizacao_id: isEditing ? formData.organizacao_id : orgId
            };
    
            if (isEditing) {
                const { error } = await supabase.from('funcionarios').update(dbData).eq('id', id);
                if (error) return reject(error);
                resolve({ funcionarioId: id });
            } else {
                const { data: newFuncionario, error } = await supabase.from('funcionarios').insert([dbData]).select().single();
                if (error) return reject(error);

                if (newFuncionario && (formData.salario_base || formData.valor_diaria)) {
                    const { error: histError } = await supabase.from('historico_salarial').insert({
                        funcionario_id: newFuncionario.id,
                        data_inicio_vigencia: formData.admission_date,
                        salario_base: parseFloat(String(formData.salario_base || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || null,
                        valor_diaria: parseFloat(String(formData.valor_diaria || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || null,
                        motivo_alteracao: 'Salário inicial de contratação',
                        criado_por_usuario_id: user.id,
                        organizacao_id: orgId
                    });
                    if (histError) {
                        toast.error(`Funcionário criado, mas falha ao salvar histórico salarial: ${histError.message}`);
                    }
                }
                resolve({ funcionarioId: newFuncionario.id });
            }
        });
    
        toast.promise(promise, {
            loading: 'Salvando funcionário...',
            success: () => {
                setTimeout(() => {
                    // MUDANÇA IMPORTANTE AQUI: O caminho foi alterado conforme sua solicitação.
                    router.push('/funcionario');
                    router.refresh();
                }, 1500);
                setIsUploading(false);
                return `Funcionário ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`;
            },
            error: (err) => {
                setIsUploading(false);
                return `Erro ao salvar: ${err.message}`;
            },
        });
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
        
        toast.promise(promise, {
            loading: 'Buscando CEP...',
            success: (msg) => msg,
            error: (err) => err.message,
        });
    };

    const formatCurrency = (value) => value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'Não definido';

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <HistoricoSalarialModal 
                isOpen={isModalSalarialOpen}
                onClose={() => setIsModalSalarialOpen(false)}
                onSave={handleSaveHistoricoSalarial}
                funcionarioId={formData.id}
                organizacaoId={formData.organizacao_id}
            />

            <h1 className="text-3xl font-bold mb-6 text-gray-900">{isEditing ? `Editando Funcionário: ${initialData?.full_name || ''}` : 'Cadastro de Novo Funcionário'}</h1>

            <form onSubmit={handleSubmit} className="space-y-8">
                <fieldset className="border-t border-gray-900/10 pt-8">
                    <h2 className="text-xl font-semibold text-gray-800">Foto de Perfil</h2>
                    <div className="mt-6 flex items-center gap-4">
                        {photoPreview ? <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" /> : <FontAwesomeIcon icon={faUserCircle} className="w-24 h-24 text-gray-300" />}
                        <input type="file" id="photo-upload" accept="image/*" onChange={handlePhotoChange} disabled={isUploading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/>
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
                
                <fieldset className="border-t border-gray-900/10 pt-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-800">Informações Financeiras</h2>
                        {isEditing && (
                            <button type="button" onClick={() => setIsModalSalarialOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-semibold">
                                <FontAwesomeIcon icon={faDollarSign} className="mr-2"/>
                                Alterar Salário / Diária
                            </button>
                        )}
                    </div>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {!isEditing ? (
                            <>
                                <div>
                                    <label className="block text-sm font-medium">Salário Base Inicial</label>
                                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} unmask={true} onAccept={(v) => handleMaskedChange('salario_base', v)} value={formData.salario_base || ''} className="mt-1 w-full p-2 border rounded-md"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Valor Diária Inicial</label>
                                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}} unmask={true} onAccept={(v) => handleMaskedChange('valor_diaria', v)} value={formData.valor_diaria || ''} className="mt-1 w-full p-2 border rounded-md"/>
                                </div>
                            </>
                        ) : (
                            <>
                                 <div className="p-4 bg-gray-50 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-500">Salário Base Atual</label>
                                    <p className="text-lg font-bold text-gray-800">{formatCurrency(salarioAtual.salario_base)}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-500">Valor Diária Atual</label>
                                    <p className="text-lg font-bold text-gray-800">{formatCurrency(salarioAtual.valor_diaria)}</p>
                                </div>
                            </>
                        )}
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
                    <div className="mt-6">
                        <label className="block text-sm font-medium">Observações</label>
                        <textarea name="observations" onChange={handleChange} value={formData.observations || ''} rows="4" className="mt-1 w-full p-2 border rounded-md"></textarea>
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