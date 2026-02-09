'use client'

import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faCheckCircle, faExclamationTriangle, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { 
  getSystemFieldsForMapping, 
  getMetaFormsList, // Nova função
  getFormQuestions, // Nova função com API Check
  getSavedMappings, 
  saveMappingRule,
  syncMetaFormsCatalog // Nova função de ação
} from '@/app/(main)/crm/actions-meta-mapping'
import { toast } from 'sonner'

export default function MetaFormMappingModal({ isOpen, onClose, organizacaoId }) {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  
  const [forms, setForms] = useState([])
  const [systemFields, setSystemFields] = useState([])
  
  const [selectedFormId, setSelectedFormId] = useState('')
  const [formFields, setFormFields] = useState([]) 
  const [mappings, setMappings] = useState({}) 
  const [savingField, setSavingField] = useState(null) 

  useEffect(() => {
    if (isOpen && organizacaoId) {
      loadInitialData()
    }
  }, [isOpen, organizacaoId])

  async function loadInitialData() {
    setLoading(true)
    try {
      const [formsData, fieldsData] = await Promise.all([
        getMetaFormsList(organizacaoId),
        getSystemFieldsForMapping(organizacaoId)
      ])
      setForms(formsData)
      setSystemFields(fieldsData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar lista de formulários.')
    } finally {
      setLoading(false)
    }
  }

  // --- AÇÃO DE SINCRONIZAÇÃO ATIVA ---
  async function handleSyncCatalog() {
    setSyncing(true)
    try {
      const result = await syncMetaFormsCatalog(organizacaoId)
      if (result.success) {
        toast.success(`Sincronizado! ${result.count || 0} formulários encontrados.`)
        // Recarrega a lista
        const updatedForms = await getMetaFormsList(organizacaoId)
        setForms(updatedForms)
      } else {
        toast.error(`Erro: ${result.error}`)
      }
    } catch (error) {
      toast.error('Erro ao conectar com o Facebook.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleFormSelect(formId) {
    setSelectedFormId(formId)
    setFormFields([])
    setMappings({})
    
    if (!formId) return

    setLoading(true)
    try {
      // Busca perguntas (da API ou do banco)
      const questions = await getFormQuestions(organizacaoId, formId)
      
      // Busca regras salvas
      const savedRules = await getSavedMappings(organizacaoId, formId)

      const initialMap = {}
      if (savedRules) {
        savedRules.forEach(rule => {
          initialMap[rule.meta_field_name] = rule.campo_sistema_id
        })
      }

      setFormFields(questions || [])
      setMappings(initialMap)

      if (!questions || questions.length === 0) {
        toast.warning('Este formulário ainda não tem perguntas cadastradas ou leads.')
      }

    } catch (error) {
      console.error('Erro ao selecionar formulário:', error)
      toast.error('Erro ao carregar detalhes do formulário.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMappingChange(metaFieldName, campoSistemaId) {
    setMappings(prev => ({ ...prev, [metaFieldName]: campoSistemaId }))
    setSavingField(metaFieldName)

    try {
      await saveMappingRule(organizacaoId, selectedFormId, metaFieldName, campoSistemaId)
      setTimeout(() => setSavingField(null), 500)
    } catch (error) {
      toast.error('Erro ao salvar regra.')
      setSavingField(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
        
        {/* Cabeçalho */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-blue-600">⚡</span> Mapear Formulários do Meta
            </h2>
            <p className="text-sm text-gray-500 mt-1">Conecte seus formulários novos ou existentes aos campos do sistema.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-full transition">✕</button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          
          <div className="space-y-6">
            
            {/* Seção 1: Seleção e Sync */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-end gap-4 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  1. Escolha o Formulário
                </label>
                
                {/* BOTÃO DE SYNC ATIVO */}
                <button 
                  onClick={handleSyncCatalog}
                  disabled={syncing}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-2 ${syncing ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                >
                  <FontAwesomeIcon icon={faSync} spin={syncing} />
                  {syncing ? 'Buscando no Facebook...' : 'Buscar Novos Formulários'}
                </button>
              </div>

              <select 
                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={selectedFormId}
                onChange={(e) => handleFormSelect(e.target.value)}
              >
                <option value="">-- Selecione um formulário --</option>
                {forms.map(form => (
                  <option key={form.id} value={form.id}>
                    {form.name} (ID: {form.id})
                  </option>
                ))}
              </select>
              
              {forms.length === 0 && !loading && (
                <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  Nenhum formulário encontrado. Clique em "Buscar Novos Formulários" acima.
                </p>
              )}
            </div>

            {/* Seção 2: Loading de Perguntas */}
            {loading && selectedFormId && (
              <div className="flex justify-center py-10 text-gray-500 gap-2 items-center">
                <FontAwesomeIcon icon={faSpinner} spin /> Carregando perguntas do formulário...
              </div>
            )}

            {/* Seção 3: Mapeamento */}
            {!loading && selectedFormId && (
              <div className="animate-fadeIn">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                  Conecte as perguntas aos campos do CRM:
                </h3>

                {formFields.length > 0 ? (
                  <div className="grid gap-3">
                    {formFields.map((field) => (
                      <div key={field} className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-all group">
                        
                        {/* Esquerda: Meta */}
                        <div className="flex-1 w-full">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pergunta do Meta</span>
                          </div>
                          <div className="font-medium text-sm text-gray-800 break-words">
                            {field}
                          </div>
                        </div>

                        {/* Seta */}
                        <div className="hidden md:block text-gray-300 group-hover:text-blue-400 transition-colors">➝</div>

                        {/* Direita: Sistema */}
                        <div className="flex-1 w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Campo no CRM</span>
                            {savingField === field && <span className="text-xs text-green-600 animate-pulse flex items-center gap-1"><FontAwesomeIcon icon={faCheckCircle} /> Salvo</span>}
                          </div>
                          <select 
                            className={`w-full p-2 border rounded-md text-sm outline-none transition-all ${
                              mappings[field] 
                                ? 'border-green-300 bg-green-50 text-green-800 font-semibold' 
                                : 'border-gray-300 bg-white text-gray-600 focus:border-blue-500'
                            }`}
                            value={mappings[field] || ''}
                            onChange={(e) => handleMappingChange(field, e.target.value)}
                          >
                            <option value="">-- Ignorar / Não Salvar --</option>
                            {systemFields.map(sysField => (
                              <option key={sysField.id} value={sysField.id}>
                                {sysField.nome_exibicao}
                              </option>
                            ))}
                          </select>
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg border border-dashed border-gray-300">
                    <p>Não consegui ler as perguntas deste formulário.</p>
                    <p className="text-sm mt-1">O formulário pode estar vazio ou ser muito antigo.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors shadow-lg shadow-gray-200"
          >
            Concluir Configuração
          </button>
        </div>

      </div>
    </div>
  )
}