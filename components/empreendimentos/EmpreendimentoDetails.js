// components/EmpreendimentoDetails.js
'use client';

// --- Imports ---
import ThumbnailUploader from '@/components/shared/ThumbnailUploader';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faRulerCombined, faBoxOpen, faFileLines, faUpload,
    faSpinner, faTrash, faEye, faSort, faSortUp, faSortDown,
    faCloudUploadAlt, faWandMagicSparkles, faLink, faDownload,
    faRightLeft, faPlus, faPen, faTimes, faFileContract,
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
const AnexoUploader = ({ empreendimentoId, allowedTipos, onUploadSuccess, categoria, organizacaoId }) => {
    const supabase = createClient();
    const [file, setFile] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (selectedFile) => {
        if (!selectedFile) return;

        if (!selectedFile.type.startsWith('image/')) {
            setFile(selectedFile);
            return;
        }

        const options = {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
        };

        try {
            toast.info("Otimizando imagem para o upload...");
            const compressedFile = await imageCompression(selectedFile, options);
            setFile(compressedFile);
            toast.success("Imagem otimizada!");
        } catch (error) {
            console.error('Erro ao comprimir a imagem:', error);
            toast.error('Não foi possível otimizar a imagem. Usando o arquivo original.');
            setFile(selectedFile);
        }
    };

    const resetState = () => { setFile(null); setDescricao(''); setTipoId(''); if (fileInputRef.current) fileInputRef.current.value = ""; };
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); };
    const handleUpload = async () => {
        if (!file || !tipoId) { toast.error("Por favor, selecione um tipo de documento e um arquivo."); return; }
        if (!categoria) { toast.error("Erro: A categoria da aba não foi definida."); return; }
        if (!organizacaoId) {
            toast.error("Erro de segurança: Organização não identificada. Por favor, faça login novamente.");
            return;
        }

        setIsUploading(true);
        const tipoSelecionado = allowedTipos.find(t => t.id == tipoId);
        const sigla = tipoSelecionado?.sigla || 'DOC';
        const fileExt = file.name.split('.').pop();
        const newFileName = `${empreendimentoId}/${sigla}_${Date.now()}.${fileExt}`;
        const promise = new Promise(async (resolve, reject) => {
            const { error: uploadError } = await supabase.storage.from('empreendimento-anexos').upload(newFileName, file, { upsert: true });
            if (uploadError) return reject(uploadError);

            const { data, error: dbError } = await supabase.from('empreendimento_anexos').insert({
                empreendimento_id: empreendimentoId,
                caminho_arquivo: newFileName,
                nome_arquivo: file.name,
                descricao: descricao,
                tipo_documento_id: tipoId,
                categoria_aba: categoria,
                organizacao_id: organizacaoId,
              disponivel_corretor: false // Garante o valor padrão no upload
            }).select().single();

            if (dbError) return reject(dbError);
            // Chamadas API (sem relação direta com o botão, mantidas como estavam)
            fetch('/api/empreendimentos/process-anexo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anexoId: data.id }) }).catch(err => console.error("Erro ao chamar API de processamento da IA:", err));
            fetch('/api/generate-pdf-thumbnail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anexo: data }) }).catch(err => console.error("Erro ao iniciar a geração de thumbnail:", err));

            resolve({msg: "Anexo enviado! A IA começará a estudá-lo.", newAnexo: data});
        });
        toast.promise(promise, {
            loading: 'Enviando arquivo...',
            success: (result) => { onUploadSuccess(result.newAnexo); resetState(); return result.msg; },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsUploading(false)
        });
    };
    const dropzoneClass = isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50';
    return (
        <div className="p-4 bg-white border rounded-lg space-y-4">
            <h4 className="font-semibold text-gray-700">Adicionar Novo Documento</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="p-2 border rounded-md w-full"><option value="">-- Selecione o Tipo --</option>{allowedTipos.map(t => <option key={t.id} value={t.id}>{t.descricao} ({t.sigla})</option>)}</select>
                <input type="text" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="p-2 border rounded-md w-full" />
            </div>
            <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dropzoneClass}`}>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0])} />
                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-gray-400 mb-3" />
                {file ? (<div><p className="font-semibold text-gray-700">{file.name}</p><p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p></div>) : (<p className="text-gray-500">Arraste e solte o arquivo aqui, ou <span className="text-blue-600 font-semibold">clique para selecionar</span>.</p>)}
            </div>
            <div className="flex justify-end">
                <button onClick={handleUpload} disabled={isUploading || !file || !tipoId} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                    {isUploading ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : <FontAwesomeIcon icon={faUpload} className="mr-2" />}
                    {isUploading ? 'Enviando...' : 'Enviar Arquivo'}
                </button>
            </div>
        </div>
    );
};

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
        return ( <th className={`py-3 px-4 text-sm font-semibold text-gray-600 ${className}`}> <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full"> <span>{label}</span> <FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" /> </button> </th> );
    };
    
    const formatCurrency = (value) => { if (value == null || isNaN(value)) return 'N/A'; return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value)); };
    const statusColors = { 'Disponível': 'bg-green-100 text-green-800', 'Vendido': 'bg-red-100 text-red-800', 'Reservado': 'bg-yellow-100 text-yellow-800', 'Bloqueado': 'bg-gray-100 text-gray-800' };
    
    const tableSummary = useMemo(() => { const total = produtos.length; const disponiveis = produtos.filter(p => p.status === 'Disponível').length; const vendidos = produtos.filter(p => p.status === 'Vendido').length; const vgv = produtos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0); return { total, disponiveis, vendidos, vgv: formatCurrency(vgv) }; }, [produtos]);
    
    if (!produtos || produtos.length === 0) { return ( <div className="text-center p-6 bg-gray-50 rounded-lg"> <p className="text-gray-600">Nenhum produto cadastrado para este empreendimento ainda.</p> <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"> Cadastrar Produtos </Link> </div> ); }
    return ( <div className="animate-fade-in"> <div className="flex justify-between items-center mb-4"> <h2 className="text-2xl font-semibold text-gray-800">Tabela de Vendas</h2> <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="text-blue-500 hover:underline font-semibold"> Gerenciar Produtos e Condições &rarr; </Link> </div> <div className="overflow-x-auto shadow-md rounded-lg"> <table className="min-w-full bg-white"> <thead className="bg-gray-100"> <tr> <SortableHeader label="Unidade" sortKey="unidade" className="text-left" /> <SortableHeader label="Tipo" sortKey="tipo" className="text-left" /> <SortableHeader label="Área Privativa" sortKey="area_privativa" className="text-right" /> <SortableHeader label="Status" sortKey="status" className="text-center" /> <SortableHeader label="Valor de Venda" sortKey="valor_venda_calculado" className="text-right" /> </tr> </thead> <tbody className="divide-y divide-gray-200"> {sortedProdutos.map(produto => ( <tr key={produto.id} className="hover:bg-gray-50"> <td className="py-3 px-4 font-medium">{produto.unidade}</td> <td className="py-3 px-4 text-gray-600">{produto.tipo}</td> <td className="py-3 px-4 text-right text-gray-600">{produto.area_privativa} m²</td> <td className="py-3 px-4 text-center"> <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[produto.status] || 'bg-gray-100 text-gray-800'}`}> {produto.status} </span> </td> <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatCurrency(produto.valor_venda_calculado)}</td> </tr> ))} </tbody> <tfoot className="bg-gray-100 font-bold"> <tr> <td colSpan="2" className="py-3 px-4 text-left">Total: {tableSummary.total} unidades</td> <td className="py-3 px-4 text-right">Disponíveis: {tableSummary.disponiveis}</td> <td className="py-3 px-4 text-center">Vendidos: {tableSummary.vendidos}</td> <td className="py-3 px-4 text-right">VGV Total: {tableSummary.vgv}</td> </tr> </tfoot> </table> </div> </div> );
};

