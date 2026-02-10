'use client'

import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faRobot, faPaperPlane, faTimes, faCheckCircle, faMagic, 
  faCalendarAlt, faBuilding, faListUl, faEdit, faTrash, faSave,
  faArrowLeft, faPlus, faComments, faPen
} from '@fortawesome/free-solid-svg-icons'
import { 
  generateActivityPlan, 
  confirmActivityPlan, 
  listUserSessions,
  createNewSession,
  getSessionById,
  saveSessionState,
  deleteSession,
  renameSession
} from '@/app/(main)/atividades/actions-ai'
import { toast } from 'sonner'

export default function ActivityCopilot({ isOpen, onClose, organizacaoId, usuarioId, onSuccess }) {
  // ESTADOS GERAIS
  const [view, setView] = useState('list') // 'list' | 'chat'
  const [sessionList, setSessionList] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [loadingList, setLoadingList] = useState(false)

  // ESTADOS DO CHAT
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)
  const [proposedPlan, setProposedPlan] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState(null) // ID da sessão sendo renomeada na lista

  const messagesEndRef = useRef(null)

  // --- CARREGAR LISTA AO ABRIR ---
  useEffect(() => {
    if (isOpen) loadSessions()
  }, [isOpen])

  // --- AUTO-SAVE DO CHAT ---
  useEffect(() => {
    if (currentSession && messages.length > 0) {
      const timer = setTimeout(() => {
        saveSessionState(currentSession.id, messages, proposedPlan)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [messages, proposedPlan, currentSession])

  // --- SCROLL DO CHAT ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, proposedPlan, loadingChat, view])

  // --- FUNÇÕES DE LISTA ---
  async function loadSessions() {
    setLoadingList(true)
    const list = await listUserSessions(organizacaoId, usuarioId)
    setSessionList(list)
    setLoadingList(false)
  }

  async function handleNewChat() {
    const title = prompt("Nome do Planejamento:", "Novo Planejamento")
    if (!title) return

    setLoadingList(true)
    const result = await createNewSession(organizacaoId, usuarioId, title)
    if (result.success) {
      setSessionList(prev => [result.session, ...prev])
      enterChat(result.session)
    }
    setLoadingList(false)
  }

  async function enterChat(sessionSummary) {
    setLoadingChat(true)
    setView('chat')
    const result = await getSessionById(sessionSummary.id)
    if (result.success) {
      setCurrentSession(result.session)
      setMessages(result.session.messages || [])
      setProposedPlan(result.session.current_plan)
    }
    setLoadingChat(false)
  }

  async function handleDeleteSession(e, id) {
    e.stopPropagation()
    if (!confirm("Tem certeza que deseja apagar este histórico?")) return
    await deleteSession(id)
    setSessionList(prev => prev.filter(s => s.id !== id))
    if (currentSession?.id === id) setView('list')
  }

  async function handleRenameSession(id, newTitle) {
    await renameSession(id, newTitle)
    setSessionList(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s))
    setEditTitle(null)
  }

  // --- FUNÇÕES DE CHAT ---
  async function handleSendMessage(e) {
    e?.preventDefault()
    if (!inputText.trim() || loadingChat) return

    const userMsg = inputText
    setInputText('') 
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoadingChat(true)

    try {
      const result = await generateActivityPlan(userMsg, organizacaoId, proposedPlan)
      if (result.success) {
        setProposedPlan(result.data)
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: proposedPlan ? 'Plano atualizado.' : `Gerei ${result.data.length} atividades.` 
        }])
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: result.message }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Erro de conexão.' }])
    } finally {
      setLoadingChat(false)
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
        onClose()
      }
    } catch {
      toast.error('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col animate-slide-left border-l border-gray-100 font-sans">
        
        {/* HEADER DINÂMICO */}
        <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            {view === 'chat' ? (
               <button onClick={() => setView('list')} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                  <FontAwesomeIcon icon={faArrowLeft} />
               </button>
            ) : (
               <div className="bg-white/20 p-2 rounded-full"><FontAwesomeIcon icon={faRobot} /></div>
            )}
            <div>
              <h3 className="font-bold text-base">
                {view === 'list' ? 'Meus Planejamentos' : currentSession?.title || 'Chat'}
              </h3>
              <p className="text-xs opacity-80">
                {view === 'list' ? 'Histórico de conversas' : 'Assistente IA'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:text-gray-200"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
        </div>

        {/* --- VIEW: LISTA DE CONVERSAS --- */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            <button 
              onClick={handleNewChat}
              className="w-full bg-white border-2 border-dashed border-indigo-200 text-indigo-600 p-4 rounded-xl mb-4 hover:bg-indigo-50 hover:border-indigo-400 transition-all font-bold flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} /> Iniciar Novo Planejamento
            </button>

            {loadingList ? (
              <div className="text-center text-gray-400 mt-10"><FontAwesomeIcon icon={faMagic} spin /> Carregando...</div>
            ) : (
              <div className="space-y-3">
                {sessionList.length === 0 && <p className="text-center text-gray-400 mt-4 text-sm">Nenhuma conversa encontrada.</p>}
                
                {sessionList.map(session => (
                  <div 
                    key={session.id} 
                    onClick={() => enterChat(session)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group relative"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center">
                          <FontAwesomeIcon icon={faComments} />
                        </div>
                        <div>
                          {editTitle === session.id ? (
                            <input 
                              autoFocus
                              className="border-b border-indigo-500 outline-none text-sm font-bold text-gray-800 bg-transparent w-full"
                              defaultValue={session.title}
                              onBlur={(e) => handleRenameSession(session.id, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(session.id, e.currentTarget.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <h4 className="font-bold text-gray-800 text-sm">{session.title}</h4>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            Editado em: {new Date(session.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Ações Hover */}
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditTitle(session.id) }}
                          className="text-gray-400 hover:text-blue-500 p-1"
                          title="Renomear"
                        >
                          <FontAwesomeIcon icon={faPen} size="xs" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                          title="Excluir"
                        >
                          <FontAwesomeIcon icon={faTrash} size="xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VIEW: CHAT --- */}
        {view === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 border border-gray-200 rounded-bl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {loadingChat && <div className="text-gray-400 text-xs italic ml-2"><FontAwesomeIcon icon={faMagic} spin /> IA Digitando...</div>}

              {proposedPlan && (
                <div className="border border-indigo-200 rounded-xl bg-white overflow-hidden shadow-lg animate-fade-in-up mb-2">
                  <div className="bg-indigo-50 p-3 border-b border-indigo-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-800 uppercase flex items-center gap-2">
                      <FontAwesomeIcon icon={faListUl} /> Plano ({proposedPlan.length} itens)
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
                        </div>
                        <p className="text-xs text-gray-500 mb-1 line-clamp-1">{activity.descricao}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                          <span className="flex items-center gap-1"><FontAwesomeIcon icon={faCalendarAlt} className="text-blue-400"/> {activity.data_inicio_prevista}</span>
                          {activity.empreendimento_id && <span className="text-green-600 font-bold"><FontAwesomeIcon icon={faBuilding}/> Obra Vinculada</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                    <button onClick={() => setProposedPlan(null)} className="flex-1 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg">
                        <FontAwesomeIcon icon={faTrash} /> Limpar
                    </button>
                    <button onClick={handleApprove} disabled={saving} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-md flex items-center justify-center gap-2">
                      {saving ? 'Salvando...' : <><FontAwesomeIcon icon={faCheckCircle} /> Aprovar</>}
                    </button>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100">
              <div className="relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Mensagem..."
                  disabled={loadingChat}
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-50"
                />
                <button type="submit" disabled={!inputText.trim() || loadingChat} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                  <FontAwesomeIcon icon={faPaperPlane} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  )
}