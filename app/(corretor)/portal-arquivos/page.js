// app/(corretor)/portal-arquivos/page.js
'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { useLayout } from '@/contexts/LayoutContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSpinner,
  faFolderBlank,
  faFilePdf,
  faFileImage,
  faFileArchive,
  faFileAlt,
  faDownload,
  faFolderOpen,
  faEye,
} from '@fortawesome/free-solid-svg-icons'
import { toast } from 'sonner'

// 1. Função de busca de dados (Query para o useQuery)
async function fetchArquivosCorretor(organizacaoId) {
  if (!organizacaoId) {
    return []
  }

  const supabase = createClient()

  // --- CORREÇÃO FINAL (AGORA SIM!) ---
  // Removi DEFINITIVAMENTE todos os comentários de dentro do .select()
  const { data, error } = await supabase
    .from('empreendimento_anexos')
    .select(
      `
      id,
      nome_arquivo,
      caminho_arquivo,
      created_at,
      empreendimento_id,
      empreendimentos ( nome ),
      tipo:documento_tipos ( sigla, nome:descricao ) 
    ` // <-- Limpo, sem comentários!
    )
    .eq('organizacao_id', organizacaoId)
    .eq('disponivel_corretor', true) // <-- O FILTRO MÁGICO!
    .order('nome', { foreignTable: 'empreendimentos', ascending: true })
    .order('nome_arquivo', { ascending: true })

  if (error) {
    console.error('Erro ao buscar arquivos para o corretor:', error.message)
    // Lança o erro para ser pego pelo useQuery
    throw new Error(error.message)
  }

  // Adiciona a URL pública a cada anexo para visualização direta
  const anexosComUrl = await Promise.all(
    (data || []).map(async (anexo) => {
      // Usar getPublicUrl que não precisa de async/await direto
      const { data: urlData } = supabase.storage
        .from('empreendimento-anexos')
        .getPublicUrl(anexo.caminho_arquivo)
      return { ...anexo, public_url: urlData?.publicUrl }
    })
  )

  return anexosComUrl
}

