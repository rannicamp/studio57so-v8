'use client'

import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRobot, faPaperPlane, faTimes, faCheckCircle, faMagic,
  faCalendarAlt, faBuilding, faListUl, faEdit, faTrash, faSave,
  faArrowLeft, faPlus, faComments, faPen,
  faAlignLeft, faSitemap, faClock, faUser, faMicrophone
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

  // ESTADOS DE ÁUDIO
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

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

  // --- HELPER DE DATAS ---
  const formatDate = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

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

  // --- FUNÇÕES DE ÁUDIO ---
  async function handleAudioRecord() {
    if (isRecording) {
      // Para gravação
      setIsRecording(false);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop()); // Libera o microfone

        // Converte Blob para Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          setLoadingChat(true);
          try {
            const res = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/webm' })
            });
            const data = await res.json();
            if (res.ok && data.text) {
              setInputText(prev => prev + (prev ? ' ' : '') + data.text);
            } else {
              toast.error(data.error || 'Erro na transcrição');
            }
          } catch (err) {
            toast.error('Erro ao conectar com API de transcrição');
          } finally {
            setLoadingChat(false);
          }
        };
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error('Permissão de microfone negada ou indisponível.');
    }
  }

  // --- FUNÇÕES DE CHAT ---
  async function handleSendMessage(e) {
    e?.preventDefault()
    if (!inputText.trim() || loadingChat) return

    const userMsg = inputText
    setInputText('')
    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoadingChat(true)

    try {
      const result = await generateActivityPlan(newMessages, organizacaoId, usuarioId, proposedPlan)
      if (result.success) {
        if (result.type === 'plan') {
          setProposedPlan(result.data)
          setMessages(prev => [...prev, {
            role: 'ai',
            content: result.message || (proposedPlan ? 'Plano atualizado.' : `Gerei ${result.data.length} atividades.`)
          }])
        } else {
          // A IA apenas respondeu uma mensagem textual (conversando)
          setMessages(prev => [...prev, { role: 'ai', content: result.message }])
        }
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: result.message }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Erro de conexão.' }])
    } finally {
      setLoadingChat(false)
    }
  }

  async function handleApproveAll() {
    if (!proposedPlan) return
    setSaving(true)
    try {
      const result = await confirmActivityPlan(
        proposedPlan,
        organizacaoId,
        usuarioId,
        currentSession ? currentSession.current_plan : []
      )
      if (result.success) {
        toast.success('Plano completo salvo na agenda!')
        setProposedPlan(result.finalPlan || [])
        if (currentSession) {
          await saveSessionState(currentSession.id, messages, result.finalPlan || [])
        }
        onSuccess?.()
      }
    } catch {
      toast.error('Erro ao salvar plano completo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSingle(index, activity) {
    setSaving(true)
    try {
      // Mandamos apenas essa atividade, fingindo que o plano atual é vazio para não deletar as outras
      const result = await confirmActivityPlan([activity], organizacaoId, usuarioId, [])
      if (result.success && result.finalPlan && result.finalPlan.length > 0) {
        toast.success(`Atividade "${activity.nome}" salva com sucesso!`)
        
        // Substituimos a atividade no array pelo objeto real retornado no banco (com ID real)
        const newPlan = [...proposedPlan]
        newPlan[index] = result.finalPlan[0]
        setProposedPlan(newPlan)

        // Salvar a Sessão
        if (currentSession) {
          const currentSessionPlanState = currentSession.current_plan || []
          // Adiciona ou substitui na sessao
          const existingIdx = currentSessionPlanState.findIndex(a => a.id === result.finalPlan[0].id)
          if(existingIdx >= 0) currentSessionPlanState[existingIdx] = result.finalPlan[0]
          else currentSessionPlanState.push(result.finalPlan[0])
          await saveSessionState(currentSession.id, messages, currentSessionPlanState)
        }
        
        onSuccess?.()
      }
    } catch {
      toast.error('Erro ao salvar a atividade.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 w-full transition-all duration-300 ease-in-out bg-white shadow-2xl z-50 flex flex-col animate-slide-left border-l border-gray-100 font-sans ${view === 'chat' && proposedPlan ? 'md:w-[900px]' : 'md:w-[500px]'}`}>

        {/* HEADER DINÂMICO */}
        <header className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'chat' ? (
              <button onClick={() => setView('list')} className="hover:bg-gray-200 text-gray-600 p-2 rounded-full transition-colors">
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
            ) : (
              <div className="bg-gray-200 text-gray-600 p-2 rounded-full"><FontAwesomeIcon icon={faRobot} /></div>
            )}
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                {view === 'list' ? 'Meus Planejamentos' : currentSession?.title || 'Assistente IA'}
              </h3>
              <p className="text-xs text-gray-500">
                {view === 'list' ? 'Histórico de conversas' : 'Gerando plano...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
        </header>

        {/* --- VIEW: LISTA DE CONVERSAS --- */}
        {view === 'list' && (
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <button
              onClick={handleNewChat}
              className="w-full bg-white border-2 border-dashed border-blue-200 text-blue-600 p-4 rounded-md mb-6 hover:bg-blue-50 hover:border-blue-400 transition-all font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <FontAwesomeIcon icon={faPlus} /> Iniciar Novo Planejamento
            </button>

            {loadingList ? (
              <div className="text-center text-gray-400 mt-10"><FontAwesomeIcon icon={faMagic} spin /> Carregando...</div>
            ) : (
              <div className="space-y-3">
                {sessionList.length === 0 && (
                  <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-200">
                    <FontAwesomeIcon icon={faComments} className="text-5xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700">Nenhum planejamento</h3>
                    <p className="text-gray-500 text-sm mt-1">Você ainda não conversou com o assistente.</p>
                  </div>
                )}

                {sessionList.map(session => (
                  <div
                    key={session.id}
                    onClick={() => enterChat(session)}
                    className="bg-white p-4 rounded-md shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow transition-all cursor-pointer group relative"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center border border-blue-100">
                          <FontAwesomeIcon icon={faComments} />
                        </div>
                        <div>
                          {editTitle === session.id ? (
                            <input
                              autoFocus
                              className="border-b border-blue-500 outline-none text-sm font-bold text-gray-800 bg-transparent w-full"
                              defaultValue={session.title}
                              onBlur={(e) => handleRenameSession(session.id, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(session.id, e.currentTarget.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <h4 className="font-bold text-gray-800 text-sm">{session.title}</h4>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">
                            Editado em: {new Date(session.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Ações Hover */}
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditTitle(session.id) }}
                          className="text-gray-400 hover:text-blue-600 p-1"
                          title="Renomear"
                        >
                          <FontAwesomeIcon icon={faPen} size="xs" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
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
          </main>
        )}

        {/* --- VIEW: CHAT & SPLIT VIEW --- */}
        {view === 'chat' && (
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row bg-gray-50">

            {/* Lado Esquerdo: Chat */}
            <div className={`flex flex-col h-full bg-gray-50 transition-all ${proposedPlan ? 'w-full md:w-[450px] border-r border-gray-200' : 'w-full'}`}>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-700 border border-gray-200 rounded-bl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loadingChat && <div className="text-gray-400 text-xs italic ml-2"><FontAwesomeIcon icon={faMagic} spin /> IA Pensando...</div>}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={isRecording ? "Ouvindo... Fale agora." : "Responda ou peça alterações..."}
                      disabled={loadingChat || isRecording}
                      className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50"
                    />
                    <button type="submit" disabled={!inputText.trim() || loadingChat || isRecording} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                      <FontAwesomeIcon icon={faPaperPlane} />
                    </button>
                  </div>
                  
                  {/* Botão de Áudio */}
                  <button 
                    type="button" 
                    onClick={handleAudioRecord} 
                    disabled={loadingChat}
                    className={`p-3 rounded-full transition-colors flex-shrink-0 shadow-sm ${
                      isRecording 
                        ? 'bg-red-500 text-white animate-pulse shadow-red-200' 
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                    }`}
                    title={isRecording ? "Parar e transcrever" : "Falar no microfone"}
                  >
                    <FontAwesomeIcon icon={faMicrophone} />
                  </button>
                </div>
              </form>
            </div>

            {/* Lado Direito: Plano Proposto */}
            {proposedPlan && (
              <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden animate-fade-in-up">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                  <span className="text-sm font-bold text-gray-800 uppercase flex items-center gap-2">
                    <FontAwesomeIcon icon={faListUl} /> Plano Estratégico Sugerido ({proposedPlan.length} itens)
                  </span>
                  <span className="text-xs text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200 font-medium tracking-wide shadow-sm flex items-center gap-1">
                    <FontAwesomeIcon icon={faEdit} /> Revisar
                  </span>
                </div>

                <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-gray-50">
                  {proposedPlan.map((activity, i) => {
                    const todayStr = new Date().toLocaleDateString('en-CA');
                    const prazoStr = activity.data_fim_prevista || activity.data_inicio_prevista;
                    const isOverdue = prazoStr && prazoStr < todayStr && activity.status !== 'Concluído';
                    
                    const isSaved = !!activity.id; // Se a IA apenas inventou, id é undefined.

                    return (
                      <div key={i} className={`bg-white rounded-md shadow p-3 border-l-4 ${isOverdue ? 'border-red-500' : 'border-blue-500'} hover:shadow-lg transition-shadow duration-200 flex flex-col justify-between min-h-[160px] relative`}>
                        
                        <div>
                          {activity.parent_temp_id && (
                            <div className="mb-2 bg-blue-50 border border-blue-100 text-blue-600 text-[10px] px-2 py-1 rounded flex items-center gap-1.5 w-fit max-w-full">
                                <FontAwesomeIcon icon={faSitemap} className="flex-shrink-0" />
                                <span className="truncate font-medium">Sub-tarefa Vinculada</span>
                            </div>
                          )}

                          <div className="flex justify-between items-start mb-2">
                              <p className="text-sm font-bold text-gray-800 truncate pr-2" title={activity.nome}>{activity.nome}</p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                  {isSaved && <p className="text-xs text-gray-400">#{activity.id}</p>}
                              </div>
                          </div>

                          {isOverdue && (
                              <div className="bg-red-100 text-red-700 text-xs font-bold p-1 rounded-md mb-2 flex items-center justify-center gap-2">
                                  <FontAwesomeIcon icon={faExclamationTriangle} />
                                  <span>TAREFA ATRASADA</span>
                              </div>
                          )}

                          {activity.descricao && (
                            <p className="text-xs text-gray-500 mb-2 truncate" title={activity.descricao}>{activity.descricao}</p>
                          )}

                          <div className="text-xs text-gray-600 mt-1 space-y-1">
                              <p className="flex items-center gap-2" title="Datas Previstas">
                                  <FontAwesomeIcon icon={faCalendarAlt} className="w-3 text-gray-400" />
                                  <span>{formatDate(activity.data_inicio_prevista)} {activity.data_fim_prevista && `a ${formatDate(activity.data_fim_prevista)}`}</span>
                              </p>
                              <p className="flex items-center gap-2" title="Duração / Hora">
                                  <FontAwesomeIcon icon={faClock} className="w-3 text-gray-400" />
                                  <span>{activity.hora_inicio ? `Hora: ${activity.hora_inicio} (${activity.duracao_horas}h)` : `Duração: ${activity.duracao_dias} dias`}</span>
                              </p>
                              <p className="flex items-center gap-2" title="Responsável">
                                  <FontAwesomeIcon icon={faUser} className="w-3 text-gray-400" />
                                  <span className="font-semibold">{activity.responsavel_texto || 'A Definir'}</span>
                              </p>
                          </div>
                        </div>

                        <div className="relative mt-4 pt-3 border-t flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide ${activity.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {activity.status || 'Não Iniciado'}
                            </span>
                            
                            <button 
                              onClick={() => handleSaveSingle(i, activity)} 
                              disabled={saving || isSaved} 
                              className={`text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${isSaved ? 'bg-green-100 text-green-700 cursor-default' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
                            >
                              {isSaved ? <><FontAwesomeIcon icon={faCheckCircle} /> Salvo</> : <><FontAwesomeIcon icon={faCheckCircle} /> Salvar</>}
                            </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 z-10 flex-shrink-0">
                  <button onClick={() => setProposedPlan(null)} className="flex-1 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-100 rounded-md transition-colors border border-gray-300">
                    <FontAwesomeIcon icon={faTimes} className="mr-2" /> Ocultar Plano
                  </button>
                  <button onClick={handleApproveAll} disabled={saving} className="w-[50%] py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-md shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    Salvar Todos
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}