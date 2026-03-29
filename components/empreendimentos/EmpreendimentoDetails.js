// components/EmpreendimentoDetails.js
'use client';

// --- Imports ---
import UppyAvatarUploader from '@/components/ui/UppyAvatarUploader';
import AnexoUploader from '@/components/shared/AnexoUploader';
import GerenciadorAnexosGlobal from '@/components/shared/GerenciadorAnexosGlobal';
import FilePreviewModal from '@/components/shared/FilePreviewModal';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faRulerCombined, faBoxOpen, faFileLines, faUpload,
    faSpinner, faTrash, faEye, faSort, faSortUp, faSortDown,
    faCloudUploadAlt, faWandMagicSparkles, faLink, faDownload,
    faRightLeft, faPlus, faPen, faTimes, faFileContract, faTableCellsLarge, faBars,
    faBold, faItalic, faListUl, faListOl, faUndo, faRedo,
    faUserTie // <-- Ícone do Corretor
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce'; // <-- IMPORTANTE: Adicionado para persistência
import dynamic from 'next/dynamic';

// --- Carregamento Dinâmico do TipTap ---
const ReactQuill = null; // Garante que não haja referência antiga
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
// --- FIM Carregamento Dinâmico ---

// --- CHAVE ÚNICA PARA O LOCALSTORAGE ---
const EMPREENDIMENTO_UI_STATE_KEY = 'STUDIO57_EMPREENDIMENTO_UI_V1';

