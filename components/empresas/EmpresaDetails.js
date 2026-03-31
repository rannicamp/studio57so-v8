// components/empresas/EmpresaDetails.js
'use client';

import UppyAvatarUploader from '@/components/ui/UppyAvatarUploader';
import AnexoUploader from '@/components/shared/AnexoUploader';
import GerenciadorAnexosGlobal from '@/components/shared/GerenciadorAnexosGlobal';
import FilePreviewModal from '@/components/shared/FilePreviewModal';
import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faRulerCombined, faBoxOpen, faFileLines, faUpload,
    faSpinner, faTrash, faEye, faRightLeft, faPen, faTimes,
    faFileContract, faTableCellsLarge, faBars
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

const EMPRESA_UI_STATE_KEY = 'STUDIO57_EMPRESA_UI_V2'; // Novo ID para não conflitar com antigo Manager

const getCachedUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(EMPRESA_UI_STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

function InfoField({ label, value, fullWidth = false }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className={fullWidth ? "md:col-span-3" : ""}>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{value}</p>
        </div>
    );
}

function KpiCard({ title, value, icon, colorClass = 'text-blue-500' }) {
    return (
        <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
            {icon && <FontAwesomeIcon icon={icon} className={`text-2xl ${colorClass}`} />}
            <div>
                <p className="text-sm text-gray-500">{title}</p>
                <p className="text-xl font-semibold text-gray-900">{value}</p>
            </div>
        </div>
    );
}

