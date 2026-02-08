// app/(corretor)/portal-arquivos/page.js
'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { useLayout } from '@/contexts/LayoutContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSpinner, faFolderBlank, faFilePdf, faFileImage, faFileArchive,
  faFileAlt, faDownload, faFolderOpen, faEye, faFileVideo, faLink,
  faSearch, faFilter, faTimes,
} from '@fortawesome/free-solid-svg-icons'
import { toast } from 'sonner'
import Image from 'next/image'
import { useDebounce } from 'use-debounce'

// 1. Função de busca de dados (AGORA COM FILTRO DE LISTAGEM)
async function fetchArquivosCorretor(organizacaoId, searchTerm, empreendimentoId) {
  if (!organizacaoId) return []
  const supabase = await createClient()

  let query = supabase
    .from('empreendimento_anexos')
    .select(
      `
      id,
      nome_arquivo,
      caminho_arquivo,
      created_at,
      empreendimento_id,
      empreendimentos!inner ( nome ),
      tipo:documento_tipos ( sigla, nome:descricao ),
      thumbnail_url
    `
    )
    .eq('organizacao_id', organizacaoId)
    .eq('disponivel_corretor', true)
    // --- O FILTRO MÁGICO ADICIONADO AQUI ---
    // Garante que só traga arquivos de obras listadas para venda
    .eq('empreendimentos.listado_para_venda', true)

  // Filtro de Busca
  if (searchTerm) {
    query = query.or(`nome_arquivo.ilike.%${searchTerm}%,empreendimentos.nome.ilike.%${searchTerm}%`, { referencedTable: 'empreendimentos' })
  }

  // Filtro de Empreendimento Específico
  if (empreendimentoId) {
    query = query.eq('empreendimento_id', empreendimentoId)
  }

  // Ordenação
  query = query.order('nome', { foreignTable: 'empreendimentos', ascending: true })
            .order('nome_arquivo', { ascending: true })

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Adiciona a URL pública
  const anexosComUrl = (data || []).map((anexo) => {
    const { data: urlData } = supabase.storage
      .from('empreendimento-anexos')
      .getPublicUrl(anexo.caminho_arquivo)
    return { ...anexo, public_url: urlData?.publicUrl }
  })

  return anexosComUrl
}

// Função para buscar empreendimentos do corretor (Para o Dropdown)
async function fetchEmpreendimentosCorretor(organizacaoId) {
    if (!organizacaoId) return [];
    const supabase = await createClient();
    // Nota: Mantivemos o RPC aqui pois ele provavelmente já filtra os que têm anexos.
    // Se quiser filtrar o dropdown também por 'listado_para_venda', o ideal seria ajustar o RPC no banco
    // ou filtrar o resultado aqui. Por enquanto, filtrar os arquivos (acima) já resolve o problema visual.
    const { data, error } = await supabase.rpc('get_empreendimentos_com_anexos_corretor', { org_id: organizacaoId });
    if (error) {
        console.error("Erro ao buscar empreendimentos:", error);
        return [];
    }
    return (data || []).sort((a, b) => a.nome.localeCompare(b.nome));
}


