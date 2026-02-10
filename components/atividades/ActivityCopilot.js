'use client'

import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faRobot, faPaperPlane, faTimes, faCheckCircle, faMagic, 
  faCalendarAlt, faBuilding, faListUl, faEdit, faTrash, faSave
} from '@fortawesome/free-solid-svg-icons'
import { 
  generateActivityPlan, 
  confirmActivityPlan, 
  getOrCreateSession,  // <--- Importar
  saveSessionState,    // <--- Importar
  clearSession         // <--- Importar
} from '@/app/(main)/atividades/actions-ai'
import { toast } from 'sonner'

export default function ActivityCopilot({ isOpen, onClose, organizacaoId, usuarioId, onSuccess }) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposedPlan, setProposedPlan] = useState(null)
  const [saving, setSaving] = useState(false)

  const messagesEndRef = useRef(null)

  // 1. AO ABRIR: Carrega a sessão do banco
  useEffect(() => {
    if (isOpen && organizacaoId && usuarioId) {
      async function loadHistory() {
        setLoading(true)
        const result = await getOrCreateSession(organizacaoId, usuarioId)
        if (result.success) {
          setSessionId(result.session.id)
          setMessages(result.session.messages || [])
          setProposedPlan(result.session.current_plan)
        }
        setLoading(false)
      }
      loadHistory()
    }
  }, [isOpen, organizacaoId, usuarioId])

  // 2. AUTO-SAVE: Sempre que mensagens ou plano mudarem, salva no banco
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      const timer = setTimeout(() => {
        saveSessionState(sessionId, messages, proposedPlan)
      }, 1000) // Debounce de 1s para não salvar a cada letra (se fosse input)
      return () => clearTimeout(timer)
    }
  }, [messages, proposedPlan, sessionId])

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, proposedPlan, loading])

  async function handleSendMessage(e) {
    e?.preventDefault()
    if (!inputText.trim() || loading) return

    const userMsg = inputText
    setInputText('') 
    
    // Atualiza estado local (o useEffect vai salvar no banco)
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const result = await generateActivityPlan(userMsg, organizacaoId, proposedPlan)

      if (result.success) {
        setProposedPlan(result.data)
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: proposedPlan 
            ? 'Plano atualizado com sucesso. Mais alguma alteração?' 
            : `Gerei um plano com ${result.data.length} atividades. Podemos ajustar ou aprovar.` 
        }])
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: result.message || 'Erro ao processar.' }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Erro de comunicação.' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!proposedPlan) return
    setSaving(true)
    try {
      const result = await confirmActivityPlan(proposedPlan, organizacaoId, usuarioId)
      if (result.success) {
        toast.success('Atividades criadas!')
        onSuccess?.()
        handleReset() // Limpa a sessão após criar
        onClose()
      }
    } catch (error) {
      toast.error('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setProposedPlan(null)
    setMessages([{ role: 'ai', content: 'Começando um novo planejamento. O que vamos fazer?' }])
    if (sessionId) await clearSession(sessionId)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col animate-slide-left border-l border-gray-100">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full"><FontAwesomeIcon icon={faRobot} /></div>
            <div>
              <h3 className="font-bold">Planejador IA</h3>
              <p className="text-xs opacity-80 flex items-center gap-1">
                {sessionId ? <><FontAwesomeIcon icon={faSave} /> Salvo Automaticamente</> : 'Carregando...'}
              </p>
            </div>
          </div>
          <button onClick={onClose}><FontAwesomeIcon icon={faTimes} size="lg" /></button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 border border-gray-200 rounded-bl-none'}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start text-gray-400 text-xs italic gap-2 items-center ml-2">
              <FontAwesomeIcon icon={faMagic} spin /> Processando...
            </div>
          )}

          {proposedPlan && (
            <div className="border border-indigo-200 rounded-xl bg-white overflow-hidden shadow-lg animate-fade-in-up mb-2">
              <div className="bg-indigo-50 p-3 border-b border-indigo-100 flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-800 uppercase flex items-center gap-2">
                  <FontAwesomeIcon icon={faListUl} /> Rascunho ({proposedPlan.length})
                </span>
                <span className="text-[10px] text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                  <FontAwesomeIcon icon={faEdit} className="mr-1"/> Editável
                </span>
              </div>
              
              <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto bg-gray-50/50">
                {proposedPlan.map((activity, i) => (
                  <div key={i} className={`p-3 rounded-lg border shadow-sm bg-white ${activity.parent_temp_id ? 'ml-6 border-l-4 border-l-indigo-300' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-gray-800 text-sm">{activity.nome}</h4>
                      {activity.temp_id && <span className="text-[9px] text-gray-400">ID:{activity.temp_id}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-1 line-clamp-2">{activity.descricao}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1"><FontAwesomeIcon icon={faCalendarAlt} className="text-blue-400"/> {activity.data_inicio_prevista}</span>
                      {activity.empreendimento_id && (
                        <span className="flex items-center gap-1 text-green-600 font-bold"><FontAwesomeIcon icon={faBuilding}/> Obra Vinculada</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                <button onClick={handleReset} className="flex-1 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2">
                    <FontAwesomeIcon icon={faTrash} /> Limpar
                </button>
                <button onClick={handleApprove} disabled={saving} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-md flex items-center justify-center gap-2">
                  {saving ? 'Criando...' : <><FontAwesomeIcon icon={faCheckCircle} /> Aprovar</>}
                </button>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100">
          <div className="relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite sua mensagem ou ajuste..."
              disabled={loading}
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-50"
            />
            <button type="submit" disabled={!inputText.trim() || loading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50">
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}