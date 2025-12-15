// app/(main)/configuracoes/politicas/page.js
'use client'

import { useState, useEffect } from 'react'
import { getTermHistory, saveNewTermVersion } from './actions'
import { toast } from 'sonner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSave, faHistory, faFileContract, faSpinner } from '@fortawesome/free-solid-svg-icons'

export default function PoliticasPage() {
  const [content, setContent] = useState('')
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Carregar dados iniciais
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    const data = await getTermHistory()
    setHistory(data)
    
    // Se tiver histórico, joga o mais recente no editor
    if (data && data.length > 0) {
        setContent(data[0].conteudo)
    }
    setIsLoading(false)
  }

  async function handleSave() {
    if (!content.trim()) return toast.error('O termo não pode estar vazio.')
    
    setIsSaving(true)
    const result = await saveNewTermVersion(content)
    setIsSaving(false)

    if (result?.success) {
        toast.success(`Versão ${result.version} publicada com sucesso!`)
        loadData() // Recarrega a lista
    } else {
        toast.error('Erro ao salvar: ' + result?.error)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faFileContract} className="text-blue-600" />
                Políticas e Termos de Uso
            </h1>
            <p className="text-gray-500">Gerencie o contrato de parceria aceito pelos corretores.</p>
        </div>
        <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 transition-colors"
        >
            {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            Publicar Nova Versão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA DA ESQUERDA: EDITOR */}
        <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Editor do Contrato (HTML Permitido)</label>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-[500px] p-4 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="<h1>Termos de Uso</h1><p>Digite aqui o contrato...</p>"
            />
            <p className="text-xs text-gray-400 mt-2">Dica: Use tags HTML simples como &lt;h1&gt;, &lt;p&gt;, &lt;b&gt; para formatar.</p>
        </div>

        {/* COLUNA DA DIREITA: HISTÓRICO */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 h-fit">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faHistory} className="text-gray-500" />
                Histórico de Versões
            </h3>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {isLoading ? (
                    <p className="text-gray-500 text-center py-4">Carregando...</p>
                ) : history.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhuma versão encontrada.</p>
                ) : (
                    history.map((term) => (
                        <div 
                            key={term.id} 
                            onClick={() => setContent(term.conteudo)}
                            className={`p-3 rounded-md border cursor-pointer transition-all ${term.ativo ? 'border-green-200 bg-green-50' : 'border-gray-100 hover:bg-gray-50'}`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="font-bold text-sm text-gray-700">Versão {term.versao}</span>
                                {term.ativo && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Atual</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {new Date(term.created_at).toLocaleDateString('pt-BR')} às {new Date(term.created_at).toLocaleTimeString('pt-BR')}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  )
}