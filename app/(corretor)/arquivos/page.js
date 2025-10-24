// app/(corretor)/arquivos/page.js
'use client'

import React, { useMemo, useState } from 'react'
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
} from '@fortawesome/free-solid-svg-icons'
import { toast } from 'sonner'

// 1. Função de busca de dados (Query para o useQuery)
async function fetchArquivosCorretor(organizacaoId) {
  if (!organizacaoId) {
    return []
  }

  const supabase = createClient()

  // A Query Mágica!
  // Pega anexos + o nome do empreendimento + o tipo do documento
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
      tipo:documento_tipos ( sigla, nome )
    `
    )
    .eq('organizacao_id', organizacaoId)
    .eq('disponivel_corretor', true) // <-- O FILTRO MÁGICO!
    .order('nome', { foreignTable: 'empreendimentos', ascending: true })
    .order('nome_arquivo', { ascending: true })

  if (error) {
    console.error('Erro ao buscar arquivos para o corretor:', error.message)
    throw new Error(error.message)
  }

  return data || []
}

// 2. Componente da Página
export default function ArquivosCorretorPage() {
  const { user, isUserLoading } = useLayout()
  const organizacaoId = user?.organizacao_id
  const supabase = createClient()

  const [downloadingId, setDownloadingId] = useState(null) // Controla o spinner de download

  // 3. Hook useQuery para buscar os dados
  const {
    data: arquivos,
    isLoading: isLoadingArquivos,
    isError,
    error,
  } = useQuery({
    queryKey: ['arquivosCorretor', organizacaoId],
    queryFn: () => fetchArquivosCorretor(organizacaoId),
    enabled: !!organizacaoId, // Só executa quando o ID da organização estiver pronto
  })

  // 4. Hook useMemo para agrupar os arquivos por empreendimento
  const arquivosAgrupados = useMemo(() => {
    if (!arquivos) return {}

    return arquivos.reduce((acc, anexo) => {
      const empId = anexo.empreendimento_id
      const empNome = anexo.empreendimentos?.nome || 'Empreendimento não identificado'

      if (!acc[empId]) {
        acc[empId] = {
          nome: empNome,
          arquivos: [],
        }
      }

      acc[empId].arquivos.push(anexo)
      return acc
    }, {})
  }, [arquivos])

  // 5. Função para lidar com o Download
  const handleDownload = async (anexo) => {
    if (downloadingId === anexo.id) return // Já está baixando
    setDownloadingId(anexo.id)
    toast.loading('Iniciando download...', { id: 'download-toast' })

    try {
      const { data, error } = await supabase.storage
        .from('empreendimento-anexos')
        .createSignedUrl(anexo.caminho_arquivo, 3600) // URL válida por 1 hora

      if (error) {
        throw error
      }

      // Abre a URL assinada em uma nova aba (força o download)
      window.open(data.signedUrl, '_blank')
      toast.success('Download iniciado!', { id: 'download-toast' })
    } catch (err) {
      console.error('Erro ao gerar URL de download:', err)
      toast.error('Falha ao iniciar o download.', { id: 'download-toast' })
    } finally {
      setDownloadingId(null) // Libera o botão
    }
  }

  // Função para escolher o ícone certo
  const getFileIcon = (sigla) => {
    const s = sigla?.toUpperCase()
    if (s === 'PDF') return faFilePdf
    if (['PNG', 'JPG', 'JPEG', 'GIF'].includes(s)) return faFileImage
    if (['ZIP', 'RAR'].includes(s)) return faFileArchive
    return faFileAlt
  }

  // Define o estado de "carregando" principal
  const isLoading = isUserLoading || isLoadingArquivos

  // 6. Renderização (Loading, Erro, Sucesso)
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FontAwesomeIcon
          icon={faSpinner}
          className="text-blue-500 text-4xl"
          spin
        />
        <p className="ml-4 text-gray-600">Carregando arquivos...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Erro!</strong>
        <span className="block sm:inline"> {error.message}</span>
      </div>
    )
  }

  const empreendimentoIds = Object.keys(arquivosAgrupados)

  // 7. Sucesso: Renderiza a lista de arquivos
  return (
    <div className="max-w-full mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Biblioteca de Arquivos
      </h1>

      {empreendimentoIds.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <div className="text-center">
            <FontAwesomeIcon
              icon={faFolderBlank}
              className="text-5xl text-gray-300 mb-4"
            />
            <h3 className="text-lg font-semibold text-gray-700">
              Nenhum arquivo encontrado
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Nenhum arquivo foi disponibilizado para os corretores ainda.
            </p>
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
              <ul className="divide-y divide-gray-200 bg-white shadow-sm rounded-lg border">
                {grupo.arquivos.map((anexo) => (
                  <li
                    key={anexo.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center min-w-0">
                      <FontAwesomeIcon
                        icon={getFileIcon(anexo.tipo?.sigla)}
                        className="w-5 h-5 text-gray-400 mr-4 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium text-gray-900 truncate"
                          title={anexo.nome_arquivo}
                        >
                          {anexo.nome_arquivo}
                        </p>
                        <p className="text-xs text-gray-500">
                          {anexo.tipo?.nome || 'Arquivo'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(anexo)}
                      disabled={downloadingId === anexo.id}
                      className="ml-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 disabled:bg-gray-400 w-32 justify-center"
                    >
                      {downloadingId === anexo.id ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faDownload} className="mr-2" />
                          Baixar
                        </>
                      )}
                    </button>
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