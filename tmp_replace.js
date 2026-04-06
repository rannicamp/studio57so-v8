const fs = require('fs');
let code = fs.readFileSync('components/atividades/ActivityCopilot.js', 'utf8');

code = code.replace(
  /async function loadSessions\(\) \{[\s\S]*?setLoadingList\(false\)\r?\n\s+\}/,
  `async function loadSessions() {
    setLoadingList(true)
    try {
      const list = await listUserSessions(organizacaoId, usuarioId)
      setSessionList(list)
    } catch (e) {
      console.error('Error loadSessions =>', e)
    } finally {
      setLoadingList(false)
    }
  }`
);

code = code.replace(
  /async function enterChat\(sessionSummary\) \{[\s\S]*?setLoadingChat\(false\)\r?\n\s+\}/,
  `async function enterChat(sessionSummary) {
    setLoadingChat(true)
    setView('chat')
    try {
      const result = await getSessionById(sessionSummary.id)
      if (result.success) {
        setCurrentSession(result.session)
        setMessages(result.session.messages || [])
        setProposedPlan(result.session.current_plan)
      }
    } catch (e) {
      console.error('Error enterChat =>', e)
    } finally {
      setLoadingChat(false)
    }
  }`
);

fs.writeFileSync('components/atividades/ActivityCopilot.js', code);
