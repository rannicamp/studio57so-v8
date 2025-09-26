// components/EmpreendimentoDetails.js

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// ---> ALTERADO <--- Adicionamos os ícones de link e download
import { faBuilding, faRulerCombined, faBoxOpen, faFileLines, faUpload, faSpinner, faTrash, faEye, faSort, faSortUp, faSortDown, faCloudUploadAlt, faWandMagicSparkles, faLink, faDownload } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

// --- SUB-COMPONENTES ---

function InfoField({ label, value, fullWidth = false }) {
  // ... (código existente sem alteração)
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={fullWidth ? "md:col-span-3" : ""}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function KpiCard({ title, value, icon, colorClass = 'text-blue-500' }) {
    // ... (código existente sem alteração)
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
    // ... (código existente sem alteração)
    const supabase = createClient();
    const [file, setFile] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef(null);
    const handleFileSelect = (selectedFile) => { if (selectedFile) setFile(selectedFile); };
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
                organizacao_id: organizacaoId
            }).select().single();

            if (dbError) return reject(dbError);
            fetch('/api/empreendimentos/process-anexo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anexoId: data.id }) }).catch(err => console.error("Erro ao chamar API de processamento da IA:", err));
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

const TabelaVendas = ({ produtos, empreendimentoId }) => {
    // ... (código existente sem alteração)
    const [sortConfig, setSortConfig] = useState({ key: 'unidade', direction: 'ascending' });
    const requestSort = (key) => { let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } setSortConfig({ key, direction }); };
    const sortedProdutos = useMemo(() => { let sortableItems = [...produtos]; if (sortConfig.key !== null) { sortableItems.sort((a, b) => { const valA = a[sortConfig.key]; const valB = b[sortConfig.key]; if (valA === null || valA === undefined) return 1; if (valB === null || valB === undefined) return -1; if (sortConfig.key === 'valor_venda_calculado' || sortConfig.key === 'area_privativa') { const numA = parseFloat(valA) || 0; const numB = parseFloat(valB) || 0; return sortConfig.direction === 'ascending' ? numA - numB : numB - numA; } if (String(valA).toLowerCase() < String(valB).toLowerCase()) { return sortConfig.direction === 'ascending' ? -1 : 1; } if (String(valA).toLowerCase() > String(valB).toLowerCase()) { return sortConfig.direction === 'ascending' ? 1 : -1; } return 0; }); } return sortableItems; }, [produtos, sortConfig]);
    const SortableHeader = ({ label, sortKey, className = '' }) => { const getSortIcon = () => { if (sortConfig.key !== sortKey) return faSort; return sortConfig.direction === 'ascending' ? faSortUp : faSortDown; }; return ( <th className={`py-3 px-4 text-sm font-semibold text-gray-600 ${className}`}> <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full"> <span>{label}</span> <FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" /> </button> </th> ); };
    const formatCurrency = (value) => { if (value == null || isNaN(value)) return 'N/A'; return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value)); };
    const statusColors = { 'Disponível': 'bg-green-100 text-green-800', 'Vendido': 'bg-red-100 text-red-800', 'Reservado': 'bg-yellow-100 text-yellow-800', 'Bloqueado': 'bg-gray-100 text-gray-800' };
    const tableSummary = useMemo(() => { const total = produtos.length; const disponiveis = produtos.filter(p => p.status === 'Disponível').length; const vendidos = produtos.filter(p => p.status === 'Vendido').length; const vgv = produtos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0); return { total, disponiveis, vendidos, vgv: formatCurrency(vgv) }; }, [produtos]);
    if (!produtos || produtos.length === 0) { return ( <div className="text-center p-6 bg-gray-50 rounded-lg"> <p className="text-gray-600">Nenhum produto cadastrado para este empreendimento ainda.</p> <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"> Cadastrar Produtos </Link> </div> ); }
    return ( <div className="animate-fade-in"> <div className="flex justify-between items-center mb-4"> <h2 className="text-2xl font-semibold text-gray-800">Tabela de Vendas</h2> <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="text-blue-500 hover:underline font-semibold"> Gerenciar Produtos e Condições &rarr; </Link> </div> <div className="overflow-x-auto shadow-md rounded-lg"> <table className="min-w-full bg-white"> <thead className="bg-gray-100"> <tr> <SortableHeader label="Unidade" sortKey="unidade" className="text-left" /> <SortableHeader label="Tipo" sortKey="tipo" className="text-left" /> <SortableHeader label="Área Privativa" sortKey="area_privativa" className="text-right" /> <SortableHeader label="Status" sortKey="status" className="text-center" /> <SortableHeader label="Valor de Venda" sortKey="valor_venda_calculado" className="text-right" /> </tr> </thead> <tbody className="divide-y divide-gray-200"> {sortedProdutos.map(produto => ( <tr key={produto.id} className="hover:bg-gray-50"> <td className="py-3 px-4 font-medium">{produto.unidade}</td> <td className="py-3 px-4 text-gray-600">{produto.tipo}</td> <td className="py-3 px-4 text-right text-gray-600">{produto.area_privativa} m²</td> <td className="py-3 px-4 text-center"> <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[produto.status] || 'bg-gray-100 text-gray-800'}`}> {produto.status} </span> </td> <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatCurrency(produto.valor_venda_calculado)}</td> </tr> ))} </tbody> <tfoot className="bg-gray-100 font-bold"> <tr> <td colSpan="2" className="py-3 px-4 text-left">Total: {tableSummary.total} unidades</td> <td className="py-3 px-4 text-right">Disponíveis: {tableSummary.disponiveis}</td> <td className="py-3 px-4 text-center">Vendidos: {tableSummary.vendidos}</td> <td className="py-3 px-4 text-right">VGV Total: {tableSummary.vgv}</td> </tr> </tfoot> </table> </div> </div> );
};

const ListaAnexos = ({ anexos, onDelete }) => {
    // ... (código existente sem alteração)
    if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4 mt-4">Nenhum documento nesta categoria.</p>;
    return ( <div className="space-y-3 mt-4"> {anexos.map(anexo => (<div key={anexo.id} className="bg-white p-3 rounded-md border flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"><div className="flex items-center gap-4 min-w-0"><FontAwesomeIcon icon={faFileLines} className="text-xl text-gray-500 flex-shrink-0" /><div className="flex-grow min-w-0"><p className="font-medium text-gray-800 truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p><p className="text-xs text-gray-500">{anexo.descricao || anexo.tipo?.descricao || 'Sem descrição'}</p></div></div><div className="flex items-center gap-4 flex-shrink-0"><a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Visualizar"><FontAwesomeIcon icon={faEye} /></a><button onClick={() => onDelete(anexo.id)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button></div></div>))} </div> );
};

// ---> ALTERADO <--- Todo o componente GaleriaMarketing foi atualizado
const GaleriaMarketing = ({ anexos, onDelete }) => {
    const supabase = createClient();

    if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4 mt-4">Nenhum item de marketing encontrado.</p>;

    const isVideo = (path) => /\.(mp4|webm|ogg)$/i.test(path || '');

    // ---> NOVO <--- Função para gerar e copiar o link público
    const handleGeneratePublicLink = async (filePath) => {
        if (!filePath) {
            toast.error("Arquivo não encontrado.");
            return;
        }
        
        // Pega a URL pública permanente do arquivo
        const { data } = supabase.storage.from('empreendimento-anexos').getPublicUrl(filePath);

        if (data?.publicUrl) {
            try {
                // Tenta copiar o link para a área de transferência do usuário
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {anexos.map(anexo => (
                <div key={anexo.id} className="relative group rounded-lg overflow-hidden shadow-lg border">
                    {isVideo(anexo.caminho_arquivo) ? (
                        <video controls src={anexo.public_url} className="w-full h-48 object-cover bg-black">Seu navegador não suporta o elemento de vídeo.</video>
                    ) : (
                        anexo.public_url && <img src={anexo.public_url} alt={anexo.nome_arquivo} className="w-full h-48 object-cover"/>
                    )}
                    
                    {/* ---> ALTERADO <--- Adicionamos os novos botões aqui */}
                    <div className="absolute top-0 right-0 p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Botão de Download */}
                        <a 
                           href={anexo.public_url} 
                           download={anexo.nome_arquivo} // Força o download com o nome original do arquivo
                           title="Baixar"
                           className="bg-black/50 text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-black/80">
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                        
                        {/* Botão para Gerar Link Público */}
                        <button 
                           onClick={() => handleGeneratePublicLink(anexo.caminho_arquivo)}
                           title="Copiar link público"
                           className="bg-black/50 text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-black/80">
                            <FontAwesomeIcon icon={faLink} />
                        </button>

                        {/* Botões existentes */}
                        <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" title="Visualizar" className="bg-black/50 text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-black/80">
                            <FontAwesomeIcon icon={faEye} />
                        </a>
                        <button onClick={() => onDelete(anexo.id)} title="Excluir" className="bg-black/50 text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-black/80">
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </div>

                    {(anexo.descricao || anexo.tipo?.descricao) && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate" title={anexo.descricao || anexo.tipo.descricao}>
                            {anexo.descricao || anexo.tipo.descricao}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---

export default function EmpreendimentoDetails({ empreendimento, corporateEntities = [], proprietariaOptions = [], produtos = [], initialAnexos, documentoTipos, initialQuadroDeAreas, organizacaoId }) {
    // ... (resto do código do componente principal sem alteração)
    const [activeTab, setActiveTab] = useState('dados_gerais');
    const [anexos, setAnexos] = useState(initialAnexos);
    const supabase = createClient();
    const router = useRouter();

    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [summary, setSummary] = useState('');

    const handleGerarResumo = async () => {
        setIsGeneratingSummary(true);
        setSummary(''); 
        toast.info("A Stella começou a trabalhar... Isso pode levar um minuto.");

        try {
            const response = await fetch('/api/empreendimentos/gerar-resumo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empreendimentoId: empreendimento.id })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "A IA não conseguiu gerar o resumo.");
            }

            const data = await response.json();
            setSummary(data.summary);
            toast.success("Resumo gerado com sucesso!");

        } catch (error) {
            toast.error(`Erro: ${error.message}`);
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    useEffect(() => { setAnexos(initialAnexos); }, [initialAnexos]);

    const kpiData = useMemo(() => {
        const totalUnidades = produtos ? produtos.length : 0;
        const unidadesVendidas = produtos ? produtos.filter(p => p.status === 'Vendido').length : 0;
        const vgvTotal = produtos ? produtos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0) : 0;
        return {
        totalUnidades,
        unidadesVendidas,
        vgvTotal: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vgvTotal),
        };
    }, [produtos]);
    
    const handleDeleteAnexo = async (anexoId) => {
        const anexoToDelete = anexos.find(a => a.id === anexoId);
        if (!anexoToDelete || !window.confirm(`Tem certeza que deseja excluir o anexo "${anexoToDelete.nome_arquivo}"?`)) return;
        
        toast.promise(
            new Promise(async (resolve, reject) => {
                const { error: storageError } = await supabase.storage.from('empreendimento-anexos').remove([anexoToDelete.caminho_arquivo]);
                if (storageError && storageError.statusCode !== '404') return reject(storageError);
                
                const { error: dbError } = await supabase.from('empreendimento_anexos').delete().eq('id', anexoId);
                if (dbError) return reject(dbError);
                
                resolve("Anexo excluído com sucesso!");
            }),
            {
                loading: 'Excluindo...',
                success: (msg) => { 
                    setAnexos(currentAnexos => currentAnexos.filter(a => a.id !== anexoId));
                    return msg; 
                },
                error: (err) => `Erro ao excluir: ${err.message}`,
            }
        );
    };
    
    const incorporadora = useMemo(() => corporateEntities.find(e => e.id === empreendimento.incorporadora_id), [corporateEntities, empreendimento.incorporadora_id]);
    const construtora = useMemo(() => corporateEntities.find(e => e.id === empreendimento.construtora_id), [corporateEntities, empreendimento.construtora_id]);
    const proprietaria = useMemo(() => proprietariaOptions.find(p => p.id === empreendimento.empresa_proprietaria_id), [proprietariaOptions, empreendimento.empresa_proprietaria_id]);
    const formattedValorTotal = useMemo(() => empreendimento.valor_total ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(empreendimento.valor_total)) : 'N/A', [empreendimento.valor_total]);
    const formattedTerrenoAreaTotal = useMemo(() => empreendimento.terreno_area_total ? `${empreendimento.terreno_area_total} m²` : 'N/A', [empreendimento.terreno_area_total]);

    const handleUploadSuccess = async (newAnexoData) => {
        const { data } = await supabase.storage.from('empreendimento-anexos').createSignedUrl(newAnexoData.caminho_arquivo, 3600);
        const anexoCompleto = {
            ...newAnexoData,
            public_url: data?.signedUrl,
            tipo: documentoTipos.find(t => t.id === newAnexoData.tipo_documento_id)
        };
        setAnexos(currentAnexos => [...currentAnexos, anexoCompleto]);
    };

    return (
        <div className="p-6 bg-white shadow-md rounded-lg">
        <div className="flex justify-between items-start mb-6 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">{empreendimento.nome}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={handleGerarResumo}
                    disabled={isGeneratingSummary}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400"
                >
                    <FontAwesomeIcon icon={isGeneratingSummary ? faSpinner : faWandMagicSparkles} className={`mr-2 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                    {isGeneratingSummary ? 'Gerando...' : 'Gerar Resumo com IA'}
                </button>
                <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                    Editar Empreendimento
                </Link>
            </div>
        </div>
        
        {summary && (
            <div className="mb-6 p-4 border border-purple-200 bg-purple-50 rounded-lg animate-fade-in">
                <h3 className="text-lg font-semibold text-purple-800 mb-2">Resumo Gerado pela Stella</h3>
                <div 
                    className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br />') }}
                />
            </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard title="Status Atual" value={empreendimento.status || 'N/A'} icon={faBuilding} />
            <KpiCard title="Total de Unidades" value={kpiData.totalUnidades} icon={faBoxOpen} />
            <KpiCard title="Unidades Vendidas" value={kpiData.unidadesVendidas} icon={faBoxOpen} colorClass="text-green-500" />
            <KpiCard title="VGV Total" value={kpiData.vgvTotal} icon={faRulerCombined} />
        </div>

        <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button onClick={() => setActiveTab('dados_gerais')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'dados_gerais' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Dados Gerais</button>
            <button onClick={() => setActiveTab('produtos')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'produtos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Produtos</button>
            <button onClick={() => setActiveTab('documentos_juridicos')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'documentos_juridicos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Documentos Jurídicos</button>
            <button onClick={() => setActiveTab('documentos_gerais')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'documentos_gerais' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Documentos Gerais</button>
            <button onClick={() => setActiveTab('marketing')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'marketing' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Marketing</button>
            </nav>
        </div>

        <div>
            {activeTab === 'dados_gerais' && (
            <div className="space-y-8 animate-fade-in">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Dados do Empreendimento</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <InfoField label="Nome Fantasia" value={empreendimento.nome} />
                        <InfoField label="Nome Oficial (Cartório)" value={empreendimento.nome_empreendimento} />
                        <InfoField label="Status" value={empreendimento.status} />
                        <InfoField label="Empresa Proprietária" value={proprietaria ? (proprietaria.nome_fantasia || proprietaria.razao_social) : 'N/A'} />
                        <InfoField label="Incorporadora" value={incorporadora ? `${incorporadora.nome || incorporadora.razao_social}` : 'N/A'} />
                        <InfoField label="Construtora" value={construtora ? `${construtora.nome || construtora.razao_social}` : 'N/A'} />
                        <InfoField label="Data de Início" value={empreendimento.data_inicio} />
                        <InfoField label="Data Fim Prevista" value={empreendimento.data_fim_prevista} />
                        <InfoField label="Prazo de Entrega" value={empreendimento.prazo_entrega} />
                        <InfoField label="Valor Total" value={formattedValorTotal} />
                        <InfoField label="Número da Matrícula" value={empreendimento.matricula_numero} />
                        <InfoField label="Cartório da Matrícula" value={empreendimento.matricula_cartorio} />
                        <InfoField label="Índice de Reajuste" value={empreendimento.indice_reajuste} />
                    </div>
                </div>
                
                <div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Endereço</h3><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"><InfoField label="CEP" value={empreendimento.cep} /><InfoField label="Rua" value={empreendimento.address_street} /><InfoField label="Número" value={empreendimento.address_number} /><InfoField label="Complemento" value={empreendimento.address_complement} /><InfoField label="Bairro" value={empreendimento.neighborhood} /><InfoField label="Cidade" value={empreendimento.city} /><InfoField label="Estado" value={empreendimento.state} /></div></div>
                <div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Características Construtivas</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><InfoField label="Área Total do Terreno" value={formattedTerrenoAreaTotal} /><InfoField label="Tipo de Estrutura" value={empreendimento.estrutura_tipo} /><InfoField label="Tipo de Alvenaria" value={empreendimento.alvenaria_tipo} /><InfoField label="Detalhes da Cobertura" value={empreendimento.cobertura_detalhes} fullWidth={true}/></div></div>
                {initialQuadroDeAreas && initialQuadroDeAreas.length > 0 && (
                <div className="pt-6 border-t"><h3 className="text-xl font-semibold text-gray-800 mb-4">Quadro de Áreas</h3><table className="min-w-full bg-white border rounded-lg"><thead className="bg-gray-100"><tr><th className="py-2 px-4 text-left text-sm font-semibold">Pavimento</th><th className="py-2 px-4 text-right text-sm font-semibold">Área (m²)</th></tr></thead><tbody>{initialQuadroDeAreas.map((item) => (<tr key={item.id} className="border-t"><td className="py-2 px-4">{item.pavimento_nome}</td><td className="py-2 px-4 text-right">{item.area_m2} m²</td></tr>))}<tr className="bg-gray-100 font-bold"><td className="py-2 px-4 text-left">Total</td><td className="py-2 px-4 text-right">{initialQuadroDeAreas.reduce((sum, item) => sum + parseFloat(item.area_m2 || 0), 0).toFixed(2)} m²</td></tr></tbody></table></div>
                )}
            </div>
            )}

            {activeTab === 'produtos' && <TabelaVendas produtos={produtos} empreendimentoId={empreendimento.id} />}
            
            {['documentos_juridicos', 'documentos_gerais', 'marketing'].includes(activeTab) && (
                <div className="space-y-6 animate-fade-in">
                    {activeTab === 'documentos_juridicos' && (
                        <>
                            <AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="juridico" organizacaoId={organizacaoId} />
                            <ListaAnexos anexos={anexos.filter(a => a.categoria_aba === 'juridico')} onDelete={handleDeleteAnexo} />
                        </>
                    )}
                    {activeTab === 'documentos_gerais' && (
                        <>
                            <AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="geral" organizacaoId={organizacaoId} />
                            <ListaAnexos anexos={anexos.filter(a => a.categoria_aba === 'geral')} onDelete={handleDeleteAnexo} />
                        </>
                    )}
                    {activeTab === 'marketing' && (
                        <>
                            <AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={handleUploadSuccess} categoria="marketing" organizacaoId={organizacaoId} />
                            <GaleriaMarketing anexos={anexos.filter(a => a.categoria_aba === 'marketing')} onDelete={handleDeleteAnexo} />
                        </>
                    )}
                </div>
            )}
        </div>
        </div>
    );
}