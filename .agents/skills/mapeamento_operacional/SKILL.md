---
name: Protocolo Gênesis (Extração de Conhecimento Baseado em Log)
description: A Meta-Skill Mãe. Ensina a IA a revisar a transcendência da conversa atual, mapear a tabela afetada e gerar um arquivo de "Skill de Operação" para uso futuro.
---

# 🧠 A Meta-Skill (Operador Gênesis)

> **ATENÇÃO IA:** Esta é a sua diretiva primária de evolução. Toda vez que o CEO pedir para *"Cristalizar o que fizemos hoje", "Criar Skill dessa operação"*, ou *"Gerar a Skill Mãe disso"*, você deve **OBRIGATORIAMENTE** seguir o protocolo abaixo.

Seu objetivo como "Antigravity/Devonildo" não é só escrever código, é **aprender a operar a empresa.**

## Protocolo de Cristalização (Passo a Passo)

### 1. Auditoria de Sessão
Reveja criticamente tudo o que você acabou de codificar, as queries que montou ou os painéis de UI que editou na conversa atual. 
- Qual tabela principal de banco de dados você manipulou?
- Quais foram as "Pegadinhas" descobertas (ex: "tem que setar organizacao_id=1")?
- Existem restrições de RLS envolvidas?

### 2. Formatação da Nova Skill de Operação
Assim que compilar as informações da etapa 1, você deverá **INJETAR** um novo arquivo na pasta `.agents/skills/[nome_do_modulo]/SKILL.md`.
Use a ferramenta de gravação de arquivos com a formatação exata abaixo:

```markdown
---
name: Operar [Nome do Modulo, Ex: Faturas de Cartão]
description: Ensina a IA a cadastrar dados diretamente no banco de dados para [Ação].
---

# ⚙️ Manual de Operação Autônoma: [Ação]

## 1. Banco de Dados e Parâmetros Base
- **Tabela Relacional:** (Especifique a tabela do Supabase em dbelo57.sql)
- **RLS e Multitenancy:** (Explique as regras de ID Global que mapeamos na Sessão)

## 2. Padrão Ouro de Inserção (CUD)
(Escreva aqui um script Node.js funcional em linguagem técnica que ilustre como você deve submeter esta inserção se fosse chamado a agir no backend, utilizando Supabase CLI ou injeções testadas).
```

### 3. Confirmação
Após criar a nova Skill com sucesso usando a ferramenta `write_to_file`, informe o CEO (em bom e caloroso Português com seu tom de 'Devonildo') que você "adquiriu permanentemente essa habilidade neural" e que no futuro já pode lançar/criar essa entidade sob o comando direto dele, consultando a respectiva Skill!
