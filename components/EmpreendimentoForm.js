"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSave, faBuilding, faRulerCombined, faFilePdf, faFileImage, faBullhorn } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

// --- Componentes Internos ---
const TabButton = ({ label, icon, isActive, onClick }) => (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
        <FontAwesomeIcon icon={icon} /> {label}
    </button>
);

const InputField = ({ label, name, value, onChange, placeholder, required = false, readOnly = false }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input type="text" id={name} name={name} value={value || ''} onChange={onChange} placeholder={placeholder} required={required} readOnly={readOnly} className={`mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${readOnly ? 'bg-gray-100' : ''}`} />
    </div>
);

// Seções de Acabamentos e Unidades (ocultadas para simplicidade)
const AcabamentosSection = ({ acabamentos, setAcabamentos }) => { return null; };
const UnidadesTipoSection = ({ unidades, setUnidades }) => { return null; };

// --- Componente Principal ---
export default function EmpreendimentoForm({ initialData = null, companies = [] }) {
    const supabase = createClient();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('dadosGerais');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    const [formData, setFormData] = useState({
        nome_empreendimento: '',
        status: 'Em Planejamento',
        empresa_proprietaria_id: '',
        matricula_numero: '',
        matricula_cartorio: '',
        terreno_area_total: '',
        incorporadora_nome: '',
        incorporadora_cnpj: '',
        construtora_nome: '',
        construtora_cnpj: '',
        cep: '',
        address_street: '',
        address_number: '',
        address_complement: '',
        neighborhood: '',
        city: '',
        state: '',
    });

    // ***** INÍCIO DA CORREÇÃO *****
    // Readicionando os estados que foram removidos por engano
    const [acabamentos, setAcabamentos] = useState([]);
    const [unidades, setUnidades] = useState([]);
    // ***** FIM DA CORREÇÃO *****

    // Estados para guardar o ID da empresa selecionada para incorporadora e construtora
    const [selectedIncorporadoraId, setSelectedIncorporadoraId] = useState('');
    const [selectedConstrutoraId, setSelectedConstrutoraId] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));
            
            const incorporadora = companies.find(c => c.nome_fantasia === initialData.incorporadora_nome);
            if (incorporadora) setSelectedIncorporadoraId(incorporadora.id);

            const construtora = companies.find(c => c.nome_fantasia === initialData.construtora_nome);
            if (construtora) setSelectedConstrutoraId(construtora.id);
            
            setAcabamentos(initialData.acabamentos || []);
            setUnidades(initialData.unidades || []);
        }
    }, [initialData, companies]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMaskedChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCepBlur = async (cep) => {
        const cepLimpo = cep?.replace(/\D/g, '');
        if (cepLimpo?.length !== 8) return;

        setMessage('Buscando CEP...');
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            if (!response.ok) throw new Error('CEP não encontrado');
            const data = await response.json();
            if (data.erro) throw new Error('CEP inválido.');
            
            setFormData(prev => ({
                ...prev,
                address_street: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                state: data.uf,
            }));
            setMessage('Endereço preenchido!');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    const handleCompanySelection = (role, companyId) => {
        const selectedCompany = companies.find(c => c.id === companyId);
        
        if (role === 'incorporadora') {
            setSelectedIncorporadoraId(companyId);
            setFormData(prev => ({
                ...prev,
                incorporadora_nome: selectedCompany ? selectedCompany.nome_fantasia : '',
                incorporadora_cnpj: selectedCompany ? selectedCompany.cnpj : ''
            }));
        } else if (role === 'construtora') {
            setSelectedConstrutoraId(companyId);
            setFormData(prev => ({
                ...prev,
                construtora_nome: selectedCompany ? selectedCompany.nome_fantasia : '',
                construtora_cnpj: selectedCompany ? selectedCompany.cnpj : ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Lógica de submit continua aqui...
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow-md">
            
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex flex-wrap" aria-label="Tabs">
                    <TabButton label="Dados Gerais" icon={faBuilding} isActive={activeTab === 'dadosGerais'} onClick={() => setActiveTab('dadosGerais')} />
                    <TabButton label="Características" icon={faRulerCombined} isActive={activeTab === 'caracteristicas'} onClick={() => setActiveTab('caracteristicas')} />
                    <TabButton label="Projetos" icon={faFilePdf} isActive={activeTab === 'projetos'} onClick={() => setActiveTab('projetos')} />
                    <TabButton label="Documentos" icon={faFileImage} isActive={activeTab === 'documentos'} onClick={() => setActiveTab('documentos')} />
                    <TabButton label="Marketing" icon={faBullhorn} isActive={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} />
                </nav>
            </div>

            {message && <p className={`text-center p-2 rounded-md ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-800'}`}>{message}</p>}

            <div className="mt-4">
                {activeTab === 'dadosGerais' && (
                    <div className="space-y-6">
                        
                        {/* Seção de Identificação */}
                        <div className="p-4 border rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-gray-800">Identificação</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Nome do Empreendimento" name="nome_empreendimento" value={formData.nome_empreendimento} onChange={handleFormChange} required />
                                <div>
                                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                                    <select id="status" name="status" value={formData.status} onChange={handleFormChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                        <option>Em Planejamento</option>
                                        <option>Em Obras</option>
                                        <option>Concluído</option>
                                        <option>Vendido</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="empresa_proprietaria_id" className="block text-sm font-medium text-gray-700">Empresa Proprietária</label>
                                    <select id="empresa_proprietaria_id" name="empresa_proprietaria_id" value={formData.empresa_proprietaria_id} onChange={handleFormChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                        <option value="">Selecione uma empresa</option>
                                        {companies.map(company => (
                                            <option key={company.id} value={company.id}>{company.nome_fantasia}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* Seção de Endereço */}
                        <div className="p-4 border rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-gray-800">Endereço do Empreendimento</h3>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium">CEP</label>
                                    <IMaskInput mask="00000-000" name="cep" value={formData.cep || ''} onAccept={(value) => handleMaskedChange('cep', value)} onBlur={(e) => handleCepBlur(e.target.value)} className="mt-1 w-full p-2 border rounded-md" placeholder="00000-000" />
                                </div>
                                <div className="md:col-span-4"><InputField label="Rua / Logradouro" name="address_street" value={formData.address_street} onChange={handleFormChange} /></div>
                                <div className="md:col-span-1"><InputField label="Número" name="address_number" value={formData.address_number} onChange={handleFormChange} /></div>
                                <div className="md:col-span-2"><InputField label="Complemento" name="address_complement" value={formData.address_complement} onChange={handleFormChange} /></div>
                                <div className="md:col-span-3"><InputField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleFormChange} /></div>
                                <div className="md:col-span-4"><InputField label="Cidade" name="city" value={formData.city} onChange={handleFormChange} /></div>
                                <div className="md:col-span-2"><InputField label="Estado (UF)" name="state" value={formData.state} onChange={handleFormChange} /></div>
                            </div>
                        </div>

                        {/* Seção de Dados da Matrícula */}
                        <div className="p-4 border rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-gray-800">Dados da Matrícula do Terreno</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InputField label="Número da Matrícula" name="matricula_numero" value={formData.matricula_numero} onChange={handleFormChange} />
                                <InputField label="Cartório de Registro" name="matricula_cartorio" value={formData.matricula_cartorio} onChange={handleFormChange} />
                                <InputField label="Área Total do Terreno (m²)" name="terreno_area_total" value={formData.terreno_area_total} onChange={handleFormChange} />
                            </div>
                        </div>
                        
                        {/* Seção de Empresas Responsáveis Modificada */}
                        <div className="p-4 border rounded-lg">
                             <h3 className="text-xl font-semibold mb-4 text-gray-800">Empresas Responsáveis</h3>
                             <div className="space-y-4">
                                {/* Incorporadora */}
                                <div className="p-3 border rounded-md">
                                    <p className="text-md font-semibold text-gray-600 mb-3">Incorporadora</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Selecione a Incorporadora</label>
                                            <select value={selectedIncorporadoraId} onChange={(e) => handleCompanySelection('incorporadora', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                                <option value="">Selecione ou deixe em branco</option>
                                                {companies.map(company => (
                                                    <option key={company.id} value={company.id}>{company.nome_fantasia}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <InputField label="CNPJ da Incorporadora" name="incorporadora_cnpj" value={formData.incorporadora_cnpj} onChange={() => {}} readOnly={true} />
                                        </div>
                                    </div>
                                </div>
                                {/* Construtora */}
                                <div className="p-3 border rounded-md">
                                    <p className="text-md font-semibold text-gray-600 mb-3">Construtora</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                         <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Selecione a Construtora</label>
                                            <select value={selectedConstrutoraId} onChange={(e) => handleCompanySelection('construtora', e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                                <option value="">Selecione ou deixe em branco</option>
                                                {companies.map(company => (
                                                    <option key={company.id} value={company.id}>{company.nome_fantasia}</option>
                                                ))}
                                            </select>
                                         </div>
                                         <div>
                                            <InputField label="CNPJ da Construtora" name="construtora_cnpj" value={formData.construtora_cnpj} onChange={() => {}} readOnly={true} />
                                         </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                )}
                
                 {/* Exibição das outras seções (abas) */}
                {activeTab === 'caracteristicas' && (
                    <AcabamentosSection acabamentos={acabamentos} setAcabamentos={setAcabamentos} />
                )}
                 {/* Adicione a renderização para a seção de Unidades se necessário */}

            </div>

            <div className="flex justify-end pt-4 border-t">
                <button type="submit" disabled={loading} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                    {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                    {loading ? 'A guardar...' : 'Guardar Empreendimento'}
                </button>
            </div>
        </form>
    );
}