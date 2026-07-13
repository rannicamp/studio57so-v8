# Manual do Desenvolvedor: Gestão do Hub e APIs Autodesk Platform Services (APS)

Este documento serve como guia de referência técnica para a gestão de chaves, aplicativos, cotas e faturamento do serviço de visualizador 3D (Autodesk APS, antigo Forge) no Studio 57 (Elo 57).

---

## 🌐 1. Links Principais de Acesso

*   **Portal Geral do Desenvolvedor Autodesk (APS)**: [https://aps.autodesk.com/](https://aps.autodesk.com/)
*   **Console de Aplicativos (My Apps)**: [https://developer.autodesk.com/myapps](https://developer.autodesk.com/myapps)
*   **Gestão de Contas e Assinaturas Autodesk**: [https://manage.autodesk.com/](https://manage.autodesk.com/)

---

## 🛠️ 2. Como Acessar o Hub de Desenvolvedores (APS Developer Hub)

Quando for necessário gerenciar os limites de cota da API ou as credenciais do aplicativo `Studio 57 Manager`, siga este passo a passo exato:

1.  Acesse o portal da Autodesk Account: [https://manage.autodesk.com/](https://manage.autodesk.com/) e faça login com as credenciais da conta do Ranniere.
2.  No menu superior horizontal, clique na opção **Produtos e serviços** (*Products and Services*).
3.  Nas sub-abas localizadas logo abaixo do menu superior, role até o final (à direita) e selecione a aba **Hubs**.
4.  Na tabela de Hubs ativos, você verá o hub do desenvolvedor:
    *   **Nome**: `Studio 57 Manager`
    *   **Produto**: `APS Developer Hub`
5.  Clique no link **APS Developer Hub** ou no nome do hub para entrar no painel interno de gestão do ecossistema de desenvolvimento do Studio 57.

---

## ⚠️ 3. Diagnóstico e Resolução de Erros de Cota ("API quota reached")

Se a Autodesk apresentar o erro `403 Forbidden` com a mensagem `ProductAccessRequiresCapacity` e a planilha de orçamentos BIM local travar o status do arquivo em `'Erro (Autodesk sem créditos)'`:

1.  Acesse o hub de desenvolvedor conforme a seção acima.
2.  No painel superior do console, você verá a tarja de alerta:
    > ⚠️ **API quota reached** - *Your team has reached its quota for some APIs. Apps that depend on these services are affected.*
3.  O aplicativo `Studio 57 Manager` na lista de **Applications** estará com um badge de exclamação vermelho.
4.  Para normalizar:
    *   Clique no botão **View in Account** ou acesse a página de uso de recursos: [https://manage.autodesk.com/feature-usage/](https://manage.autodesk.com/feature-usage/)
    *   Verifique se há necessidade de adquirir mais **Flex Tokens** ou contratar um plano de capacidade mensal superior para expandir os limites da Model Derivative API (responsável por converter arquivos `.rvt` do Revit para maquetes 3D e extração de dados).
