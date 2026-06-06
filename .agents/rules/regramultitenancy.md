---
trigger: always_on
---

- **Regra implementada (Multitenancy SaaS):** Dados da Organização 1 (Elo 57 / Matriz) são **públicos para leitura** por qualquer usuário logado `(organizacao_id = get_auth_user_org() OR organizacao_id = 1)`. Cada organização só pode **criar/editar/excluir** os seus próprios dados. Dados da Org 1 são somente editáveis por membros da própria Org 1.
    - **REGRA INQUEBRÁVEL (Nulos/Globais):** O sistema NÃO DEVE usar `organizacao_id IS NULL` para burlar RLS (risco de segurança grave). Registros globais do sistema **obrigatóriamente** pertencem à Organização 1. A ausência de ID (Null) é indicativo de falha de script e os dados ficarão invisíveis.