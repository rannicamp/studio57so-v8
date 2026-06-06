---
description: Regras e padrões oficiais para cadastro, nomenclatura e unidades de medida de materiais (Padrão Ouro Elo 57)
---

# Padronização Ouro de Materiais do Studio 57

Este documento consolida a inteligência e as regras de negócio utilizadas para a manutenção e cadastro de itens na tabela `materiais`. Qualquer Agente de IA manipulando estoques, orçamentos, compras ou criando novos componentes de listagem e cadastro de materiais deve impreterivelmente obedecer às diretrizes descritas aqui.

## 1. Regras de Nomenclatura (Title Case)

Todos os nomes de materiais devem seguir a formatação **Title Case** (Letra Maiúscula para a primeira letra das palavras chave), ignorando conectivos.

- **Correto:** `Saco de Cimento Cp3`
- **Correto:** `Abraçadeira Galvanizada 76mm C/ 2 Parafusos`
- **Incorreto:** `SACO DE CIMENTO CP3` (Caixa alta não é permitida)
- **Incorreto:** `Saco de cimento cp3` (Somente 1ª letra da frase não é suficiente)

Conectivos que sempre ficam em letra minúscula: `de`, `da`, `do`, `das`, `dos`, `e`, `em`, `com`, `para`, `sem`, `por`, `a`, `o`, `as`, `os`, `um`, `uma`, `uns`, `umas`, `p/`, `c/`.

---

## 2. Regras de Inteligência de Unidade de Medida (unidade_medida)

A definição correta da unidade de medida do material e a injeção do detalhamento de volume/metragem no nome do produto é fundamental para a exatidão financeira das Ordens de Compra.

Aplica-se a seguinte "Inteligência Comercial":

### A) Tubos, Perfis, Aço e Calhas (Produtos Exigidos em Barras)
- **Unidade Adotada:** `un` (Sempre tratado como 1 Unidade = 1 Barra)
- **Regra de Nomenclatura:** É obrigatório atestar a metragem padrão de recebimento de fábrica injetando `6m` no título caso ele não tenha.
- **Exemplo:** `Tubo Pvc 40mm` -> `Tubo Pvc 40mm 6m` (un)
- **Exemplo:** `Aço Mecânico 06.35` -> `Aço Mecânico 06.35 1/4" 6m` (un)
- **Exemplo:** `Perfil Redondo 1/2 Aco Inox` -> `Perfil Redondo 1/2 Aco Inox 6m` (un)

### B) Trenas, Peneiras, Ferramentas
- **Unidade Adotada:** `un` 
- **Detalhe:** Independente se o nome descreve o tamanho (ex: "Trena 10 Metros"), a compra se dá de maneira estrita na contagem física por unidade.  
- **Exemplo:** `Trena de 10 Metros` (un)

### C) Rolos e Embalagens Contínuas
- **Unidade Adotada:** `un`  
- **Justificativa:** Como o próprio nome do material ("Rolo de Lã", "Rolo de Arame") já atesta o acondicionamento natural do produto, ele é comprado e contabilizado como Unidade (`un`).

### D) Volumes Brutos Entregues via Caminhão (Areia, Terra, Pó de Brita)
- **Unidade Adotada:** `un`
- **Regra de Nomenclatura:** É obrigatório deixar clara a cubagem em que aquele material está precificado vinculando o medidor universal `5m³` ao nome do produto.
- **Exemplo:** `Pó de Brita - Caminhão Toco` -> `Pó de Brita - Caminhão Toco 5m³` (un)

### E) Cimentos e Sacarias Brutas
- **Unidade Adotada:** `sc` (Saco)
- **Regra de Nomenclatura:** Similar aos caminhões, para cimento é obrigatório apontar a quilagem correspondente à saca comercial no final do nome. O padrão da obra é `50kg`.
- **Exemplo:** `Saco de Cimento Cp3` -> `Saco de Cimento Cp3 50kg` (sc)
- *(Observação: "Sacos" como Saco de Lixo seguem apenas `sc` sem quilagem de reforço, a depender da litragem).*

### F) Materiais à Granel (Areia/Brita solta, sem carreto)
- **Unidade Adotada:** `m³` 
- **Contexto:** Usado apenas se a compra não for explicitamente em frete fechado de Caminhão (Caminhão Fechado cai na Regra D).

### G) Projetos Executivos, Estruturais e Elétricos
- **Unidade Adotada:** `un`
- **Justificativa:** Todo "Projeto" elaborado e entregue por fornecedores/freelancers no sistema financeiro possui seu lastro medido em unidade fechada, e não em Conjunto `cj` como era no passado.

### H) Cabos, Fios ou Metragens Lineares
- **Unidade Adotada:** `m`
- **Contexto:** Tudo atestado exclusivamente e de forma fracionária na loja por metro rodado no tambor (ex: `Cabo Coaxial`, `Cabo Flexível de Cobre 2.5mm`).

---

## 3. Comandos Analíticos Úteis 

Caso uma IA precise validar se o banco mantém-se coeso usando esse padrão:
- **Verificar Vazios:** Nunca permita que tenhamos produtos sem `unidade_medida` no banco de dados. Um script rápido usando `supabase-js` em `unidade_medida.is.null` deve retornar 0 sempre.
- **Limpeza de Falsos Positivos:** `Tampão` ou peças com a raiz `terra` no nome podem acionar regras indevidas referenciando m³ de terra. Deve-se assegurar tratamentos manuais garantindo sua integridade (`un`).
