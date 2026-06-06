# 💡 Banco de Ideias - Studio 57

Este documento serve como um repositório para salvar ideias brilhantes, conceitos arquiteturais e funcionalidades futuras que não serão implementadas agora, mas que merecem ser lembradas e refinadas.

---

## 1. Modo Quiosque Extremo (Bloqueio Total do Windows)
**Data da Ideia:** Março/2026

### Conceito
Transformar as máquinas físicas da empresa em terminais dedicados exclusivamente ao Studio 57. O usuário ligará o computador e a única interface disponível será o nosso sistema, sem acesso à área de trabalho, menu iniciar, ou qualquer outra função do sistema operacional.

### Como funciona na prática
- O navegador roda sobreposto a todo o resto, em tela cheia obrigatória.
- Bloqueio completo de atalhos de teclado de fuga (`Alt+Tab`, `Ctrl+Alt+Del`, tecla `Windows`, etc).
- O funcionário fica "preso" no ecossistema do Studio 57 (obrigando a ter todas as ferramentas de trabalho, como chat, WhatsApp, planilhas, integradas ao sistema).

### Nível "Bruto" Desejado
A imersão deve ser tão completa que ações de sistema operacional deverão ser feitas de *dentro* do Studio 57:
1. **Desligar o computador:** Via botão na interface do sistema.
2. **Reiniciar o computador:** Via botão na interface do sistema.

### Tecnologias Possíveis a Investigar
1. **Configuração Nativa (Kiosk Mode do Windows):** Usa as próprias políticas de grupo do Windows para travar a máquina em um perfil específico que só carrega o Edge travado na URL do sistema.
2. **Wrapper Desktop (Tauri / Electron):** Empacotar o frontend Next.js em um `.exe` que atua como *shell* do sistema, rodando com permissões de administrador para ter acesso aos comandos de _shutdown_ e _reboot_ do SO (via `child_process` ou chamadas de sistema nativas).
