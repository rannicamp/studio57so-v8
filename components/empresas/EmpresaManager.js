"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faPlus, faSearch, faInfoCircle, faPen, faTrash,
    faFileContract, faMapMarkerAlt, faPhone, faEnvelope, faHashtag
} from '@fortawesome/free-solid-svg-icons';
import EmpresaFormModal from './EmpresaFormModal';
import EmpresaAnexosTab from './EmpresaAnexosTab';
import { toast } from 'sonner';

export default function EmpresaManager({ initialEmpresas }) {
    const { user } = useAuth();
    const supabase = createClient();
    const queryClient = useQueryClient();

    const [empresas, setEmpresas] = useState(initialEmpresas || []);
    const [selectedEmpresaId, setSelectedEmpresaId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [empresaToEdit, setEmpresaToEdit] = useState(null);
    const [activeTab, setActiveTab] = useState('ficha');

    const tabs = [
        { id: 'ficha', label: 'Ficha da Empresa' },
        { id: 'contabil', label: 'Documentos Contábeis' },
        { id: 'juridico', label: 'Documentos Jurídicos' },
        { id: 'marketing', label: 'Marketing' },
    ];

    // Permissões
    const isAdmin = ['Proprietário', 'Administrador'].includes(user?.userData?.funcao?.nome_funcao);

    // Filtra as empresas pelo termo de busca
    const filteredEmpresas = useMemo(() => {
        if (!searchTerm) return empresas;
        const lowerTerm = searchTerm.toLowerCase();
        return empresas.filter(e =>
            e.razao_social?.toLowerCase().includes(lowerTerm) ||
            e.nome_fantasia?.toLowerCase().includes(lowerTerm) ||
            e.cnpj?.includes(lowerTerm)
        );
    }, [empresas, searchTerm]);

    const selectedEmpresa = useMemo(() => {
        return empresas.find(e => e.id === selectedEmpresaId) || null;
    }, [empresas, selectedEmpresaId]);

    // Ao salvar/editar no modal, a gente atualiza a lista local sem forçar reload de página
    const handleCloseModal = (savedData = null) => {
        if (savedData) {
            setEmpresas(prev => {
                const exists = prev.find(e => e.id === savedData.id);
                if (exists) {
                    return prev.map(e => e.id === savedData.id ? savedData : e);
                } else {
                    return [...prev, savedData].sort((a, b) => a.razao_social.localeCompare(b.razao_social));
                }
            });
            setSelectedEmpresaId(savedData.id); // Foca na nova/editada
        }
        setIsFormModalOpen(false);
        setEmpresaToEdit(null);
    };

    const handleOpenEdit = () => {
        if (selectedEmpresa) {
            setEmpresaToEdit(selectedEmpresa);
            setIsFormModalOpen(true);
        }
    };

    const handleOpenCreate = () => {
        setEmpresaToEdit(null);
        setIsFormModalOpen(true);
    };

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('cadastro_empresa').delete().eq('id', id).throwOnError();
        },
        onSuccess: (_, id) => {
            toast.success('Empresa excluída com sucesso!');
            setEmpresas(prev => prev.filter(e => e.id !== id));
            if (selectedEmpresaId === id) setSelectedEmpresaId(null);
            queryClient.invalidateQueries(['empresas']); // Opcional
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: A empresa pode já estar atrelada a Empreendimentos ou Contratos.`);
            console.error(error);
        }
    });

    const handleDelete = () => {
        if (!selectedEmpresa) return;
        toast("Confirmar exclusão", {
            description: `Excluir definitivamente a empresa "${selectedEmpresa.razao_social}"?`,
            action: { label: "Excluir", onClick: () => deleteMutation.mutate(selectedEmpresa.id) },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const formatCurrency = (val) => {
        if (val == null || val === '') return 'Não informado';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50 rounded-xl shadow-inner border border-gray-200 animate-fade-in">

            {/* Modal de Formulário */}
            <EmpresaFormModal
                isOpen={isFormModalOpen}
                onClose={handleCloseModal}
                initialData={empresaToEdit}
            />

            {/* PAINEL ESQUERDO: LISTA (MASTER) */}
            <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-gray-200 bg-white flex flex-col h-full shadow-sm z-10">

                {/* Cabeçalho da Lista */}
                <div className="p-5 border-b border-gray-100 space-y-4 shrink-0 bg-white">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold tracking-tight text-gray-900">Empresas</h2>
                        <button
                            onClick={handleOpenCreate}
                            className="bg-[#ff6700] hover:bg-[#e65c00] text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 hover:shadow-md active:scale-95"
                        >
                            <FontAwesomeIcon icon={faPlus} /> Nova
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nome, razão ou CNPJ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 block w-full rounded-xl border-gray-300 bg-gray-50 focus:border-[#ff6700] focus:ring-[#ff6700] focus:bg-white text-sm py-2.5 transition-colors shadow-sm"
                        />
                    </div>
                </div>

                {/* Lista Scrollável */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
                    {filteredEmpresas.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-3">
                            <FontAwesomeIcon icon={faBuilding} className="text-4xl opacity-50" />
                            <p className="text-sm font-medium">Nenhuma empresa encontrada.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100 p-2 space-y-1">
                            {filteredEmpresas.map(empresa => {
                                const isSelected = selectedEmpresaId === empresa.id;
                                // Iniciais para avatar fake
                                const initials = (empresa.nome_fantasia || empresa.razao_social || 'E').substring(0, 2).toUpperCase();

                                return (
                                    <li key={empresa.id}>
                                        <button
                                            onClick={() => setSelectedEmpresaId(empresa.id)}
                                            className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex gap-3 items-center
                                                ${isSelected
                                                    ? 'bg-[#ff6700]/10 border border-[#ff6700]/30 shadow-sm ring-1 ring-[#ff6700]/50'
                                                    : 'bg-white border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors
                                                ${isSelected ? 'bg-[#ff6700] text-white shadow-inner' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
                                                {initials}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-[#ff6700]' : 'text-gray-900'}`}>
                                                    {empresa.nome_fantasia || empresa.razao_social}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                                    {empresa.cnpj || 'Sem CNPJ'}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* PAINEL DIREITO: DETALHES (DETAIL) */}
            <div className="flex-1 bg-white overflow-y-auto custom-scrollbar relative">
                {!selectedEmpresa ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 space-y-4">
                        <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center shadow-inner mb-2">
                            <FontAwesomeIcon icon={faBuilding} className="text-5xl text-gray-300" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-600">Nenhuma empresa selecionada</h3>
                        <p className="text-sm max-w-sm text-center">
                            Selecione uma empresa na lista ao lado para visualizar e editar sua ficha cadastral completa e informações legais.
                        </p>
                    </div>
                ) : (
                    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto animate-fade-in-up">

                        {/* Detail Header Action Bar */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-100 pb-6">
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                                    {selectedEmpresa.razao_social}
                                </h1>
                                {selectedEmpresa.nome_fantasia && (
                                    <p className="text-lg text-gray-500 mt-1 font-medium">{selectedEmpresa.nome_fantasia}</p>
                                )}
                            </div>

                            {isAdmin && (
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={handleOpenEdit} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors shadow-sm flex items-center gap-2 text-sm font-semibold">
                                        <FontAwesomeIcon icon={faPen} /> Editar
                                    </button>
                                    <button onClick={handleDelete} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm flex items-center gap-2 text-sm font-semibold">
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Navigation Tabs */}
                        <div className="border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* TAB CONTENT: FICHA */}
                        {activeTab === 'ficha' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">

                                {/* COLUNA 1: Dados Legais e Societários (Larger) */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* CARD: Documentação Básica */}
                                    <div className="bg-white border text-gray-700 border-gray-100 rounded-2xl p-6 shadow-sm ring-1 ring-gray-900/5 hover:shadow-md transition-shadow">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-5 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faFileContract} /> Identificação Oficial
                                        </h3>
                                        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">CNPJ</p>
                                                <p className="font-medium text-gray-900 text-base">{selectedEmpresa.cnpj || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">NATUREZA JURÍDICA</p>
                                                <p className="font-medium text-gray-900 text-base">{selectedEmpresa.natureza_juridica || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">INSCRIÇÃO ESTADUAL</p>
                                                <p className="text-sm text-gray-800">{selectedEmpresa.inscricao_estadual || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">INSCRIÇÃO MUNICIPAL</p>
                                                <p className="text-sm text-gray-800">{selectedEmpresa.inscricao_municipal || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CARD: Societário e Capital */}
                                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm ring-1 ring-gray-900/5 hover:shadow-md transition-shadow">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-5 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faBuilding} /> Quadro e Objeto Social
                                        </h3>
                                        <div className="space-y-5">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">REPRESENTANTE LEGAL</p>
                                                    <p className="font-medium text-gray-900">{selectedEmpresa.responsavel_legal || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">CAPITAL SOCIAL</p>
                                                    <p className="font-medium text-green-700 bg-green-50 inline-block px-2 py-0.5 rounded uppercase">{formatCurrency(selectedEmpresa.capital_social)}</p>
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t border-gray-50">
                                                <p className="text-xs font-semibold text-gray-500 mb-2">OBJETO SOCIAL (ATIVIDADES)</p>
                                                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                    {selectedEmpresa.objeto_social || <span className="text-gray-400 italic">Não detalhado no cadastro.</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* COLUNA 2: Contatos, Endereço e Integrações (Smaller Sidebar) */}
                                <div className="space-y-6">

                                    {/* CARD: Contatos */}
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 shadow-sm">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-800/60 mb-5 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faEnvelope} /> Contato
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-blue-400 shrink-0"><FontAwesomeIcon icon={faPhone} /></div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 mb-0.5">TELEFONE</p>
                                                    <p className="font-medium text-gray-900">{selectedEmpresa.telefone || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-blue-400 shrink-0"><FontAwesomeIcon icon={faEnvelope} /></div>
                                                <div className="break-all">
                                                    <p className="text-xs font-semibold text-gray-500 mb-0.5">E-MAIL INSTITUCIONAL</p>
                                                    {selectedEmpresa.email ? (
                                                        <a href={`mailto:${selectedEmpresa.email}`} className="font-medium text-blue-600 hover:underline">{selectedEmpresa.email}</a>
                                                    ) : <p className="text-gray-900">—</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CARD: Endereço */}
                                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm ring-1 ring-gray-900/5">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faMapMarkerAlt} /> Sede / Endereço
                                        </h3>
                                        {selectedEmpresa.cep || selectedEmpresa.address_street ? (
                                            <div className="text-sm text-gray-700 leading-relaxed space-y-1">
                                                <p className="font-medium text-gray-900">
                                                    {selectedEmpresa.address_street}{selectedEmpresa.address_number ? `, ${selectedEmpresa.address_number}` : ''}
                                                    {selectedEmpresa.address_complement && ` - ${selectedEmpresa.address_complement}`}
                                                </p>
                                                <p>{selectedEmpresa.neighborhood}</p>
                                                <p>{selectedEmpresa.city} - {selectedEmpresa.state}</p>
                                                <p className="text-gray-500 font-mono text-xs mt-2">CEP: {selectedEmpresa.cep}</p>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 italic">Endereço não cadastrado.</p>
                                        )}
                                    </div>

                                    {/* CARD: Integrações Tech */}
                                    <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                                        {/* Decorator */}
                                        <div className="absolute -right-4 -top-4 text-white/5 text-7xl"><FontAwesomeIcon icon={faHashtag} /></div>

                                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2 relative z-10">
                                            <FontAwesomeIcon icon={faHashtag} /> Identificadores
                                        </h3>
                                        <div className="relative z-10 space-y-4">
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 mb-1">ID SISTEMA (UUID)</p>
                                                <p className="font-mono text-xs text-blue-300 break-all bg-black/30 p-1.5 rounded" title={selectedEmpresa.id}>{selectedEmpresa.id}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 mb-1">META BUSINESS ID</p>
                                                {selectedEmpresa.meta_business_id ? (
                                                    <p className="font-mono text-xs text-green-400 bg-black/30 p-1.5 rounded">{selectedEmpresa.meta_business_id}</p>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">Não vinculado</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}

                        {/* TAB CONTENT: CONTÁBIL */}
                        {activeTab === 'contabil' && (
                            <EmpresaAnexosTab empresaId={selectedEmpresa.id} categoria="contabil" />
                        )}

                        {/* TAB CONTENT: JURÍDICO */}
                        {activeTab === 'juridico' && (
                            <EmpresaAnexosTab empresaId={selectedEmpresa.id} categoria="juridico" />
                        )}

                        {/* TAB CONTENT: MARKETING */}
                        {activeTab === 'marketing' && (
                            <EmpresaAnexosTab empresaId={selectedEmpresa.id} categoria="marketing" />
                        )}

                    </div>
                )}
            </div>
        </div>
    );
}