// 2. Componente da Página
export default function ArquivosCorretorPage() {
  const { user, isUserLoading } = useLayout()
  const organizacaoId = user?.organizacao_id
  const supabase = createClient() // Instância separada para o handleDownload, se necessário

  const [downloadingId, setDownloadingId] = useState(null) // Controla o spinner de download

  // 3. Hook useQuery para buscar os dados
  const {
    data: arquivos,
    isLoading: isLoadingArquivos,
    isError,
    error, // O erro capturado da função fetchArquivosCorretor
    isFetching,
  } = useQuery({
    queryKey: ['arquivosCorretor', organizacaoId],
    queryFn: () => fetchArquivosCorretor(organizacaoId),
    enabled: !!organizacaoId,
  })

  // 4. Lógica da Notificação de Atualização
  const prevIsFetchingRef = useRef(false)
  useEffect(() => {
    // Só mostra a notificação se não estiver carregando pela primeira vez,
    // se estava buscando antes e parou agora, E se não deu erro na busca.
    if (!isLoadingArquivos && prevIsFetchingRef.current && !isFetching && !isError) {
      toast.success('Página atualizada!')
    }
    prevIsFetchingRef.current = isFetching
  }, [isFetching, isLoadingArquivos, isError]) // Depende de isError também

  // 5. Hook useMemo para agrupar os arquivos por empreendimento
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

  // 6. Função para lidar com o Download (usando public_url)
  const handleDownload = (anexo) => {
    // Não precisa mais do async/await aqui se a URL já foi buscada
    if (downloadingId === anexo.id) return // Já está baixando
    if (!anexo.public_url) {
      toast.error('Erro ao obter URL para download.')
      console.error('Anexo sem public_url:', anexo) // Log para debug
      return
    }

    setDownloadingId(anexo.id) // Ativa o spinner ANTES de tentar o download
    toast.loading('Iniciando download...', { id: `download-${anexo.id}` })

    try {
      // Tenta forçar o download criando um link temporário
      const link = document.createElement('a')
      link.href = anexo.public_url
      // Adiciona target="_blank" para tentar abrir em nova aba se o download falhar
      link.target = '_blank'
      link.setAttribute('download', anexo.nome_arquivo || 'arquivo')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Download iniciado!', { id: `download-${anexo.id}` })
    } catch (err) {
      console.error('Erro ao tentar forçar download:', err)
      toast.error('Falha ao iniciar download.', { id: `download-${anexo.id}` })
      // Como fallback, tenta abrir a URL em nova aba (pode abrir em vez de baixar)
      window.open(anexo.public_url, '_blank')
    } finally {
      // Garante que o spinner seja desativado mesmo se houver erro
      // Adiciona um pequeno delay para o usuário ver a mensagem de sucesso/erro
      setTimeout(() => setDownloadingId(null), 500)
    }
  }


  // Função para escolher o ícone certo (mantida)
  const getFileIcon = (sigla) => {
    const s = sigla?.toUpperCase()
    if (s === 'PDF') return faFilePdf
    if (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(s)) return faFileImage
    if (['ZIP', 'RAR'].includes(s)) return faFileArchive
    return faFileAlt // Ícone padrão para outros tipos
  }

  // Define o estado de "carregando" principal
  const isLoading = isUserLoading || isLoadingArquivos

  // 7. Renderização (Loading, Erro, Sucesso)
  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-64">
          <FontAwesomeIcon icon={faSpinner} className="text-blue-500 text-4xl" spin />
          <p className="ml-4 text-gray-600">Carregando arquivos...</p>
        </div>
      )
  }

  // --- MUDANÇA: Exibe a mensagem de erro específica do useQuery ---
  if (isError) {
    return (
        <div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Erro!</strong>
          {/* Mostra a mensagem de erro vinda do Supabase ou da rede */}
          <span className="block sm:inline"> {error?.message || 'Não foi possível carregar os arquivos.'}</span>
        </div>
      )
  }

  const empreendimentoIds = Object.keys(arquivosAgrupados)

  // 8. Sucesso: Renderiza a lista de arquivos
  return (
    <div className="max-w-full mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Biblioteca de Arquivos
      </h1>

      {empreendimentoIds.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
           <div className="text-center">
             <FontAwesomeIcon icon={faFolderBlank} className="text-5xl text-gray-300 mb-4"/>
             <h3 className="text-lg font-semibold text-gray-700">Nenhum arquivo encontrado</h3>
             <p className="text-gray-500 text-sm mt-1">Nenhum arquivo foi disponibilizado para os corretores ainda.</p>
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
              <ul className="space-y-3">
                {grupo.arquivos.map((anexo) => (
                  <li
                    key={anexo.id}
                    className="bg-white p-3 rounded-md border flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Detalhes do Anexo */}
                    <div className="flex items-center gap-4 min-w-0">
                      <FontAwesomeIcon
                        icon={getFileIcon(anexo.tipo?.sigla)}
                        className="text-xl text-gray-500 flex-shrink-0 w-5 h-5"
                      />
                      <div className="flex-grow min-w-0">
                        <p
                          className="font-medium text-gray-800 truncate"
                          title={anexo.nome_arquivo}
                        >
                          {anexo.nome_arquivo}
                        </p>
                        <p className="text-xs text-gray-500">
                          {anexo.tipo?.nome || 'Arquivo'}
                        </p>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <a
                        href={anexo.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1 ${anexo.public_url ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 cursor-not-allowed'}`}
                        title={anexo.public_url ? "Visualizar" : "URL não disponível"}
                        onClick={(e) => !anexo.public_url && e.preventDefault()} // Impede clique se não houver URL
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </a>
                      <button
                        onClick={() => handleDownload(anexo)}
                        disabled={downloadingId === anexo.id || !anexo.public_url} // Desabilita se não tiver URL
                        className={`p-1 ${anexo.public_url ? 'text-green-600 hover:text-green-800' : 'text-gray-400'} disabled:text-gray-400 disabled:cursor-not-allowed`}
                        title={anexo.public_url ? "Baixar" : "URL não disponível"}
                      >
                        {downloadingId === anexo.id ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                          <FontAwesomeIcon icon={faDownload} />
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}