// --- ListaAnexos com o botão de toggle ---
const ListaAnexos = ({ anexos, onDelete, onToggleCorretor, isToggling }) => {
     if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4 mt-4">Nenhum documento nesta categoria.</p>;
    return (
        <div className="space-y-3 mt-4">
            {anexos.map(anexo => (
                <div key={anexo.id} className="bg-white p-3 rounded-md border flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                    {/* Detalhes do Anexo */}
                    <div className="flex items-center gap-4 min-w-0">
                        <FontAwesomeIcon icon={faFileLines} className="text-xl text-gray-500 flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                            <p className="font-medium text-gray-800 truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p>
                            <p className="text-xs text-gray-500">{anexo.descricao || anexo.tipo?.descricao || 'Sem descrição'}</p>
                        </div>
                    </div>
                    {/* Botões de Ação */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Botão de Toggle Corretor */}
                        <button
                            onClick={() => onToggleCorretor(anexo)}
                            disabled={isToggling}
                            title={anexo.disponivel_corretor ? "Disponível para Corretores (Clique para remover)" : "Indisponível para Corretores (Clique para publicar)"}
                            className={`p-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                                anexo.disponivel_corretor
                                ? 'text-white bg-blue-600 hover:bg-blue-700'
                                : 'text-gray-500 bg-gray-200 hover:bg-gray-300'
                            }`}
                        >
                            <FontAwesomeIcon icon={isToggling ? faSpinner : faUserTie} className={`${isToggling ? 'animate-spin' : ''} text-sm`} />
                        </button>
                        {/* Outros botões */}
                        <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Visualizar"><FontAwesomeIcon icon={faEye} /></a>
                        <button onClick={() => onDelete(anexo.id)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- GaleriaMarketing com o botão de toggle ---
const GaleriaMarketing = ({ anexos, onDelete, onToggleCorretor, isToggling }) => {
    const supabase = createClient();
    const replaceFileInputRef = useRef(null);
    const [anexoToReplace, setAnexoToReplace] = useState(null);

    const handleReplaceClick = (anexo) => {
        setAnexoToReplace(anexo);
        replaceFileInputRef.current?.click();
    };

    const handleFileReplace = async (event) => {
        const file = event.target.files[0];
        if (!file || !anexoToReplace) return;

        toast.promise(
            new Promise(async (resolve, reject) => {
                const { error } = await supabase.storage
                    .from('empreendimento-anexos')
                    .upload(anexoToReplace.caminho_arquivo, file, { upsert: true });
                if (error) return reject(error);
                // Trigger thumbnail regeneration if needed
                fetch('/api/generate-pdf-thumbnail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anexo: anexoToReplace }) }).catch(err => console.error("Erro ao regerar thumbnail:", err));
                resolve("Arquivo substituído com sucesso! A página será recarregada.");
            }),
            {
                loading: 'Substituindo arquivo...',
                success: (msg) => { setTimeout(() => window.location.reload(), 2000); return msg; },
                error: (err) => `Erro ao substituir: ${err.message}`,
                finally: () => { setAnexoToReplace(null); if(replaceFileInputRef.current) replaceFileInputRef.current.value = ""; }
            }
        );
    };

    if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4 mt-4">Nenhum item de marketing encontrado.</p>;

    const isVideo = (path) => /\.(mp4|webm|ogg)$/i.test(path || '');
    const isPdf = (path) => /\.(pdf)$/i.test(path || '');

    const handleGeneratePublicLink = async (filePath) => {
        if (!filePath) { toast.error("Arquivo não encontrado."); return; }
        const { data } = supabase.storage.from('empreendimento-anexos').getPublicUrl(filePath);
        if (data?.publicUrl) {
            try {
                await navigator.clipboard.writeText(data.publicUrl);
                toast.success("Link público copiado para a área de transferência!");
            } catch (err) {
                toast.error("Falha ao copiar o link.");
                console.error("Erro ao copiar para clipboard:", err);
            }
        } else {
            toast.error("Não foi possível gerar o link público.");
        }
    };

    return (
        <>
            <input type="file" ref={replaceFileInputRef} className="hidden" onChange={handleFileReplace} />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                {anexos.map(anexo => (
                    <div key={anexo.id} className="relative group rounded-lg overflow-hidden shadow-lg border">
                        {/* Preview */}
                        <a href={anexo.public_url} target="_blank" rel="noopener noreferrer">
                            {anexo.thumbnail_url ? (
                                <img src={anexo.thumbnail_url} alt={`Pré-visualização de ${anexo.nome_arquivo}`} className="w-full h-48 object-contain"/>
                            ) : isVideo(anexo.caminho_arquivo) ? (
                                <video controls src={anexo.public_url} className="w-full h-48 object-contain bg-black">Seu navegador não suporta vídeos.</video>
                            ) : isPdf(anexo.nome_arquivo) ? (
                                <div className="w-full h-48 bg-gray-200 flex flex-col items-center justify-center text-gray-500">
                                    <FontAwesomeIcon icon={faSpinner} spin size="2x" /><span className="mt-2 text-sm">Processando preview...</span>
                                </div>
                            ) : (
                                anexo.public_url && <img src={anexo.public_url} alt={anexo.nome_arquivo} className="w-full h-48 object-contain"/>
                            )}
                        </a>
                        {/* Botões Overlay */}
                        <div className="absolute top-0 right-0 p-1 flex items-center gap-1 bg-black/30 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Botão Toggle Corretor */}
                                <button
                                    onClick={() => onToggleCorretor(anexo)}
                                    disabled={isToggling}
                                    title={anexo.disponivel_corretor ? "Disponível para Corretores" : "Indisponível para Corretores"}
                                    className={`text-white h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/30 transition-colors ${
                                        anexo.disponivel_corretor ? 'bg-blue-600' : 'bg-gray-600'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={isToggling ? faSpinner : faUserTie} className={`${isToggling ? 'animate-spin' : ''} text-xs`} />
                                </button>
                                {/* Outros Botões */}
                                <button onClick={() => handleReplaceClick(anexo)} title="Substituir" className="text-white h-7 w-7 flex items-center justify-center hover:bg-black/30 rounded-full transition-colors"><FontAwesomeIcon icon={faRightLeft} /></button>
                                <a href={anexo.public_url} download={anexo.nome_arquivo} title="Baixar" className="text-white h-7 w-7 flex items-center justify-center hover:bg-black/30 rounded-full transition-colors"><FontAwesomeIcon icon={faDownload} /></a>
                                <button onClick={() => handleGeneratePublicLink(anexo.caminho_arquivo)} title="Copiar link público" className="text-white h-7 w-7 flex items-center justify-center hover:bg-black/30 rounded-full transition-colors"><FontAwesomeIcon icon={faLink} /></button>
                                <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" title="Visualizar" className="text-white h-7 w-7 flex items-center justify-center hover:bg-black/30 rounded-full transition-colors"><FontAwesomeIcon icon={faEye} /></a>
                                <button onClick={() => onDelete(anexo.id)} title="Excluir" className="text-white h-7 w-7 flex items-center justify-center hover:bg-black/30 rounded-full transition-colors"><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                        {/* Descrição Overlay */}
                        {(anexo.descricao || anexo.tipo?.descricao) && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate" title={anexo.descricao || anexo.tipo.descricao}>
                                {anexo.descricao || anexo.tipo.descricao}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </>
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
            if(editor) {
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
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white rounded-t-lg"><h3 className="text-xl font-bold text-gray-800">{modeloToEdit ? 'Editar Modelo de Contrato' : 'Adicionar Novo Modelo de Contrato'}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full"><FontAwesomeIcon icon={faTimes} size="lg" /></button></div>
                <div className="p-5 flex-grow overflow-y-auto space-y-4"><div><label htmlFor="nomeModelo" className="block text-sm font-medium text-gray-700 mb-1">Nome do Modelo</label><input type="text" id="nomeModelo" value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} placeholder="Ex: Contrato Padrão - Financiamento" className="w-full p-2 border rounded-md" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Cláusulas do Contrato</label><div className="border rounded-md overflow-hidden h-[55vh] flex flex-col">{editor && <MenuBar editor={editor} />}<EditorContent editor={editor} className="p-3 flex-grow overflow-y-auto prose max-w-none prose-sm editor-styles" /></div></div></div>
                 <style jsx global>{`.editor-styles .ProseMirror { min-height: 100%; outline: none; } .editor-styles p { margin-bottom: 0.5rem; } .editor-styles ul, .editor-styles ol { padding-left: 1.5rem; margin-bottom: 0.5rem; }`}</style>
                <div className="flex justify-end gap-3 p-5 border-t sticky bottom-0 bg-gray-50 rounded-b-lg"><button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button><button type="button" onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">{isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : (modeloToEdit ? 'Salvar Alterações' : 'Criar Modelo')}</button></div>
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
            <div className="flex justify-between items-center"><h2 className="text-2xl font-semibold text-gray-800">Modelos de Contrato</h2><button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 flex items-center gap-2"><FontAwesomeIcon icon={faPlus} /> Adicionar Novo Modelo</button></div>
            {modelos.length === 0 ? (<p className="text-center text-gray-500 py-6">Nenhum modelo de contrato cadastrado para este empreendimento.</p>) : (<div className="border rounded-lg overflow-hidden"><ul className="divide-y">{modelos.map(modelo => (<li key={modelo.id} className="p-4 flex justify-between items-center hover:bg-gray-50"><span className="font-medium text-gray-800">{modelo.nome_modelo}</span><div className="flex items-center gap-4"><button onClick={() => handleOpenModal(modelo)} className="text-blue-600 hover:text-blue-800" title="Editar"><FontAwesomeIcon icon={faPen} /></button><button onClick={() => handleDeleteModelo(modelo)} disabled={deleteMutation.isPending} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button></div></li>))}</ul></div>)}
            <ModalModeloContrato isOpen={isModalOpen} onClose={handleCloseModal} modeloToEdit={modeloToEdit} empreendimentoId={empreendimentoId} organizacaoId={organizacaoId} onSaveSuccess={() => {}} />
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
        toast.promise( new Promise(async (resolve, reject) => {
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

    // TabButton (sem mudanças)
    const TabButton = ({ tabId, label }) => (
        <button onClick={() => setActiveTab(tabId)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${ activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`}>{label}</button>
    );

    return (
        <div className="p-6 bg-white shadow-md rounded-lg">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 gap-4">
                 <h1 className="text-3xl font-bold text-gray-800">{empreendimento.nome}</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleGerarResumo} disabled={isGeneratingSummary} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400"><FontAwesomeIcon icon={isGeneratingSummary ? faSpinner : faWandMagicSparkles} className={`mr-2 ${isGeneratingSummary ? 'animate-spin' : ''}`} />{isGeneratingSummary ? 'Gerando...' : 'Gerar Resumo com IA'}</button>
                    <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">Editar Empreendimento</Link>
                </div>
            </div>

            {/* Resumo IA */}
            {summary && (<div className="mb-6 p-4 border border-purple-200 bg-purple-50 rounded-lg animate-fade-in"><h3 className="text-lg font-semibold text-purple-800 mb-2">Resumo Gerado pela Stella</h3><div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br />') }}/></div>)}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"><KpiCard title="Status Atual" value={empreendimento.status || 'N/A'} icon={faBuilding} /><KpiCard title="Total de Unidades" value={kpiData.totalUnidades} icon={faBoxOpen} /><KpiCard title="Unidades Vendidas" value={kpiData.unidadesVendidas} icon={faBoxOpen} colorClass="text-green-500" /><KpiCard title="VGV Total" value={kpiData.vgvTotal} icon={faRulerCombined} /></div>

            {/* Barra de Abas */}
            <div className="border-b border-gray-200 mb-6"><nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs"><TabButton tabId="dados_gerais" label="Dados Gerais" /><TabButton tabId="produtos" label="Produtos" /><TabButton tabId="gerenciamento_contratos" label="Gerenciamento de Contratos" /><TabButton tabId="documentos_juridicos" label="Documentos Jurídicos" /><TabButton tabId="documentos_gerais" label="Documentos Gerais" /><TabButton tabId="marketing" label="Marketing" /></nav></div>

            {/* Conteúdo das Abas */}
            <div>
                {activeTab === 'dados_gerais' && (<div className="space-y-8 animate-fade-in"><div><h2 className="text-2xl font-semibold text-gray-800 mb-4">Dados do Empreendimento</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><InfoField label="Nome Fantasia" value={empreendimento.nome} /><InfoField label="Nome Oficial (Cartório)" value={empreendimento.nome_empreendimento} /><InfoField label="Status" value={empreendimento.status} /><InfoField label="Empresa Proprietária" value={proprietaria ? (proprietaria.nome_fantasia || proprietaria.razao_social) : 'N/A'} /><InfoField label="Incorporadora" value={incorporadora ? `${incorporadora.nome || incorporadora.razao_social}` : 'N/A'} /><InfoField label="Construtora" value={construtora ? `${construtora.nome || construtora.razao_social}` : 'N/A'} /><InfoField label="Data de Início" value={empreendimento.data_inicio} /><InfoField label="Data Fim Prevista" value={empreendimento.data_fim_prevista} /><InfoField label="Prazo de Entrega" value={empreendimento.prazo_entrega} /><InfoField label="Valor Total" value={formattedValorTotal} /><InfoField label="Número da Matrícula" value={empreendimento.matricula_numero} /><InfoField label="Cartório da Matrícula" value={empreendimento.matricula_cartorio} /><InfoField label="Índice de Reajuste" value={empreendimento.indice_reajuste} /></div></div><div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Endereço</h3><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"><InfoField label="CEP" value={empreendimento.cep} /><InfoField label="Rua" value={empreendimento.address_street} /><InfoField label="Número" value={empreendimento.address_number} /><InfoField label="Complemento" value={empreendimento.address_complement} /><InfoField label="Bairro" value={empreendimento.neighborhood} /><InfoField label="Cidade" value={empreendimento.city} /><InfoField label="Estado" value={empreendimento.state} /></div></div><div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Características Construtivas</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><InfoField label="Área Total do Terreno" value={formattedTerrenoAreaTotal} /><InfoField label="Tipo de Estrutura" value={empreendimento.estrutura_tipo} /><InfoField label="Tipo de Alvenaria" value={empreendimento.alvenaria_tipo} /><InfoField label="Detalhes da Cobertura" value={empreendimento.cobertura_detalhes} fullWidth={true}/></div></div>{initialQuadroDeAreas && initialQuadroDeAreas.length > 0 && (<div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Quadro de Áreas</h3><table className="min-w-full bg-white border rounded-lg"><thead className="bg-gray-100"><tr><th className="py-2 px-4 text-left text-sm font-semibold">Pavimento</th><th className="py-2 px-4 text-right text-sm font-semibold">Área (m²)</th></tr></thead><tbody>{initialQuadroDeAreas.map((item) => (<tr key={item.id} className="border-t"><td className="py-2 px-4">{item.pavimento_nome}</td><td className="py-2 px-4 text-right">{item.area_m2} m²</td></tr>))}<tr className="bg-gray-100 font-bold"><td className="py-2 px-4 text-left">Total</td><td className="py-2 px-4 text-right">{initialQuadroDeAreas.reduce((sum, item) => sum + parseFloat(item.area_m2 || 0), 0).toFixed(2)} m²</td></tr></tbody></table></div>)}</div>)}
                
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
                {['documentos_juridicos', 'documentos_gerais', 'marketing'].includes(activeTab) && (
                    <div className="space-y-6 animate-fade-in">
                        {activeTab === 'documentos_juridicos' && (<> <AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="juridico" organizacaoId={organizacaoId} /> <ListaAnexos anexos={anexos.filter(a => a.categoria_aba === 'juridico')} onDelete={handleDeleteAnexo} onToggleCorretor={toggleCorretorVisibility} isToggling={isToggling}/> </>)}
                        {activeTab === 'documentos_gerais' && (<> <AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="geral" organizacaoId={organizacaoId} /> <ListaAnexos anexos={anexos.filter(a => a.categoria_aba === 'geral')} onDelete={handleDeleteAnexo} onToggleCorretor={toggleCorretorVisibility} isToggling={isToggling}/> </>)}
                        {activeTab === 'marketing' && (<> <AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="marketing" organizacaoId={organizacaoId} /> <GaleriaMarketing anexos={anexos.filter(a => a.categoria_aba === 'marketing')} onDelete={handleDeleteAnexo} onToggleCorretor={toggleCorretorVisibility} isToggling={isToggling}/> </>)}
                    </div>
                )}
            </div>
        </div>
    );
}