// 2. Componente da Página
export default function ArquivosCorretorPage() {
  const { user, isUserLoading } = useLayout()
  const organizacaoId = user?.organizacao_id
  const [downloadingId, setDownloadingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

  const { data: empreendimentosOptions = [], isLoading: isLoadingEmpreendimentos } = useQuery({
      queryKey: ['empreendimentosCorretor', organizacaoId],
      queryFn: () => fetchEmpreendimentosCorretor(organizacaoId),
      enabled: !!organizacaoId,
  });

  const {
    data: arquivos,
    isLoading: isLoadingArquivos,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['arquivosCorretor', organizacaoId, debouncedSearchTerm, selectedEmpreendimento],
    queryFn: () => fetchArquivosCorretor(organizacaoId, debouncedSearchTerm, selectedEmpreendimento),
    enabled: !!organizacaoId,
  })

  const prevIsFetchingRef = useRef(false)
  useEffect(() => {
    if (!isLoadingArquivos && prevIsFetchingRef.current && !isFetching && !isError) {
      toast.info('Lista de arquivos atualizada.')
    }
    prevIsFetchingRef.current = isFetching
  }, [isFetching, isLoadingArquivos, isError])

  const arquivosAgrupados = useMemo(() => {
    if (!arquivos) return {}
    return arquivos.reduce((acc, anexo) => {
      const empId = anexo.empreendimento_id
      const empNome = anexo.empreendimentos?.nome || 'Empreendimento não identificado'
      if (!acc[empId]) acc[empId] = { nome: empNome, arquivos: [] }
      acc[empId].arquivos.push(anexo)
      return acc
    }, {})
  }, [arquivos])

  const handleDownload = (anexo) => {
    if (downloadingId === anexo.id) return
    if (!anexo.public_url) { toast.error('Erro URL.'); return; }
    setDownloadingId(anexo.id)
    toast.loading('Iniciando...', { id: `d-${anexo.id}` })
    try {
        const link = document.createElement('a'); link.href = anexo.public_url; link.target = '_blank';
        link.setAttribute('download', anexo.nome_arquivo || 'arquivo'); document.body.appendChild(link);
        link.click(); document.body.removeChild(link);
        toast.success('Iniciado!', { id: `d-${anexo.id}` })
    } catch (err) { console.error('Erro dl:', err); toast.error('Falha.', { id: `d-${anexo.id}` }); window.open(anexo.public_url, '_blank');
    } finally { setTimeout(() => setDownloadingId(null), 500); }
  }

  const isLoading = isUserLoading || isLoadingArquivos || isLoadingEmpreendimentos;

  if (isLoading) {
     return (<div className="flex justify-center items-center h-64"><FontAwesomeIcon icon={faSpinner} className="text-blue-500 text-4xl" spin /><p className="ml-4 text-gray-600">Carregando...</p></div>)
  }
  if (isError) {
    return (<div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"><strong className="font-bold">Erro!</strong><span className="block sm:inline"> {error?.message || 'Não foi possível carregar.'}</span></div>)
  }

  const empreendimentoIds = Object.keys(arquivosAgrupados)

  const getMediaType = (anexo) => {
    const fileName = anexo.nome_arquivo || '';
    if (/\.(mp4|webm|ogg)$/i.test(fileName)) return 'video';
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(fileName)) return 'image';
    if (/\.(pdf)$/i.test(fileName)) return 'pdf';
    return 'other';
  };

   const clearFilters = () => {
       setSearchTerm('');
       setSelectedEmpreendimento('');
   };

  return (
    <div className="max-w-full mx-auto space-y-8">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800"> Biblioteca de Arquivos </h1>
      </div>

      {/* Seção de Filtros */}
      <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                  <label htmlFor="search-term" className="block text-sm font-medium text-gray-700 mb-1">Buscar por nome</label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FontAwesomeIcon icon={faSearch} className="text-gray-400" /></div>
                      <input type="text" id="search-term" placeholder="Digite o nome do arquivo ou empreendimento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
                  </div>
              </div>
              <div>
                  <label htmlFor="empreendimento-filter" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Empreendimento</label>
                  <select id="empreendimento-filter" value={selectedEmpreendimento} onChange={(e) => setSelectedEmpreendimento(e.target.value)} className="w-full p-2 border rounded-md shadow-sm bg-white focus:ring-blue-500 focus:border-blue-500 h-[42px]">
                      <option value="">Todos os Empreendimentos</option>
                      {empreendimentosOptions.map(emp => (<option key={emp.id} value={emp.id}>{emp.nome}</option>))}
                  </select>
              </div>
          </div>
           {(searchTerm || selectedEmpreendimento) && (
             <div className="flex justify-end">
               <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"><FontAwesomeIcon icon={faTimes} /> Limpar Filtros</button>
             </div>
           )}
      </div>

      {/* Exibição dos Resultados */}
      {arquivos && arquivos.length === 0 ? (
         <div className="text-center py-10 bg-gray-50 rounded-lg">
            <div className="text-center">
             <FontAwesomeIcon icon={faFolderBlank} className="text-5xl text-gray-300 mb-4"/>
             <h3 className="text-lg font-semibold text-gray-700">Nenhum arquivo encontrado</h3>
             <p className="text-gray-500 text-sm mt-1">{searchTerm || selectedEmpreendimento ? "Ajuste os filtros ou verifique se há arquivos disponíveis." : "Nenhum arquivo disponível para as obras ativas."}</p>
           </div>
        </div>
      ) : (
        empreendimentoIds.map((empId) => {
          const grupo = arquivosAgrupados[empId]
          return (
            <section key={empId}>
              <h2 className="flex items-center gap-3 text-2xl font-semibold text-gray-700 border-b pb-2 mb-4">
                <FontAwesomeIcon icon={faFolderOpen} className="text-blue-500" />
                {grupo.nome}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                {grupo.arquivos.map((anexo) => {
                   const mediaType = getMediaType(anexo);
                   return (
                     <div key={anexo.id} className="relative group rounded-lg overflow-hidden shadow-md border bg-white flex flex-col h-64">
                       <div className="flex-grow flex items-center justify-center overflow-hidden bg-gray-100 h-4/5 relative">
                         {mediaType === 'video' && anexo.public_url ? ( <video controls src={anexo.public_url} className="w-full h-full object-contain bg-black">Video não suportado. <a href={anexo.public_url} target="_blank" rel="noopener noreferrer">Assista aqui</a></video>
                         ) : anexo.thumbnail_url ? ( <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center"><Image src={anexo.thumbnail_url} alt={`Preview ${anexo.nome_arquivo}`} width={200} height={160} className="object-contain max-h-full max-w-full" unoptimized /></a>
                         ) : mediaType === 'image' && anexo.public_url ? ( <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center"><Image src={anexo.public_url} alt={`Preview ${anexo.nome_arquivo}`} width={200} height={160} className="object-contain max-h-full max-w-full" unoptimized /></a>
                         ) : mediaType === 'pdf' ? ( <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-center text-red-500"><FontAwesomeIcon icon={faFilePdf} size="3x" /><p className="text-xs mt-1">PDF</p></a>
                         ) : ( <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" className="text-center text-gray-500"><FontAwesomeIcon icon={faFileAlt} size="3x" /><p className="text-xs mt-1">Arquivo</p></a> )}
                         <div className="absolute top-0 right-0 p-1 flex items-center gap-1 bg-black/40 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                           <a href={anexo.public_url} target="_blank" rel="noopener noreferrer" title="Abrir" className={`text-white h-7 w-7 flex items-center justify-center hover:bg-black/30 rounded-full transition-colors ${!anexo.public_url && 'hidden'}`}><FontAwesomeIcon icon={faEye} /></a>
                           <button onClick={() => handleDownload(anexo)} disabled={downloadingId === anexo.id || !anexo.public_url} title="Baixar" className={`text-white h-7 w-7 flex items-center justify-center hover:bg-black/30 rounded-full transition-colors ${!anexo.public_url && 'hidden'}`}>{downloadingId === anexo.id ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faDownload} />}</button>
                         </div>
                       </div>
                       <div className="p-2 border-t h-1/5 flex flex-col justify-center">
                         <p className="font-medium text-sm text-gray-800 truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p>
                         <p className="text-xs text-gray-500 truncate">{anexo.tipo?.nome || 'Arquivo'}</p>
                       </div>
                     </div>
                   );
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}