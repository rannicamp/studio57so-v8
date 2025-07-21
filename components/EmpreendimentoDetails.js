'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faRulerCombined, faBoxOpen, faFileLines, faUpload, faSpinner, faTrash, faEye, faSort, faSortUp, faSortDown, faVideo } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';

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

const AnexoUploader = ({ empreendimentoId, allowedTipos, onUploadSuccess }) => {
    const supabase = createClient();
    const [file, setFile] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async () => {
        if (!file || !tipoId) {
            toast.error("Por favor, selecione um tipo de documento e um arquivo.");
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

            const { error: dbError } = await supabase.from('empreendimento_anexos').insert({
                empreendimento_id: empreendimentoId,
                caminho_arquivo: newFileName,
                nome_arquivo: file.name,
                descricao: descricao,
                tipo_documento_id: tipoId
            });
            if (dbError) return reject(dbError);

            resolve("Anexo enviado com sucesso!");
        });

        toast.promise(promise, {
            loading: 'Enviando arquivo...',
            success: (msg) => {
                onUploadSuccess();
                setFile(null);
                setDescricao('');
                setTipoId('');
                if(document.getElementById(`file-input-${tipoId}`)) {
                   document.getElementById(`file-input-${tipoId}`).value = "";
                }
                setIsUploading(false);
                return msg;
            },
            error: (err) => {
                setIsUploading(false);
                return `Erro: ${err.message}`;
            },
        });
    };

    return (
        <div className="p-4 bg-gray-50 border rounded-lg space-y-3">
            <h4 className="font-semibold text-gray-700">Adicionar Novo Documento</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="p-2 border rounded-md">
                    <option value="">-- Selecione o Tipo --</option>
                    {allowedTipos.map(t => <option key={t.id} value={t.id}>{t.descricao} ({t.sigla})</option>)}
                </select>
                <input type="text" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="p-2 border rounded-md" />
            </div>
            <div className="flex items-center gap-4">
                <input id={`file-input-${tipoId}`} type="file" onChange={(e) => setFile(e.target.files[0])} className="flex-grow text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"/>
                <button onClick={handleUpload} disabled={isUploading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                    {isUploading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Enviar'}
                </button>
            </div>
        </div>
    );
};

const TabelaVendas = ({ produtos, empreendimentoId }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'unidade', direction: 'ascending' });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
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
        const getSortIcon = () => {
            if (sortConfig.key !== sortKey) return faSort;
            return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
        };
        return (
            <th className={`py-3 px-4 text-sm font-semibold text-gray-600 ${className}`}>
                <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full">
                    <span>{label}</span>
                    <FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" />
                </button>
            </th>
        );
    };

    const formatCurrency = (value) => {
        if (value == null || isNaN(value)) return 'N/A';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value));
    };

    const statusColors = { 'Disponível': 'bg-green-100 text-green-800', 'Vendido': 'bg-red-100 text-red-800', 'Reservado': 'bg-yellow-100 text-yellow-800', 'Bloqueado': 'bg-gray-100 text-gray-800' };

    const tableSummary = useMemo(() => {
        const total = produtos.length;
        const disponiveis = produtos.filter(p => p.status === 'Disponível').length;
        const vendidos = produtos.filter(p => p.status === 'Vendido').length;
        const vgv = produtos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0);
        return { total, disponiveis, vendidos, vgv: formatCurrency(vgv) };
    }, [produtos]);

    if (!produtos || produtos.length === 0) {
        return (
            <div className="text-center p-6 bg-gray-50 rounded-lg">
                <p className="text-gray-600">Nenhum produto cadastrado para este empreendimento ainda.</p>
                <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                    Cadastrar Produtos
                </Link>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-800">Tabela de Vendas</h2>
                <Link href={`/empreendimentos/${empreendimentoId}/produtos`} className="text-blue-500 hover:underline font-semibold">
                    Gerenciar Produtos e Condições &rarr;
                </Link>
            </div>
            <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                        <tr>
                            <SortableHeader label="Unidade" sortKey="unidade" className="text-left" />
                            <SortableHeader label="Tipo" sortKey="tipo" className="text-left" />
                            <SortableHeader label="Área Privativa" sortKey="area_privativa" className="text-right" />
                            <SortableHeader label="Status" sortKey="status" className="text-center" />
                            <SortableHeader label="Valor de Venda" sortKey="valor_venda_calculado" className="text-right" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sortedProdutos.map(produto => (
                            <tr key={produto.id} className="hover:bg-gray-50">
                                <td className="py-3 px-4 font-medium">{produto.unidade}</td>
                                <td className="py-3 px-4 text-gray-600">{produto.tipo}</td>
                                <td className="py-3 px-4 text-right text-gray-600">{produto.area_privativa} m²</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[produto.status] || 'bg-gray-100 text-gray-800'}`}>
                                        {produto.status}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatCurrency(produto.valor_venda_calculado)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                        <tr>
                            <td colSpan="2" className="py-3 px-4 text-left">Total: {tableSummary.total} unidades</td>
                            <td className="py-3 px-4 text-right">Disponíveis: {tableSummary.disponiveis}</td>
                            <td className="py-3 px-4 text-center">Vendidos: {tableSummary.vendidos}</td>
                            <td className="py-3 px-4 text-right">VGV Total: {tableSummary.vgv}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

export default function EmpreendimentoDetails({ empreendimento, corporateEntities = [], proprietariaOptions = [], produtos = [], initialAnexos, documentoTipos, initialQuadroDeAreas }) {
  const [activeTab, setActiveTab] = useState('dados_gerais');
  const supabase = createClient();
  const router = useRouter();

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
  
  const handleDeleteAnexo = async (anexo) => {
      if (!window.confirm(`Tem certeza que deseja excluir o anexo "${anexo.nome_arquivo}"?`)) return;
      
      toast.promise(
          new Promise(async (resolve, reject) => {
              const { error: storageError } = await supabase.storage.from('empreendimento-anexos').remove([anexo.caminho_arquivo]);
              if (storageError) return reject(storageError);
              const { error: dbError } = await supabase.from('empreendimento_anexos').delete().eq('id', anexo.id);
              if (dbError) return reject(dbError);
              resolve("Anexo excluído com sucesso!");
          }),
          {
              loading: 'Excluindo...',
              success: (msg) => { router.refresh(); return msg; },
              error: (err) => `Erro ao excluir: ${err.message}`,
          }
      );
  };
  
  const getAnexosPorCategoria = (siglas) => initialAnexos.filter(anexo => anexo.tipo && siglas.includes(anexo.tipo.sigla.toUpperCase()));

  const incorporadora = useMemo(() => corporateEntities.find(e => e.id === empreendimento.incorporadora_id), [corporateEntities, empreendimento.incorporadora_id]);
  const construtora = useMemo(() => corporateEntities.find(e => e.id === empreendimento.construtora_id), [corporateEntities, empreendimento.construtora_id]);
  const proprietaria = useMemo(() => proprietariaOptions.find(p => p.id === empreendimento.empresa_proprietaria_id), [proprietariaOptions, empreendimento.empresa_proprietaria_id]);
  const formattedValorTotal = useMemo(() => empreendimento.valor_total ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(empreendimento.valor_total)) : 'N/A', [empreendimento.valor_total]);
  const formattedTerrenoAreaTotal = useMemo(() => empreendimento.terreno_area_total ? `${empreendimento.terreno_area_total} m²` : 'N/A', [empreendimento.terreno_area_total]);

  return (
    <div className="p-6 bg-white shadow-md rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">{empreendimento.nome}</h1>
        <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
          Editar Empreendimento
        </Link>
      </div>

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
                {activeTab === 'documentos_juridicos' && <><AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={() => router.refresh()} /><ListaAnexos anexos={getAnexosPorCategoria(['JURIDICAL', 'MINUTA', 'CONTRATO', 'REGISTRO', 'ESCRITURA', 'MATRICULA'])} onDelete={handleDeleteAnexo} /></>}
                {activeTab === 'documentos_gerais' && <><AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={() => router.refresh()} /><ListaAnexos anexos={getAnexosPorCategoria(['GENERAL', 'PROJETO', 'RRT', 'CNO', 'ART', 'ALVARA', 'HABITE-SE', 'AVCB', 'LAUDO', 'CERTIDAO'])} onDelete={handleDeleteAnexo} /></>}
                {activeTab === 'marketing' && <><AnexoUploader empreendimentoId={empreendimento.id} allowedTipos={documentoTipos} onUploadSuccess={() => router.refresh()} /><GaleriaMarketing anexos={getAnexosPorCategoria(['FOTOS', 'IMAGEM', 'VIDEO'])} onDelete={handleDeleteAnexo} /></>}
            </div>
        )}
      </div>
    </div>
  );
}

const ListaAnexos = ({ anexos, onDelete }) => {
    if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4">Nenhum documento nesta categoria.</p>;
    return (
        <ul className="space-y-2">
            {anexos.map(anexo => (<li key={anexo.id} className="bg-white p-3 rounded-md border flex items-center justify-between gap-4"><div className="flex items-center gap-3"><FontAwesomeIcon icon={faFileLines} className="text-xl text-gray-500" /><div><p className="font-medium text-gray-800">{anexo.nome_arquivo}</p><p className="text-xs text-gray-500">{anexo.descricao || anexo.tipo?.descricao}</p></div></div><div className="flex items-center gap-4"><a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Visualizar"><FontAwesomeIcon icon={faEye} /></a><button onClick={() => onDelete(anexo)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button></div></li>))}
        </ul>
    );
};

const GaleriaMarketing = ({ anexos, onDelete }) => {
    if (!anexos || anexos.length === 0) return <p className="text-center text-gray-500 py-4">Nenhum item de marketing encontrado.</p>;
    const isVideo = (path) => /\.(mp4|webm|ogg)$/i.test(path || '');
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {anexos.map(anexo => (<div key={anexo.id} className="relative group rounded-lg overflow-hidden shadow-lg border">{isVideo(anexo.caminho_arquivo) ? (<video controls src={anexo.public_url} className="w-full h-48 object-cover bg-black">Seu navegador não suporta o elemento de vídeo.</video>) : (anexo.public_url && <img src={anexo.public_url} alt={anexo.nome_arquivo} className="w-full h-48 object-cover"/>)}<div className="absolute top-0 right-0 p-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="bg-black/50 text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-black/80"><FontAwesomeIcon icon={faEye} /></a><button onClick={() => onDelete(anexo)} className="bg-black/50 text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-black/80"><FontAwesomeIcon icon={faTrash} /></button></div>{(anexo.descricao || anexo.tipo?.descricao) && (<div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">{anexo.descricao || anexo.tipo.descricao}</div>)}</div>))}
        </div>
    );
};