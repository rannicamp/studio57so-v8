"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSave, faBuilding, faRulerCombined, faFilePdf, faFileImage, faBullhorn } from '@fortawesome/free-solid-svg-icons';

// Componente para uma Aba de Navegação
const TabButton = ({ label, icon, isActive, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
            isActive
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
    >
        <FontAwesomeIcon icon={icon} />
        {label}
    </button>
);

// Componente para um Campo de Formulário
const InputField = ({ label, name, value, onChange, placeholder, required = false }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type="text"
            id={name}
            name={name}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
    </div>
);

// Componente para a Secção de Acabamentos
const AcabamentosSection = ({ acabamentos, setAcabamentos }) => {
    const handleAddAcabamento = () => {
        setAcabamentos([...acabamentos, { ambiente: '', tipo: '', descricao: '' }]);
    };

    const handleAcabamentoChange = (index, field, value) => {
        const newAcabamentos = [...acabamentos];
        newAcabamentos[index][field] = value;
        setAcabamentos(newAcabamentos);
    };
    
    const handleRemoveAcabamento = (index) => {
        const newAcabamentos = acabamentos.filter((_, i) => i !== index);
        setAcabamentos(newAcabamentos);
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="text-lg font-semibold text-gray-800">Acabamentos por Ambiente</h4>
            {acabamentos.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 border rounded-md bg-white">
                    <InputField label="Ambiente" name={`ambiente-${index}`} value={item.ambiente} onChange={(e) => handleAcabamentoChange(index, 'ambiente', e.target.value)} placeholder="Ex: Sala/Cozinha" />
                    <InputField label="Tipo de Acabamento" name={`tipo-${index}`} value={item.tipo} onChange={(e) => handleAcabamentoChange(index, 'tipo', e.target.value)} placeholder="Ex: Piso, Pintura, Bancada" />
                    <InputField label="Descrição Detalhada" name={`descricao-${index}`} value={item.descricao} onChange={(e) => handleAcabamentoChange(index, 'descricao', e.target.value)} placeholder="Ex: Porcelanato Oxford Grigio 60x60cm" />
                    <div className="flex items-end">
                        <button type="button" onClick={() => handleRemoveAcabamento(index)} className="bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 text-sm">Remover</button>
                    </div>
                </div>
            ))}
            <button type="button" onClick={handleAddAcabamento} className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">+ Adicionar Acabamento</button>
        </div>
    );
};

// Componente para a Secção de Unidades Tipo
const UnidadesTipoSection = ({ unidades, setUnidades }) => {
    const handleAddUnidade = () => {
        setUnidades([...unidades, { tipologia: '', area_privativa: '', area_comum: '', area_total: '', fracao_ideal: '' }]);
    };

    const handleUnidadeChange = (index, field, value) => {
        const newUnidades = [...unidades];
        newUnidades[index][field] = value;
        setUnidades(newUnidades);
    };

    const handleRemoveUnidade = (index) => {
        const newUnidades = unidades.filter((_, i) => i !== index);
        setUnidades(newUnidades);
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="text-lg font-semibold text-gray-800">Detalhes das Unidades Tipo</h4>
            {unidades.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-3 border rounded-md bg-white">
                    <div className="md:col-span-2">
                        <InputField label="Tipologia" name={`tipologia-${index}`} value={item.tipologia} onChange={(e) => handleUnidadeChange(index, 'tipologia', e.target.value)} placeholder="Ex: Aptos 2Q (Final 01 e 02)" />
                    </div>
                    <InputField label="Área Privativa" name={`area_privativa-${index}`} value={item.area_privativa} onChange={(e) => handleUnidadeChange(index, 'area_privativa', e.target.value)} placeholder="Ex: 58,86 m²" />
                    <InputField label="Área Comum" name={`area_comum-${index}`} value={item.area_comum} onChange={(e) => handleUnidadeChange(index, 'area_comum', e.target.value)} placeholder="Ex: 37,11 m²" />
                    <InputField label="Fração Ideal" name={`fracao_ideal-${index}`} value={item.fracao_ideal} onChange={(e) => handleUnidadeChange(index, 'fracao_ideal', e.target.value)} placeholder="Ex: 0,043879" />
                    <div className="flex items-end">
                        <button type="button" onClick={() => handleRemoveUnidade(index)} className="bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 text-sm">Remover</button>
                    </div>
                </div>
            ))}
            <button type="button" onClick={handleAddUnidade} className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">+ Adicionar Unidade</button>
        </div>
    );
};