// Helper para ler o cache inicial
const getCachedUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(EMPREENDIMENTO_UI_STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

// --- SUB-COMPONENTES ---
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
// AnexoUploader inline foi removido. Usando components/shared/AnexoUploader.js

// --- ATUALIZAÇÃO: TabelaVendas agora recebe sortConfig via props ---
const TabelaVendas = ({ produtos, empreendimentoId, sortConfig, onSortChange }) => {
    // A lógica de estado local foi removida para permitir persistência no componente pai

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
        onSortChange({ key, direction });
    };

    const sortedProdutos = useMemo(() => {
        let sortableItems = [...produtos];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                if (sortConfig.key === 'valor_venda_calculado' || sortConfig.key === 'area_privativa') {
                    const numA = parseFloat(valA) || 0;
                    const numB = parseFloat(valB) || 0;
                    return sortConfig.direction === 'ascending' ? numA - numB : numB - numA;
                }
                if (String(valA).toLowerCase() < String(valB).toLowerCase()) { return sortConfig.direction === 'ascending' ? -1 : 1; }
                if (String(valA).toLowerCase() > String(valB).toLowerCase()) { return sortConfig.direction === 'ascending' ? 1 : -1; }
                return 0;
            });
        }
        return sortableItems;
    }, [produtos, sortConfig]);

    const SortableHeader = ({ label, sortKey, className = '' }) => {
        const getSortIcon = () => { if (sortConfig.key !== sortKey) return faSort; return sortConfig.direction === 'ascending' ? faSortUp : faSortDown; };
        return (<th className={`py-3 px-4 text-sm font-semibold text-gray-600 ${className}`}> <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full"> <span>{label}</span> <FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" /> </button> </th>);
    };

    const formatCurrency = (value) => { if (value == null || isNaN(value)) return 'N/A'; return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value)); };
    const statusColors = { 'Disponível': 'bg-green-100 text-green-800', 'Vendido': 'bg-red-100 text-red-800', 'Reservado': 'bg-yellow-100 text-yellow-800', 'Bloqueado': 'bg-gray-100 text-gray-800' };

    const tableSummary = useMemo(() => { const total = produtos.length; const disponiveis = produtos.filter(p => p.status === 'Disponível').length; const vendidos = produtos.filter(p => p.status === 'Vendido').length; const vgv = produtos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0); return { total, disponiveis, vendidos, vgv: formatCurrency(vgv) }; }, [produtos]);

    if (!produtos || produtos.length === 0) { return (<div className="text-center p-6 bg-gray-50 rounded-lg"> <p className="text-gray-600">Nenhum produto cadastrado para este empreendimento ainda.</p> <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow-sm transition-colors"> Cadastrar Produtos </Link> </div>); }
    return (<div className="animate-fade-in"> <div className="flex justify-between items-center mb-4"> <h2 className="text-2xl font-semibold text-gray-800">Tabela de Vendas</h2> <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="text-blue-500 hover:underline font-semibold"> Gerenciar Produtos e Condições &rarr; </Link> </div> <div className="overflow-x-auto shadow-md rounded-lg"> <table className="min-w-full bg-white"> <thead className="bg-gray-100"> <tr> <SortableHeader label="Unidade" sortKey="unidade" className="text-left" /> <SortableHeader label="Tipo" sortKey="tipo" className="text-left" /> <SortableHeader label="Área Privativa" sortKey="area_privativa" className="text-right" /> <SortableHeader label="Status" sortKey="status" className="text-center" /> <SortableHeader label="Valor de Venda" sortKey="valor_venda_calculado" className="text-right" /> </tr> </thead> <tbody className="divide-y divide-gray-200"> {sortedProdutos.map(produto => (<tr key={produto.id} className="hover:bg-gray-50"> <td className="py-3 px-4 font-medium">{produto.unidade}</td> <td className="py-3 px-4 text-gray-600">{produto.tipo}</td> <td className="py-3 px-4 text-right text-gray-600">{produto.area_privativa} m²</td> <td className="py-3 px-4 text-center"> <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[produto.status] || 'bg-gray-100 text-gray-800'}`}> {produto.status} </span> </td> <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatCurrency(produto.valor_venda_calculado)}</td> </tr>))} </tbody> <tfoot className="bg-gray-100 font-bold"> <tr> <td colSpan="2" className="py-3 px-4 text-left">Total: {tableSummary.total} unidades</td> <td className="py-3 px-4 text-right">Disponíveis: {tableSummary.disponiveis}</td> <td className="py-3 px-4 text-center">Vendidos: {tableSummary.vendidos}</td> <td className="py-3 px-4 text-right">VGV Total: {tableSummary.vgv}</td> </tr> </tfoot> </table> </div> </div>);
};

// --- ModalMoverAnexo ---
const ModalMoverAnexo = ({ isOpen, onClose, anexoInfo, documentoTipos, onSave }) => {
    const supabase = createClient();
    const [categoria, setCategoria] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if(isOpen && anexoInfo) {
            setCategoria(anexoInfo.categoria_aba || '');
            setTipoId(anexoInfo.tipo_documento_id || '');
        }
    }, [isOpen, anexoInfo]);

    if (!isOpen || !anexoInfo) return null;

    const handleSave = async () => {
        setIsSaving(true);
        const { error, data } = await supabase
            .from('empreendimento_anexos')
            .update({ categoria_aba: categoria, tipo_documento_id: tipoId || null })
            .eq('id', anexoInfo.id)
            .select().single();
            
        setIsSaving(false);
        if(error) { toast.error("Erro ao mover: " + error.message); return; }
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
                        <option value="engenharia">Projetos e Engenharia</option>
                        <option value="juridico">Documentos Jurídicos</option>
                        <option value="geral">Documentos Gerais</option>
                        <option value="marketing">Marketing</option>
                    </select>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Realinhar Tipo do Documento (Opcional)</label>
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

// --- ModalEditarAnexo ---
const ModalEditarAnexo = ({ isOpen, onClose, anexoInfo, onSave }) => {
    const supabase = createClient();
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if(isOpen && anexoInfo) {
            setNome(anexoInfo.nome_arquivo || '');
            setDescricao(anexoInfo.descricao || '');
        }
    }, [isOpen, anexoInfo]);

    if (!isOpen || !anexoInfo) return null;

    const handleSave = async () => {
        if(!nome.trim()){
            toast.error("O nome do arquivo não pode ficar vazio.");
            return;
        }

        setIsSaving(true);
        const { error, data } = await supabase
            .from('empreendimento_anexos')
            .update({ nome_arquivo: nome, descricao: descricao })
            .eq('id', anexoInfo.id)
            .select().single();
            
        setIsSaving(false);
        if(error) { toast.error("Erro ao salvar: " + error.message); return; }
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
                    <input 
                        type="text" 
                        value={nome} 
                        onChange={e => setNome(e.target.value)} 
                        placeholder="Ex: Contrato de Compra.pdf"
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Recomendamos manter a extensão (.pdf, .png)</p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Descrição (Opcional)</label>
                    <textarea 
                        value={descricao} 
                        onChange={e => setDescricao(e.target.value)}
                        placeholder="Adicione um detalhe, observação ou ano..."
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 min-h-[80px]"
                    />
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


// --- COMPONENTE DO MODAL ---
const ModalModeloContrato = ({ isOpen, onClose, modeloToEdit, empreendimentoId, organizacaoId, onSaveSuccess }) => {
    // ... (Código do ModalModeloContrato inalterado) ...
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [nomeModelo, setNomeModelo] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const editor = useEditor({
        extensions: [StarterKit],
        content: '',
        immediatelyRender: false,
    });

    useEffect(() => {
        if (isOpen) {
            const initialHtml = modeloToEdit?.clausulas_html || '';
            setNomeModelo(modeloToEdit?.nome_modelo || '');
            if (editor) {
                editor.commands.setContent(initialHtml);
            }
        }
    }, [modeloToEdit, isOpen, editor]);

    const MenuBar = ({ editor }) => {
        if (!editor) return null;
        const Button = ({ onClick, icon, title, isActive }) => (<button type="button" onClick={onClick} title={title} className={`p-2 rounded hover:bg-gray-200 ${isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-700'}`}><FontAwesomeIcon icon={icon} /></button>);
        return (<div className="flex items-center gap-1 p-2 border-b bg-gray-50 rounded-t-md"><Button onClick={() => editor.chain().focus().toggleBold().run()} icon={faBold} title="Negrito" isActive={editor.isActive('bold')} /><Button onClick={() => editor.chain().focus().toggleItalic().run()} icon={faItalic} title="Itálico" isActive={editor.isActive('italic')} /><Button onClick={() => editor.chain().focus().toggleBulletList().run()} icon={faListUl} title="Lista (•)" isActive={editor.isActive('bulletList')} /><Button onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={faListOl} title="Lista (1.)" isActive={editor.isActive('orderedList')} /><Button onClick={() => editor.chain().focus().undo().run()} icon={faUndo} title="Desfazer" isActive={false} /><Button onClick={() => editor.chain().focus().redo().run()} icon={faRedo} title="Refazer" isActive={false} /></div>);
    };

    const mutation = useMutation({
        mutationFn: async ({ nome, html }) => {
            const dataToSave = { empreendimento_id: empreendimentoId, organizacao_id: organizacaoId, nome_modelo: nome, clausulas_html: html, updated_at: new Date() };
            let result;
            if (modeloToEdit) { result = await supabase.from('modelos_contrato').update(dataToSave).eq('id', modeloToEdit.id).select().single(); }
            else { result = await supabase.from('modelos_contrato').insert(dataToSave).select().single(); }
            if (result.error) throw result.error; return result.data;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modelosContrato', empreendimentoId] }); onSaveSuccess(); onClose(); toast.success(`Modelo "${nomeModelo}" salvo com sucesso!`); },
        onError: (error) => { toast.error(`Erro ao salvar modelo: ${error.message}`); },
        onSettled: () => { setIsSaving(false); }
    });

    const handleSave = () => { if (!nomeModelo.trim()) { toast.error("O nome do modelo é obrigatório."); return; } if (!editor) { toast.error("Editor não inicializado."); return; } setIsSaving(true); const currentHtml = editor.getHTML(); mutation.mutate({ nome: nomeModelo, html: currentHtml }); };
    useEffect(() => { return () => { editor?.destroy(); }; }, [editor]);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header azul padrão */}
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white flex-shrink-0">
                    <h3 className="text-base font-bold flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileContract} />
                        {modeloToEdit ? 'Editar Modelo de Contrato' : 'Novo Modelo de Contrato'}
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fechar">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                <div className="p-5 flex-grow overflow-y-auto space-y-4"><div><label htmlFor="nomeModelo" className="block text-sm font-medium text-gray-700 mb-1">Nome do Modelo</label><input type="text" id="nomeModelo" value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} placeholder="Ex: Contrato Padrão - Financiamento" className="w-full p-2 border rounded-md" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Cláusulas do Contrato</label><div className="border rounded-md overflow-hidden h-[55vh] flex flex-col">{editor && <MenuBar editor={editor} />}<EditorContent editor={editor} className="p-3 flex-grow overflow-y-auto prose max-w-none prose-sm editor-styles" /></div></div></div>
                <style jsx global>{`.editor-styles .ProseMirror { min-height: 100%; outline: none; } .editor-styles p { margin-bottom: 0.5rem; } .editor-styles ul, .editor-styles ol { padding-left: 1.5rem; margin-bottom: 0.5rem; }`}</style>
                <div className="flex justify-end gap-3 p-5 border-t sticky bottom-0 bg-gray-50"><button type="button" onClick={onClose} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm font-bold transition-colors">Cancelar</button><button type="button" onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white text-sm font-bold px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 shadow-sm transition-colors">{isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : (modeloToEdit ? 'Salvar Alterações' : 'Criar Modelo')}</button></div>
            </div>
        </div>
    );
};


// --- COMPONENTE GerenciamentoModelosContrato ---
const GerenciamentoModelosContrato = ({ empreendimentoId, organizacaoId }) => {
    // ... (Código do GerenciamentoModelosContrato inalterado) ...
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modeloToEdit, setModeloToEdit] = useState(null);

    const { data: modelos = [], isLoading, isError, error } = useQuery({ queryKey: ['modelosContrato', empreendimentoId], queryFn: async () => { const { data, error } = await supabase.from('modelos_contrato').select('*').eq('empreendimento_id', empreendimentoId).eq('organizacao_id', organizacaoId).order('nome_modelo'); if (error) throw error; return data || []; }, enabled: !!empreendimentoId && !!organizacaoId });
    const deleteMutation = useMutation({ mutationFn: async (modeloId) => { const { error } = await supabase.from('modelos_contrato').delete().eq('id', modeloId); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modelosContrato', empreendimentoId] }); toast.success("Modelo excluído com sucesso!"); }, onError: (error) => { toast.error(`Erro ao excluir modelo: ${error.message}`); } });
    const handleDeleteModelo = (modelo) => { toast("Confirmar Exclusão", { description: `Tem certeza que deseja excluir o modelo "${modelo.nome_modelo}"? Esta ação não pode ser desfeita.`, action: { label: "Excluir", onClick: () => deleteMutation.mutate(modelo.id) }, cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' } }); };
    const handleOpenModal = (modelo = null) => { setModeloToEdit(modelo); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setModeloToEdit(null); };
    if (isLoading) { return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando modelos...</div>; }
    if (isError) { return <p className="text-center text-red-500 p-4">Erro ao carregar modelos: {error.message}</p>; }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-semibold text-gray-800">Modelos de Contrato</h2><button onClick={() => handleOpenModal()} className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2 transition-colors"><FontAwesomeIcon icon={faPlus} /> Adicionar Novo Modelo</button></div>
            {modelos.length === 0 ? (<p className="text-center text-gray-500 py-6">Nenhum modelo de contrato cadastrado para este empreendimento.</p>) : (<div className="border rounded-lg overflow-hidden"><ul className="divide-y">{modelos.map(modelo => (<li key={modelo.id} className="p-4 flex justify-between items-center hover:bg-gray-50"><span className="font-medium text-gray-800">{modelo.nome_modelo}</span><div className="flex items-center gap-4"><button onClick={() => handleOpenModal(modelo)} className="text-blue-600 hover:text-blue-800" title="Editar"><FontAwesomeIcon icon={faPen} /></button><button onClick={() => handleDeleteModelo(modelo)} disabled={deleteMutation.isPending} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button></div></li>))}</ul></div>)}
            <ModalModeloContrato isOpen={isModalOpen} onClose={handleCloseModal} modeloToEdit={modeloToEdit} empreendimentoId={empreendimentoId} organizacaoId={organizacaoId} onSaveSuccess={() => { }} />
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---
export default function EmpreendimentoDetails({ empreendimento, corporateEntities = [], proprietariaOptions = [], produtos = [], initialAnexos, documentoTipos, initialQuadroDeAreas, organizacaoId }) {
    // --- ESTADOS COM PERSISTÊNCIA ---
    const cachedState = getCachedUiState();

    // Estado da Aba com inicialização "preguiçosa" para evitar flash de conteúdo
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') {
            // Tenta recuperar do cache, se não existir, usa 'dados_gerais'
            const saved = localStorage.getItem(EMPREENDIMENTO_UI_STATE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.activeTab || 'dados_gerais';
            }
        }
        return 'dados_gerais';
    });

    // Estado da Ordenação da Tabela (Lifted State - trazido de TabelaVendas para cá)
    const [sortConfig, setSortConfig] = useState(() => {
        if (cachedState && cachedState.sortConfig) {
            return cachedState.sortConfig;
        }
        return { key: 'unidade', direction: 'ascending' };
    });

    const [anexos, setAnexos] = useState(initialAnexos); // Estado local para os anexos
    const [viewMode, setViewMode] = useState('grid');
    const [previewAnexo, setPreviewAnexo] = useState(null);
    const [moveAnexoTarget, setMoveAnexoTarget] = useState(null);
    const [editAnexoTarget, setEditAnexoTarget] = useState(null);

    const supabase = createClient();
    const router = useRouter();
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [summary, setSummary] = useState('');

    // --- LÓGICA DE PERSISTÊNCIA (SALVAR NO LOCALSTORAGE) ---
    const hasRestoredUiState = useRef(true);

    // Debounce para evitar salvar a cada clique rápido
    const [debouncedActiveTab] = useDebounce(activeTab, 500);
    const [debouncedSortConfig] = useDebounce(sortConfig, 500);

    // Monitora mudanças nos estados críticos e salva no localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && hasRestoredUiState.current) {
            const stateToSave = {
                activeTab: debouncedActiveTab,
                sortConfig: debouncedSortConfig
            };
            localStorage.setItem(EMPREENDIMENTO_UI_STATE_KEY, JSON.stringify(stateToSave));
        }
    }, [debouncedActiveTab, debouncedSortConfig]);

    // Hook useMutation para ligar/desligar a visibilidade do corretor
    const { mutate: toggleCorretorVisibility, isPending: isToggling } = useMutation({
        mutationFn: async (anexo) => {
            const novoValor = !anexo.disponivel_corretor;
            const { error } = await supabase
                .from('empreendimento_anexos')
                .update({ disponivel_corretor: novoValor })
                .eq('id', anexo.id);

            if (error) throw new Error(error.message);
            return { anexoId: anexo.id, novoValor }; // Retorna o ID e o novo valor para o onSuccess
        },
        onSuccess: ({ anexoId, novoValor }) => {
            // ATUALIZA O ESTADO LOCAL: encontra o anexo pelo ID e muda só a propriedade disponivel_corretor
            setAnexos(currentAnexos =>
                currentAnexos.map(a =>
                    a.id === anexoId ? { ...a, disponivel_corretor: novoValor } : a
                )
            );
            toast.success(novoValor ? "Arquivo publicado para corretores!" : "Arquivo removido dos corretores.");
        },
        onError: (error) => {
            toast.error(`Falha ao atualizar: ${error.message}`);
        }
    });


    // handleGerarResumo (sem mudanças)
    const handleGerarResumo = async () => {
        setIsGeneratingSummary(true); setSummary(''); toast.info("A Stella começou a trabalhar... Isso pode levar um minuto.");
        try {
            const response = await fetch('/api/empreendimentos/gerar-resumo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empreendimentoId: empreendimento.id }) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "A IA não conseguiu gerar o resumo."); }
            const data = await response.json(); setSummary(data.summary); toast.success("Resumo gerado com sucesso!");
        } catch (error) { toast.error(`Erro: ${error.message}`); } finally { setIsGeneratingSummary(false); }
    };

    // Atualiza a imagem de capa (mesma lógica do antigo ThumbnailUploader)
    const handleThumbnailUpload = async (newUrl) => {
        const { error } = await supabase
            .from('empreendimentos')
            .update({ imagem_capa_url: newUrl })
            .eq('id', empreendimento.id);

        if (error) {
            toast.error('Erro ao salvar nova imagem de capa no banco.');
            return;
        }

        // Atualiza a prop local sem recarregar (otimista)
        empreendimento.imagem_capa_url = newUrl;
    };

    // Atualiza o estado local quando os anexos iniciais mudam (importante se vierem do server-side)
    useEffect(() => { setAnexos(initialAnexos); }, [initialAnexos]);

    // kpiData (sem mudanças)
    const kpiData = useMemo(() => {
        const totalUnidades = produtos ? produtos.length : 0;
        const unidadesVendidas = produtos ? produtos.filter(p => p.status === 'Vendido').length : 0;
        const vgvTotal = produtos ? produtos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0) : 0;
        return { totalUnidades, unidadesVendidas, vgvTotal: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vgvTotal) };
    }, [produtos]);

    // handleDeleteAnexo (sem mudanças)
    const handleDeleteAnexo = async (anexoId) => {
        const anexoToDelete = anexos.find(a => a.id === anexoId);
        if (!anexoToDelete || !window.confirm(`Tem certeza que deseja excluir o anexo "${anexoToDelete.nome_arquivo}"?`)) return;
        toast.promise(new Promise(async (resolve, reject) => {
            const { error: storageError } = await supabase.storage.from('empreendimento-anexos').remove([anexoToDelete.caminho_arquivo]);
            // Ignora erro 404 (not found) no storage, mas rejeita outros erros
            if (storageError && !(storageError.message.includes('Not Found') || storageError.statusCode === 404)) return reject(storageError);
            const { error: dbError } = await supabase.from('empreendimento_anexos').delete().eq('id', anexoId);
            if (dbError) return reject(dbError); resolve("Anexo excluído com sucesso!");
        }), {
            loading: 'Excluindo...',
            success: (msg) => { setAnexos(currentAnexos => currentAnexos.filter(a => a.id !== anexoId)); return msg; }, // Atualiza estado local
            error: (err) => `Erro ao excluir: ${err.message}`
        });
    };

    // Memos (incorporadora, etc. - sem mudanças)
    const incorporadora = useMemo(() => corporateEntities.find(e => e.id === empreendimento.incorporadora_id), [corporateEntities, empreendimento.incorporadora_id]);
    const construtora = useMemo(() => corporateEntities.find(e => e.id === empreendimento.construtora_id), [corporateEntities, empreendimento.construtora_id]);
    const proprietaria = useMemo(() => proprietariaOptions.find(p => p.id === empreendimento.empresa_proprietaria_id), [proprietariaOptions, empreendimento.empresa_proprietaria_id]);
    const formattedValorTotal = useMemo(() => empreendimento.valor_total ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(empreendimento.valor_total)) : 'N/A', [empreendimento.valor_total]);
    const formattedTerrenoAreaTotal = useMemo(() => empreendimento.terreno_area_total ? `${empreendimento.terreno_area_total} m²` : 'N/A', [empreendimento.terreno_area_total]);

    // handleUploadSuccess - Adiciona o novo anexo ao estado local
    const handleUploadSuccess = async (newAnexoData) => {
        const { data } = await supabase.storage.from('empreendimento-anexos').createSignedUrl(newAnexoData.caminho_arquivo, 3600);
        const anexoCompleto = {
            ...newAnexoData,
            public_url: data?.signedUrl,
            tipo: documentoTipos.find(t => t.id === newAnexoData.tipo_documento_id),
            disponivel_corretor: newAnexoData.disponivel_corretor || false // Garante que a propriedade exista
        };
        // Adiciona o novo anexo no início da lista para melhor UX
        setAnexos(currentAnexos => [anexoCompleto, ...currentAnexos]);
    };

    const handleMoveSave = (updatedAnexo) => {
        setAnexos(currentAnexos => currentAnexos.map(a => 
            a.id === updatedAnexo.id 
                ? { ...a, categoria_aba: updatedAnexo.categoria_aba, tipo_documento_id: updatedAnexo.tipo_documento_id, tipo: documentoTipos.find(t=>t.id === updatedAnexo.tipo_documento_id) } 
                : a
        ));
    };

    const handleEditSave = (updatedAnexo) => {
        setAnexos(currentAnexos => currentAnexos.map(a => 
            a.id === updatedAnexo.id 
                ? { ...a, nome_arquivo: updatedAnexo.nome_arquivo, descricao: updatedAnexo.descricao } 
                : a
        ));
    };

    // TabButton (sem mudanças)
    const TabButton = ({ tabId, label }) => (
        <button onClick={() => setActiveTab(tabId)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{label}</button>
    );

    return (
        <div className="p-6 bg-white shadow-md rounded-lg">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 gap-4">
                <div className="flex items-start gap-4">
                    <UppyAvatarUploader
                        url={empreendimento.imagem_capa_url}
                        onUpload={handleThumbnailUpload}
                        bucketName="empreendimentos"
                        folderPath={`capas/${empreendimento.id}`}
                        label=""
                        aspectRatio="aspect-square" /* Logo style */
                        className="w-24 h-24 flex-shrink-0 mt-1"
                    />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">{empreendimento.nome}</h1>
                        <p className="text-gray-500 font-medium">{empreendimento.status}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleGerarResumo} disabled={isGeneratingSummary} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400"><FontAwesomeIcon icon={isGeneratingSummary ? faSpinner : faWandMagicSparkles} className={`mr-2 ${isGeneratingSummary ? 'animate-spin' : ''}`} />{isGeneratingSummary ? 'Gerando...' : 'Gerar Resumo com IA'}</button>
                    <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">Editar Empreendimento</Link>
                </div>
            </div>

            {/* Resumo IA */}
            {summary && (<div className="mb-6 p-4 border border-purple-200 bg-purple-50 rounded-lg animate-fade-in"><h3 className="text-lg font-semibold text-purple-800 mb-2">Resumo Gerado pela Stella</h3><div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br />') }} /></div>)}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"><KpiCard title="Status Atual" value={empreendimento.status || 'N/A'} icon={faBuilding} /><KpiCard title="Total de Unidades" value={kpiData.totalUnidades} icon={faBoxOpen} /><KpiCard title="Unidades Vendidas" value={kpiData.unidadesVendidas} icon={faBoxOpen} colorClass="text-green-500" /><KpiCard title="VGV Total" value={kpiData.vgvTotal} icon={faRulerCombined} /></div>

            {/* Barra de Abas */}
            <div className="border-b border-gray-200 mb-6"><nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs"><TabButton tabId="dados_gerais" label="Dados Gerais" /><TabButton tabId="produtos" label="Produtos" /><TabButton tabId="gerenciamento_contratos" label="Gerenciamento de Contratos" /><TabButton tabId="documentos_juridicos" label="Documentos Jurídicos" /><TabButton tabId="projetos_engenharia" label="Projetos e Engenharia" /><TabButton tabId="documentos_gerais" label="Documentos Gerais" /><TabButton tabId="marketing" label="Marketing" /></nav></div>

            {/* Conteúdo das Abas */}
            <div>
                {activeTab === 'dados_gerais' && (<div className="space-y-8 animate-fade-in"><div><h2 className="text-2xl font-semibold text-gray-800 mb-4">Dados do Empreendimento</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><InfoField label="Nome Fantasia" value={empreendimento.nome} /><InfoField label="Nome Oficial (Cartório)" value={empreendimento.nome_empreendimento} /><InfoField label="Status" value={empreendimento.status} /><InfoField label="Empresa Proprietária" value={proprietaria ? (proprietaria.nome_fantasia || proprietaria.razao_social) : 'N/A'} /><InfoField label="Incorporadora" value={incorporadora ? `${incorporadora.nome || incorporadora.razao_social}` : 'N/A'} /><InfoField label="Construtora" value={construtora ? `${construtora.nome || construtora.razao_social}` : 'N/A'} /><InfoField label="Data de Início" value={empreendimento.data_inicio} /><InfoField label="Data Fim Prevista" value={empreendimento.data_fim_prevista} /><InfoField label="Prazo de Entrega" value={empreendimento.prazo_entrega} /><InfoField label="Valor Total" value={formattedValorTotal} /><InfoField label="Número da Matrícula" value={empreendimento.matricula_numero} /><InfoField label="Cartório da Matrícula" value={empreendimento.matricula_cartorio} /><InfoField label="Índice de Reajuste" value={empreendimento.indice_reajuste} /></div></div><div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Endereço</h3><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"><InfoField label="CEP" value={empreendimento.cep} /><InfoField label="Rua" value={empreendimento.address_street} /><InfoField label="Número" value={empreendimento.address_number} /><InfoField label="Complemento" value={empreendimento.address_complement} /><InfoField label="Bairro" value={empreendimento.neighborhood} /><InfoField label="Cidade" value={empreendimento.city} /><InfoField label="Estado" value={empreendimento.state} /></div></div><div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Características Construtivas</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><InfoField label="Área Total do Terreno" value={formattedTerrenoAreaTotal} /><InfoField label="Tipo de Estrutura" value={empreendimento.estrutura_tipo} /><InfoField label="Tipo de Alvenaria" value={empreendimento.alvenaria_tipo} /><InfoField label="Detalhes da Cobertura" value={empreendimento.cobertura_detalhes} fullWidth={true} /></div></div>{initialQuadroDeAreas && initialQuadroDeAreas.length > 0 && (<div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Quadro de Áreas</h3><table className="min-w-full bg-white border rounded-lg"><thead className="bg-gray-100"><tr><th className="py-2 px-4 text-left text-sm font-semibold">Pavimento</th><th className="py-2 px-4 text-right text-sm font-semibold">Área (m²)</th></tr></thead><tbody>{initialQuadroDeAreas.map((item) => (<tr key={item.id} className="border-t"><td className="py-2 px-4">{item.pavimento_nome}</td><td className="py-2 px-4 text-right">{item.area_m2} m²</td></tr>))}<tr className="bg-gray-100 font-bold"><td className="py-2 px-4 text-left">Total</td><td className="py-2 px-4 text-right">{initialQuadroDeAreas.reduce((sum, item) => sum + parseFloat(item.area_m2 || 0), 0).toFixed(2)} m²</td></tr></tbody></table></div>)}</div>)}

                {/* ATUALIZADO: Passando as props de sort para TabelaVendas */}
                {activeTab === 'produtos' && (
                    <TabelaVendas
                        produtos={produtos}
                        empreendimentoId={empreendimento.id}
                        sortConfig={sortConfig}
                        onSortChange={setSortConfig}
                    />
                )}

                {activeTab === 'gerenciamento_contratos' && (<GerenciamentoModelosContrato empreendimentoId={empreendimento.id} organizacaoId={organizacaoId} />)}
                
                {['documentos_juridicos', 'projetos_engenharia', 'documentos_gerais', 'marketing'].includes(activeTab) && (
                    <div className="space-y-6 animate-fade-in mt-6">
                        
                        {/* Header de Ações Padrão Ouro para Gestão de Arquivos */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <AnexoUploader parentId={empreendimento.id} storageBucket="empreendimento-anexos" tableName="empreendimento_anexos" allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria={activeTab === 'projetos_engenharia' ? 'engenharia' : activeTab === 'documentos_juridicos' ? 'juridico' : activeTab === 'marketing' ? 'marketing' : 'geral'} organizacaoId={organizacaoId} />
                            
                            {/* O Toggle de Visualização Grid/Lista agora é gerenciado internamente pelo GerenciadorAnexosGlobal */}
                        </div>

                        {/* Super Componente Visualizador com Abas Interligadas */}
                        {activeTab === 'documentos_juridicos' && (<GerenciadorAnexosGlobal anexos={anexos.filter(a => a.categoria_aba === 'juridico')} viewMode={viewMode} onDelete={(id) => handleDeleteAnexo(id.id || id)} onToggleCorretor={toggleCorretorVisibility} isToggling={isToggling} onPreview={setPreviewAnexo} onMove={setMoveAnexoTarget} onEdit={setEditAnexoTarget} />)}
                        {activeTab === 'projetos_engenharia' && (<GerenciadorAnexosGlobal anexos={anexos.filter(a => a.categoria_aba === 'engenharia')} viewMode={viewMode} onDelete={(id) => handleDeleteAnexo(id.id || id)} onToggleCorretor={toggleCorretorVisibility} isToggling={isToggling} onPreview={setPreviewAnexo} onMove={setMoveAnexoTarget} onEdit={setEditAnexoTarget} />)}
                        {activeTab === 'documentos_gerais' && (<GerenciadorAnexosGlobal anexos={anexos.filter(a => a.categoria_aba === 'geral')} viewMode={viewMode} onDelete={(id) => handleDeleteAnexo(id.id || id)} onToggleCorretor={toggleCorretorVisibility} isToggling={isToggling} onPreview={setPreviewAnexo} onMove={setMoveAnexoTarget} onEdit={setEditAnexoTarget} />)}
                        {activeTab === 'marketing' && (<GerenciadorAnexosGlobal anexos={anexos.filter(a => a.categoria_aba === 'marketing')} viewMode={viewMode} onDelete={(id) => handleDeleteAnexo(id.id || id)} onToggleCorretor={toggleCorretorVisibility} isToggling={isToggling} onPreview={setPreviewAnexo} onMove={setMoveAnexoTarget} onEdit={setEditAnexoTarget} />)}
                    </div>
                )}
            </div>

            {/* Modais Padrão Ouro */}
            <FilePreviewModal anexo={previewAnexo} onClose={() => setPreviewAnexo(null)} />
            <ModalMoverAnexo isOpen={!!moveAnexoTarget} onClose={() => setMoveAnexoTarget(null)} anexoInfo={moveAnexoTarget} documentoTipos={documentoTipos} onSave={handleMoveSave} />
            <ModalEditarAnexo isOpen={!!editAnexoTarget} onClose={() => setEditAnexoTarget(null)} anexoInfo={editAnexoTarget} onSave={handleEditSave} />
        </div>
    );
}