// --- Modais Reutilizáveis (Clones de Empreendimentos) ---
const ModalMoverAnexo = ({ isOpen, onClose, anexoInfo, documentoTipos, onSave }) => {
    const supabase = createClient();
    const [categoria, setCategoria] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && anexoInfo) {
            setCategoria(anexoInfo.categoria_aba || '');
            setTipoId(anexoInfo.tipo_documento_id || '');
        }
    }, [isOpen, anexoInfo]);

    if (!isOpen || !anexoInfo) return null;

    const handleSave = async () => {
        setIsSaving(true);
        const { error, data } = await supabase
            .from('empresa_anexos')
            .update({ categoria_aba: categoria, tipo_documento_id: tipoId || null })
            .eq('id', anexoInfo.id)
            .select().single();

        setIsSaving(false);
        if (error) { toast.error("Erro ao mover: " + error.message); return; }
        toast.success("Arquivo movido com sucesso!");
        onSave(data);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faRightLeft} className="text-indigo-500" /> Mover Arquivo
                </h3>

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Nova Categoria/Aba</label>
                    <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="contabil">Contábil</option>
                        <option value="juridico">Jurídico</option>
                        <option value="marketing">Marketing</option>
                    </select>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Realinhar Tipo do Documento</label>
                    <select value={tipoId} onChange={e => setTipoId(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Nenhum / Não classificado</option>
                        {documentoTipos?.map(t => (
                            <option key={t.id} value={t.id}>{t.sigla} - {t.descricao}</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 font-semibold transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 font-bold transition-colors">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : "Transferir"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ModalEditarAnexo = ({ isOpen, onClose, anexoInfo, onSave }) => {
    const supabase = createClient();
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && anexoInfo) {
            setNome(anexoInfo.nome_arquivo || '');
            setDescricao(anexoInfo.descricao || '');
        }
    }, [isOpen, anexoInfo]);

    if (!isOpen || !anexoInfo) return null;

    const handleSave = async () => {
        if (!nome.trim()) { toast.error("O nome do arquivo não pode ficar vazio."); return; }
        setIsSaving(true);
        const { error, data } = await supabase
            .from('empresa_anexos')
            .update({ nome_arquivo: nome, descricao: descricao })
            .eq('id', anexoInfo.id)
            .select().single();

        setIsSaving(false);
        if (error) { toast.error("Erro ao salvar: " + error.message); return; }
        toast.success("Arquivo atualizado com sucesso!");
        onSave(data);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPen} className="text-orange-500" /> Editar Arquivo
                </h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Nome do Arquivo</label>
                    <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Descrição</label>
                    <textarea value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 min-h-[80px]" />
                </div>
                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 font-semibold transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 bg-orange-500 text-white rounded-lg shadow-md hover:bg-orange-600 font-bold transition-colors">
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : "Salvar Alterações"}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---
export default function EmpresaDetails({ empresa, initialAnexos, documentoTipos, organizacaoId }) {
    const cachedState = getCachedUiState();

    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(EMPRESA_UI_STATE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.activeTab || 'ficha';
            }
        }
        return 'ficha';
    });

    const [anexos, setAnexos] = useState(initialAnexos || []);
    const [viewMode, setViewMode] = useState('grid');
    const [previewAnexo, setPreviewAnexo] = useState(null);
    const [moveAnexoTarget, setMoveAnexoTarget] = useState(null);
    const [editAnexoTarget, setEditAnexoTarget] = useState(null);

    const supabase = createClient();
    const hasRestoredUiState = useRef(true);
    const [debouncedActiveTab] = useDebounce(activeTab, 500);

    useEffect(() => {
        if (typeof window !== 'undefined' && hasRestoredUiState.current) {
            localStorage.setItem(EMPRESA_UI_STATE_KEY, JSON.stringify({ activeTab: debouncedActiveTab }));
        }
    }, [debouncedActiveTab]);

    useEffect(() => { setAnexos(initialAnexos); }, [initialAnexos]);

    const handleThumbnailUpload = async (newUrl) => {
        const { error } = await supabase.from('cadastro_empresa').update({ logo_url: newUrl }).eq('id', empresa.id);
        if (error) { toast.error('Erro ao salvar nova logo no banco.'); return; }
        empresa.logo_url = newUrl;
    };

    const handleDeleteAnexo = async (anexoId) => {
        const realId = typeof anexoId === 'object' ? anexoId.id : anexoId;
        const anexoToDelete = anexos.find(a => a.id === realId);
        if (!anexoToDelete || !window.confirm(`Tem certeza que deseja excluir o anexo "${anexoToDelete.nome_arquivo}"?`)) return;

        toast.promise(new Promise(async (resolve, reject) => {
            const { error: storageError } = await supabase.storage.from('empresa-anexos').remove([anexoToDelete.caminho_arquivo]);
            if (storageError && !(storageError.message.includes('Not Found') || storageError.statusCode === 404)) return reject(storageError);
            const { error: dbError } = await supabase.from('empresa_anexos').delete().eq('id', realId);
            if (dbError) return reject(dbError); resolve("Anexo excluído com sucesso!");
        }), {
            loading: 'Excluindo...',
            success: (msg) => { setAnexos(currentAnexos => currentAnexos.filter(a => a.id !== realId)); return msg; },
            error: (err) => `Erro ao excluir: ${err.message}`
        });
    };

    const handleUploadSuccess = async (newAnexoData) => {
        const { data } = await supabase.storage.from('empresa-anexos').createSignedUrl(newAnexoData.caminho_arquivo, 3600);
        const anexoCompleto = { ...newAnexoData, public_url: data?.signedUrl, tipo: documentoTipos.find(t => t.id === newAnexoData.tipo_documento_id) };
        setAnexos(currentAnexos => [anexoCompleto, ...currentAnexos]);
    };

    const handleMoveSave = (updatedAnexo) => {
        setAnexos(currentAnexos => currentAnexos.map(a => 
            a.id === updatedAnexo.id ? { ...a, categoria_aba: updatedAnexo.categoria_aba, tipo_documento_id: updatedAnexo.tipo_documento_id, tipo: documentoTipos.find(t => t.id === updatedAnexo.tipo_documento_id) } : a
        ));
    };

    const handleEditSave = (updatedAnexo) => {
        setAnexos(currentAnexos => currentAnexos.map(a => 
            a.id === updatedAnexo.id ? { ...a, nome_arquivo: updatedAnexo.nome_arquivo, descricao: updatedAnexo.descricao } : a
        ));
    };

    const kpiData = useMemo(() => {
        const anexosContabeis = anexos.filter(a => a.categoria_aba === 'contabil').length;
        const anexosJuridicos = anexos.filter(a => a.categoria_aba === 'juridico').length;
        const anexosMarketing = anexos.filter(a => a.categoria_aba === 'marketing').length;
        const totalAnexos = anexos.length;
        return { totalAnexos, anexosContabeis, anexosJuridicos, anexosMarketing };
    }, [anexos]);

    const TabButton = ({ tabId, label }) => (
        <button onClick={() => setActiveTab(tabId)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{label}</button>
    );

    return (
        <div className="p-6 bg-white shadow-md rounded-lg h-full">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 gap-4">
                <div className="flex items-start gap-4 flex-1">
                    <UppyAvatarUploader
                        url={empresa.logo_url || empresa.imagem_url}
                        onUpload={handleThumbnailUpload}
                        bucketName="public_assets"
                        folderPath={`empresas/logos`}
                        label=""
                        aspectRatio="aspect-square"
                        className="w-24 h-24 flex-shrink-0 mt-1"
                    />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 break-words">{empresa.nome_fantasia || empresa.razao_social}</h1>
                        <p className="text-gray-500 font-medium">CNPJ: {empresa.cnpj || 'Não informado'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('edit-empresa', { detail: empresa }))} 
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-sm transition-colors text-sm font-semibold"
                    >
                        <FontAwesomeIcon icon={faPen} className="mr-2" />
                        Editar E./Obra
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <KpiCard title="Total Documentos" value={kpiData.totalAnexos} icon={faFileLines} colorClass="text-indigo-500" />
                <KpiCard title="Contábil" value={kpiData.anexosContabeis} icon={faBoxOpen} colorClass="text-green-500" />
                <KpiCard title="Jurídicos" value={kpiData.anexosJuridicos} icon={faBuilding} colorClass="text-purple-500" />
                <KpiCard title="Marketing" value={kpiData.anexosMarketing} icon={faUpload} colorClass="text-orange-500" />
            </div>

            {/* Barra de Abas */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabId="ficha" label="Ficha Cadastral" />
                    <TabButton tabId="contabil" label="Documentos Contábeis" />
                    <TabButton tabId="juridico" label="Documentos Jurídicos" />
                    <TabButton tabId="marketing" label="Marketing" />
                </nav>
            </div>

            {/* Conteúdo das Abas */}
            <div className="pb-10">
                {activeTab === 'ficha' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Dados da Empresa / SPE</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField label="Razão Social" value={empresa.razao_social} />
                                <InfoField label="Nome Fantasia" value={empresa.nome_fantasia} />
                                <InfoField label="CNPJ" value={empresa.cnpj} />
                                <InfoField label="Inscrição Estadual" value={empresa.inscricao_estadual} />
                                <InfoField label="Inscrição Municipal" value={empresa.inscricao_municipal} />
                                <InfoField label="Email de Contato" value={empresa.email_contato} />
                                <InfoField label="Telefone" value={empresa.telefone} />
                                <InfoField label="CNAE Principal" value={empresa.cnae_principal} />
                            </div>
                        </div>

                        <div className="pt-6 border-t">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Endereço</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField label="CEP" value={empresa.cep} />
                                <InfoField label="Rua" value={empresa.rua} />
                                <InfoField label="Número" value={empresa.numero} />
                                <InfoField label="Complemento" value={empresa.complemento} />
                                <InfoField label="Bairro" value={empresa.bairro} />
                                <InfoField label="Cidade" value={empresa.cidade} />
                                <InfoField label="Estado" value={empresa.estado} />
                            </div>
                        </div>

                        <div className="pt-6 border-t">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Responsável Legal (Sócio Administrador)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField label="Nome do Responsável" value={empresa.responsavel_nome} />
                                <InfoField label="CPF do Responsável" value={empresa.responsavel_cpf} />
                                <InfoField label="RG do Responsável" value={empresa.responsavel_rg} />
                                <InfoField label="Estado Civil" value={empresa.responsavel_estado_civil} />
                                <InfoField label="Nacionalidade" value={empresa.responsavel_nacionalidade} />
                                <InfoField label="Profissão" value={empresa.responsavel_profissao} />
                                <InfoField label="Endereço do Responsável" fullWidth={true} value={`${empresa.responsavel_cep ? `CEP: ${empresa.responsavel_cep}, ` : ''}${empresa.responsavel_rua || ''} ${empresa.responsavel_numero || ''} ${empresa.responsavel_complemento ? `- ${empresa.responsavel_complemento}` : ''} - ${empresa.responsavel_bairro || ''}, ${empresa.responsavel_cidade || ''}/${empresa.responsavel_estado || ''}`} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Abas de Arquivos */}
                {['contabil', 'juridico', 'marketing'].includes(activeTab) && (
                    <div className="space-y-6 animate-fade-in mt-6">
                        {/* Header Gerenciador Padrão Ouro */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <AnexoUploader parentId={empresa.id} storageBucket="empresa-anexos" tableName="empresa_anexos" allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria={activeTab} organizacaoId={organizacaoId} />
                        </div>

                        <GerenciadorAnexosGlobal 
                            anexos={anexos.filter(a => a.categoria_aba === activeTab)} 
                            viewMode={viewMode} 
                            storageBucket="empresa-anexos"
                            onDelete={handleDeleteAnexo} 
                            onPreview={setPreviewAnexo} 
                            onMove={setMoveAnexoTarget} 
                            onEdit={setEditAnexoTarget} 
                        />
                    </div>
                )}
            </div>

            <FilePreviewModal anexo={previewAnexo} onClose={() => setPreviewAnexo(null)} />
            <ModalMoverAnexo isOpen={!!moveAnexoTarget} onClose={() => setMoveAnexoTarget(null)} anexoInfo={moveAnexoTarget} documentoTipos={documentoTipos} onSave={handleMoveSave} />
            <ModalEditarAnexo isOpen={!!editAnexoTarget} onClose={() => setEditAnexoTarget(null)} anexoInfo={editAnexoTarget} onSave={handleEditSave} />
        </div>
    );
}