export default function EmpreendimentoForm({ initialData = null, companies = [] }) {
    const supabase = createClient();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('dadosGerais');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    // Estados para todos os campos do formulário
    const [formData, setFormData] = useState({
        nome: '',
        status: 'Em Planejamento',
        empresa_proprietaria_id: '',
        nome_empreendimento: '',
        matricula_numero: '',
        matricula_cartorio: '',
        terreno_area_total: '',
        incorporadora_nome: '',
        incorporadora_cnpj: '',
        construtora_nome: '',
        construtora_cnpj: '',
        estrutura_tipo: '',
        alvenaria_tipo: '',
        cobertura_detalhes: '',
        prazo_entrega: '',
        indice_reajuste: 'INCC',
        dados_contrato: '',
    });

    const [acabamentos, setAcabamentos] = useState([]);
    const [unidades, setUnidades] = useState([]);

    // Popula o formulário com dados iniciais se estiver a editar
    useEffect(() => {
        if (initialData) {
            setFormData({
                nome: initialData.nome || '',
                status: initialData.status || 'Em Planejamento',
                empresa_proprietaria_id: initialData.empresa_proprietaria_id || '',
                nome_empreendimento: initialData.nome_empreendimento || '',
                matricula_numero: initialData.matricula_numero || '',
                matricula_cartorio: initialData.matricula_cartorio || '',
                terreno_area_total: initialData.terreno_area_total || '',
                incorporadora_nome: initialData.incorporadora_nome || '',
                incorporadora_cnpj: initialData.incorporadora_cnpj || '',
                construtora_nome: initialData.construtora_nome || '',
                construtora_cnpj: initialData.construtora_cnpj || '',
                estrutura_tipo: initialData.estrutura_tipo || '',
                alvenaria_tipo: initialData.alvenaria_tipo || '',
                cobertura_detalhes: initialData.cobertura_detalhes || '',
                prazo_entrega: initialData.prazo_entrega || '',
                indice_reajuste: initialData.indice_reajuste || 'INCC',
                dados_contrato: initialData.dados_contrato || '',
            });
            // Garante que os campos JSON sejam arrays vazios se não existirem
            setAcabamentos(initialData.acabamentos || []);
            setUnidades(initialData.unidades || []);
        }
    }, [initialData]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        // Monta o objeto final com todos os dados, incluindo os JSONs
        const finalData = {
            ...formData,
            acabamentos,
            unidades
        };

        let error;
        if (initialData?.id) {
            // MODO DE EDIÇÃO: Usa o método update()
            const { error: updateError } = await supabase.from('empreendimentos').update(finalData).eq('id', initialData.id);
            error = updateError;
        } else {
            // MODO DE CRIAÇÃO: Usa o método insert()
            const { error: insertError } = await supabase.from('empreendimentos').insert(finalData);
            error = insertError;
        }

        if (error) {
            setMessage(`Erro ao salvar: ${error.message}`);
        } else {
            setMessage('Empreendimento salvo com sucesso!');
            router.push('/empreendimentos');
            router.refresh(); // Força a atualização da lista na página de empreendimentos
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow-md">
            
            {/* Abas de Navegação */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex flex-wrap" aria-label="Tabs">
                    <TabButton label="Dados Gerais" icon={faBuilding} isActive={activeTab === 'dadosGerais'} onClick={() => setActiveTab('dadosGerais')} />
                    <TabButton label="Características" icon={faRulerCombined} isActive={activeTab === 'caracteristicas'} onClick={() => setActiveTab('caracteristicas')} />
                    <TabButton label="Projetos" icon={faFilePdf} isActive={activeTab === 'projetos'} onClick={() => setActiveTab('projetos')} />
                    <TabButton label="Documentos" icon={faFileImage} isActive={activeTab === 'documentos'} onClick={() => setActiveTab('documentos')} />
                    <TabButton label="Marketing" icon={faBullhorn} isActive={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} />
                </nav>
            </div>

            {/* Conteúdo das Abas */}
            <div className="mt-4">
                {activeTab === 'dadosGerais' && (
                    <div className="space-y-6">
                        <div className="p-4 border rounded-lg">
                             <h3 className="text-xl font-semibold mb-4 text-gray-800">Identificação</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Nome do Empreendimento (Oficial)" name="nome_empreendimento" value={formData.nome_empreendimento} onChange={handleFormChange} placeholder="Ex: Condomínio Residencial Alfa" required />
                                <InputField label="Nome de Divulgação / Apelido" name="nome" value={formData.nome} onChange={handleFormChange} placeholder="Ex: Residencial Alfa" required />
                                <div>
                                    <label htmlFor="empresa_proprietaria_id" className="block text-sm font-medium text-gray-700">Empresa Proprietária (SPE)</label>
                                    <select id="empresa_proprietaria_id" name="empresa_proprietaria_id" value={formData.empresa_proprietaria_id} onChange={handleFormChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                                        <option value="">-- Selecione uma empresa --</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                                    </select>
                                </div>
                                 <div>
                                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                                    <select id="status" name="status" value={formData.status} onChange={handleFormChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                                        <option>Em Planejamento</option>
                                        <option>Em Lançamento</option>
                                        <option>Em Obras</option>
                                        <option>Entregue</option>
                                        <option>Cancelado</option>
                                    </select>
                                </div>
                             </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                             <h3 className="text-xl font-semibold mb-4 text-gray-800">Dados da Matrícula do Terreno</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InputField label="Número da Matrícula" name="matricula_numero" value={formData.matricula_numero} onChange={handleFormChange} placeholder="Ex: 24.920" />
                                <InputField label="Cartório de Registo" name="matricula_cartorio" value={formData.matricula_cartorio} onChange={handleFormChange} placeholder="Ex: 2º Serviço Registral Imobiliário..." />
                                <InputField label="Área Total do Terreno (m²)" name="terreno_area_total" value={formData.terreno_area_total} onChange={handleFormChange} placeholder="Ex: 579,77" />
                             </div>
                        </div>
                        
                        <div className="p-4 border rounded-lg">
                             <h3 className="text-xl font-semibold mb-4 text-gray-800">Empresas Responsáveis</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Incorporadora (Nome)" name="incorporadora_nome" value={formData.incorporadora_nome} onChange={handleFormChange} placeholder="Ex: PRIMEIRA INCORPORAÇÃO LTDA" />
                                <InputField label="Incorporadora (CNPJ)" name="incorporadora_cnpj" value={formData.incorporadora_cnpj} onChange={handleFormChange} placeholder="00.000.000/0001-00" />
                                <InputField label="Construtora (Nome)" name="construtora_nome" value={formData.construtora_nome} onChange={handleFormChange} placeholder="Ex: ARKOS CONSTRUÇÕES LTDA" />
                                <InputField label="Construtora (CNPJ)" name="construtora_cnpj" value={formData.construtora_cnpj} onChange={handleFormChange} placeholder="00.000.000/0001-00" />
                             </div>
                        </div>

                    </div>
                )}
                
                {activeTab === 'caracteristicas' && (
                    <div className="space-y-6">
                        <div className="p-4 border rounded-lg">
                             <h3 className="text-xl font-semibold mb-4 text-gray-800">Dados Técnicos</h3>
                             <div className="space-y-4">
                                <InputField label="Estrutura" name="estrutura_tipo" value={formData.estrutura_tipo} onChange={handleFormChange} placeholder="Ex: Convencional em betão armado, laje nervurada 35cm" />
                                <InputField label="Alvenaria" name="alvenaria_tipo" value={formData.alvenaria_tipo} onChange={handleFormChange} placeholder="Ex: Bloco cerâmico furado 9x19x39cm" />
                                <InputField label="Cobertura" name="cobertura_detalhes" value={formData.cobertura_detalhes} onChange={handleFormChange} placeholder="Ex: Laje nervurada, impermeabilizada com manta asfáltica" />
                             </div>
                        </div>
                        
                        <AcabamentosSection acabamentos={acabamentos} setAcabamentos={setAcabamentos} />
                        <UnidadesTipoSection unidades={unidades} setUnidades={setUnidades} />

                    </div>
                )}
                
                {activeTab === 'projetos' && <div className="text-center p-10 bg-gray-50 rounded-lg">Funcionalidade de Upload de Projetos em desenvolvimento.</div>}
                {activeTab === 'documentos' && <div className="text-center p-10 bg-gray-50 rounded-lg">Funcionalidade de Upload de Documentos em desenvolvimento.</div>}

                {activeTab === 'marketing' && (
                     <div className="space-y-6">
                        <div className="p-4 border rounded-lg">
                             <h3 className="text-xl font-semibold mb-4 text-gray-800">Informações de Venda</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Prazo de Entrega da Obra" name="prazo_entrega" value={formData.prazo_entrega} onChange={handleFormChange} placeholder="Ex: 31/12/2026" />
                                <InputField label="Índice de Reajuste de Prestações" name="indice_reajuste" value={formData.indice_reajuste} onChange={handleFormChange} placeholder="Ex: INCC" />
                             </div>
                             <div className="mt-6">
                                 <label htmlFor="dados_contrato" className="block text-sm font-medium text-gray-700">Dados da Vendedora para Contrato</label>
                                 <textarea
                                    id="dados_contrato"
                                    name="dados_contrato"
                                    rows="4"
                                    value={formData.dados_contrato}
                                    onChange={handleFormChange}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="Cole aqui os dados completos da vendedora (nome, CNPJ, endereço, representante legal) para preenchimento rápido de contratos."
                                 ></textarea>
                             </div>
                        </div>
                        <div className="text-center p-10 bg-gray-50 rounded-lg">
                            Funcionalidade de Tabela de Preços e Uploads de Marketing em desenvolvimento.
                        </div>
                    </div>
                )}

            </div>

            {/* Botão de Salvar */}
            <div className="flex justify-end pt-4 border-t">
                <button type="submit" disabled={loading} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                    {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                    {loading ? 'A guardar...' : 'Guardar Empreendimento'}
                </button>
            </div>

            {message && <p className="text-center mt-4 font-semibold text-blue-600">{message}</p>}

        </form>
    );
}
