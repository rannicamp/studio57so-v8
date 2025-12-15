'use client'

import { useState, useEffect } from 'react'
import { checkTermsStatus, acceptUpdatedTerms } from '@/app/(corretor)/actions'
import { toast } from 'sonner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileContract, faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons'

export default function TermsUpdateEnforcer() {
  const [showModal, setShowModal] = useState(false)
  const [termData, setTermData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Verifica status ao carregar a página
  useEffect(() => {
    async function verify() {
        const result = await checkTermsStatus()
        if (result?.mustAccept) {
            setTermData(result)
            setShowModal(true)
        }
    }
    verify()
  }, [])

  const handleAccept = async () => {
    if (!termData?.termId) return
    
    setIsLoading(true)
    const result = await acceptUpdatedTerms(termData.termId)
    
    if (result?.success) {
        toast.success('Termos aceitos com sucesso!', {
            description: 'Você já pode continuar usando o sistema.'
        })
        setShowModal(false)
    } else {
        // MUDANÇA AQUI: Mostra o erro real que veio do servidor
        toast.error(result?.error || 'Erro ao salvar aceite. Tente novamente.')
    }
    setIsLoading(false)
  }

  if (!showModal || !termData) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-300">
            
            {/* Cabeçalho de Alerta */}
            <div className="p-6 border-b border-red-100 bg-red-50 rounded-t-lg text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <FontAwesomeIcon icon={faFileContract} className="text-red-600 text-xl" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Atualização de Políticas</h3>
                <p className="text-gray-600 text-sm mt-1">
                    Temos novas cláusulas importantes. Para continuar acessando o Portal do Corretor, 
                    você precisa ler e concordar com a nova versão.
                </p>
            </div>

            {/* Conteúdo do Contrato */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50 custom-scrollbar border-b border-gray-200">
                <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                    <div 
                        className="prose prose-sm max-w-none text-gray-600"
                        dangerouslySetInnerHTML={{ __html: termData.termContent }}
                    />
                </div>
            </div>

            {/* Rodapé de Ação */}
            <div className="p-6 bg-white rounded-b-lg flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-gray-500 text-center md:text-left">
                    Ao clicar em aceitar, você confirma que leu e concorda<br/> com as atualizações contratuais acima.
                </p>
                <button
                    onClick={handleAccept}
                    disabled={isLoading}
                    className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <> <FontAwesomeIcon icon={faSpinner} spin /> Processando... </>
                    ) : (
                        <> <FontAwesomeIcon icon={faCheckCircle} /> Li e Concordo com a Atualização </>
                    )}
                </button>
            </div>
        </div>
    </div>
  )
}