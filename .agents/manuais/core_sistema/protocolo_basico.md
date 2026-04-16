# 🛡️ Protocolo Básico de Preservação e Segurança (SaaS Multi-Tenant)

Este é o **Protocolo Básico do Projeto Studio 57 / Elo 57**. As regras contidas aqui são **absolutas e inquebráveis** para evitar degradação de código, efeitos colaterais (bugs em cascata) e exposição indevida de dados.

O objetivo principal deste protocolo é: **Sempre manter o que está funcionando do jeito que está e ter o máximo de cuidado para não quebrar o que já funciona.**

---

## 🛑 1. Regra de Ouro: Identificação da Organização (`organizacao_id`)
Como o sistema é um SaaS Multi-Tenant (Múltiplas Franquias / Organizações), o vazamento de dados entre empresas é o pior erro possível.

* **EXIGÊNCIA:** NUNCA realize uma operação de Leitura (SELECT), Inserção (INSERT), Atualização (UPDATE) ou Exclusão (DELETE) no Banco de Dados sem vincular obrigatoriamente a propriedade `organizacao_id`.
* **APIs e Rotas:** Sempre valide, exija e trafegue o `organizacao_id` em toda rota `app/api/...` ou funções auxiliares em `utils/`.
* **Componentes UI:** Ao criar mutações (TanStack Query) ou fazer requisições POST/GET, recupere o `organizacaoId` do estado global de Autenticação (`useAuth()`) e o injete no payload.
* **Funções Utilitárias:** Nunca abstraia lógicas (ex: envio de WhatsApp) omitindo o `organizacao_id` dos parâmetros. Ele deve ir até o fim da cadeia de requests.

---

## 🛑 2. Regra Fixa: Se funciona, não toque (Preservação)
Regra básica para evitar criação de regressões acidentais em áreas que o usuário não solicitou manutenção explícita.

* **EXIGÊNCIA:** Não remova código legado "feio" se ele está validado e funcional na produção.
* Se for realizar uma manutenção em um arquivo complexo, **isole sua alteração** apenas ao fragmento ou escopo da função associada ao Ticket/Bug.
* **Não refatore** páginas inteiras ou converta paradigmas a menos que o *Ranniere* tenha expressamente autorizado com uma frase como "Faça um refactoring completo".

---

## 🛑 3. Regras Básicas sobre Dependências
1. **Nunca atualize bibliotecas** cegamente. (E.g. Mudanças major de `react-query` v4 para v5, ou `Next.js`).
2. Se for criar um arquivo isolado visual/frontend (ex: Modal, Lista), herde os padrões estéticos do `DESIGN_SYSTEM.md`. Nunca reinvente as paletas de cores ou tokens globais do projeto.

---

> *"Regras básicas para não haver regras."* - Ranniere.
> Siga este documento ao criar, diagnosticar e implantar funções sensíveis, garantindo que a base tecnológica do Studio 57 se mantenha robusta, segura e blindada.
