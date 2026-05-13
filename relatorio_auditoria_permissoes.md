# 🛡️ Relatório Oficial de Auditoria de Segurança

> [!NOTE]
> **Objetivo:** Este documento cruza as regras de permissões exigidas no código-fonte com as tabelas do banco de dados, mapeando a atual superfície de ataque e identificando possíveis vazamentos de dados entre usuários.

## 🎯 1. Cobertura de Recursos Oficiais

Análise dos 19 recursos homologados pelo sistema e onde eles estão protegendo as rotas e botões.

### ✅ Recursos Ativos e Protegendo Telas
| Recurso | Telas & Componentes Vigiados | Trava Exigida |
|---|---|---|
| **empresas** | `components\empresas\EmpresaManager.js` | `pode_criar` |
| **empreendimentos** | `app\(main)\empreendimentos\page.js`<br>`components\empreendimentos\EmpreendimentoManager.js` | `pode_ver` `pode_criar` |
| **atividades** | `app\(main)\atividades\page.js`<br>`components\painel\widgets\QuickActionsWidget.js` | `pode_ver` `pode_criar` `pode_editar` `pode_excluir` |
| **rdo** | `components\rdo\RdoForm.js` | `pode_criar` `pode_excluir` |
| **financeiro** | `app\(main)\configuracoes\financeiro\page.js`<br>`app\(main)\financeiro\page.js`<br>`components\financeiro\ContasManager.js`<br>`components\financeiro\ExtratoCartaoManager.js`<br>`components\financeiro\ExtratoManager.js`<br>`components\painel\widgets\QuickActionsWidget.js` | `pode_ver` `pode_criar` `pode_editar` `pode_excluir` |
| **ponto** | `components\rh\GerenciamentoPonto.js` | `pode_criar` `pode_editar` |
| **pedidos** | `app\(main)\pedidos\page.js`<br>`components\painel\widgets\QuickActionsWidget.js` | `pode_excluir` `pode_criar` |
| **caixa_de_entrada** | `app\(main)\caixa-de-entrada\page.js` | `pode_ver` |

### ⚠️ Recursos Órfãos (Risco de Inutilidade)
> [!WARNING]
> Os seguintes recursos existem no painel de configurações, mas **nenhum** arquivo do sistema está validando essas chaves. Se um usuário tiver essa permissão, ela não serve para nada atualmente.

- **funcionarios**
- **usuarios**
- **permissoes**
- **orcamento**
- **crm**
- **contatos**
- **simulador**
- **contratos**
- **anuncios**
- **dashboard**
- **funil**

## 🚨 Gaps Críticos: Recursos Fantasmas
> [!CAUTION]
> Os arquivos abaixo estão bloqueando o acesso de usuários baseados em permissões que **não existem** no banco de dados. Isso significa que usuários comuns nunca poderão acessar essas áreas.

- 🛑 **config_kpi_builder** bloqueando acesso em: `app\(main)\configuracoes\painel\construtor\page.js`

## 🗄️ 2. Mapeamento de Conexões de Banco de Dados

> [!TIP]
> Para garantir 100% de segurança, verifique se os arquivos listados abaixo possuem a trava `hasPermission` na renderização visual. Se um arquivo altera uma tabela e não possui a trava, temos um **vazamento de front-end**.

#### Tabela: `abono_tipos`
- `components\rh\FolhaPonto.js`

#### Tabela: `abonos`
- `app\(main)\funcionarios\visualizar\[id]\page.js`
- `app\(main)\relatorios\rh\page.js`
- `components\painel\widgets\MeuRhWidget.js`
- `components\rh\ColaboradorDetailPanel.js`
- `components\rh\FolhaPonto.js`

#### Tabela: `activities`
- `app\(main)\atividades\page.js`
- `components\atividades\AtividadeDetalhesSidebar.js`
- `components\atividades\form\ActivityBasicInfo.js`
- `components\atividades\form\ActivityModalRoot.js`
- `components\crm\CrmDetalhesSidebar.js`
- `components\painel\widgets\MinhasAtividadesWidget.js`
- `components\rdo\RdoForm.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `activity-anexos`
- `components\atividades\AtividadeAnexos.js`
- `components\atividades\AtividadeDetalhesSidebar.js`

#### Tabela: `activity_anexos`
- `components\atividades\AtividadeAnexos.js`

#### Tabela: `atividades_elementos`
- `components\atividades\form\ActivityModalRoot.js`
- `components\bim\BimElementPlanning.js`

#### Tabela: `auditoria_ia_logs`
- `components\financeiro\LancamentoDetalhesSidebar.js`

#### Tabela: `automacoes`
- `app\(main)\automacao\page.js`

#### Tabela: `avatars`
- `components\rh\ColaboradorDetailPanel.js`
- `components\rh\RHManager.js`

#### Tabela: `banco_arquivos_ofx`
- `components\financeiro\ConciliacaoManager.js`
- `components\financeiro\ExtratoCartaoManager.js`
- `components\financeiro\ExtratoManager.js`
- `components\financeiro\OfxUploader.js`
- `components\financeiro\PanelConciliacaoCartao.js`

#### Tabela: `banco_de_horas`
- `components\rh\FolhaPonto.js`

#### Tabela: `banco_transacoes_ofx`
- `components\financeiro\ConciliacaoManager.js`
- `components\financeiro\ExtratoCartaoManager.js`
- `components\financeiro\ExtratoManager.js`
- `components\financeiro\OfxUploader.js`
- `components\financeiro\PanelConciliacaoCartao.js`
- `components\financeiro\PanelConciliacaoOFX.js`

#### Tabela: `bim_mapeamentos_propriedades`
- `components\bim\BimGerenciarVinculosModal.js`
- `components\bim\BimInsumoAvulsoModal.js`

#### Tabela: `bim_notas`
- `components\bim\BimNoteModal.js`
- `components\bim\BimNotesList.js`

#### Tabela: `bim_notas_comentarios`
- `components\bim\BimNotesList.js`

#### Tabela: `bim_notas_elementos`
- `components\bim\BimNoteModal.js`

#### Tabela: `bim_vistas_federadas`
- `components\bim\BimSetModal.js`
- `components\bim\BimSidebar.js`

#### Tabela: `cadastro_empresa`
- `app\(main)\atividades\page.js`
- `app\(main)\crm\page.js`
- `app\(main)\empresas\page.js`
- `app\(main)\financeiro\conciliacao\page.js`
- `app\(main)\financeiro\page.js`
- `app\(main)\MainLayoutClient.js`
- `components\bim\BimEditModal.js`
- `components\bim\BimSidebar.js`
- `components\bim\BimUploadModal.js`
- `components\contatos\ContatoForm.js`
- `components\empreendimentos\EmpreendimentoDetailWrapper.js`
- `components\empreendimentos\EmpreendimentoFormModal.js`
- `components\empresas\EmpresaDetails.js`
- `components\empresas\EmpresaDetailWrapper.js`
- `components\empresas\EmpresaFormModal.js`
- `components\financeiro\FiltroFinanceiro.js`
- `components\financeiro\ImportacaoFinanceiraManager.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\gerenciador-de-arquivos\AdicionarArquivoModal.js`
- `components\materiais\MaterialManager.js`
- `components\painel\ConstrutorKpiForm.js`
- `components\relatorios\financeiro\FinanceiroDashboard.js`
- `components\relatorios\financeiro\RelatorioDREContainer.js`
- `components\relatorios\obras\RelatorioCustosObraContainer.js`
- `components\rh\FuncionarioModal.js`

#### Tabela: `campos_sistema`
- `components\notificacao\GerenciadorNotificacoes.js`

#### Tabela: `cargos`
- `components\configuracoes\rh\CargosManager.js`
- `components\rh\FuncionarioModal.js`

#### Tabela: `categorias_financeiras`
- `app\(main)\financeiro\page.js`
- `components\financeiro\AtivoFormModal.js`
- `components\financeiro\CategoriasManager.js`
- `components\financeiro\FiltroFinanceiro.js`
- `components\financeiro\ImportacaoFinanceiraManager.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\financeiro\LancamentoImporter.js`
- `components\financeiro\LancamentosManager.js`
- `components\painel\ConstrutorKpiForm.js`
- `components\relatorios\financeiro\FinanceiroDashboard.js`
- `components\relatorios\financeiro\RelatorioDREContainer.js`
- `components\relatorios\obras\RelatorioCustosObraContainer.js`
- `components\rh\AjusteSaldoModal.js`

#### Tabela: `clientes`
- `components\pedidos\PedidoForm.js`

#### Tabela: `colunas_funil`
- `app\(main)\crm\capiActions.js`
- `app\(main)\crm\page.js`
- `components\crm\ContatoCardCRM.js`
- `components\whatsapp\ContactProfile.js`
- `components\whatsapp\CreateBroadcastModal.js`
- `components\whatsapp\QuickCardModal.js`

#### Tabela: `configuracoes_venda`
- `app\(main)\empreendimentos\[id]\produtos\page.js`
- `components\comercial\TabelaVendaCorretorAba.js`
- `components\CondicoesPagamento.js`

#### Tabela: `configuracoes_whatsapp`
- `app\(main)\caixa-de-entrada\data-fetching.js`
- `app\(main)\configuracoes\integracoes\page.js`
- `components\configuracoes\IntegrationsManager.js`
- `components\integracoes\WhatsappButton.js`

#### Tabela: `contas_financeiras`
- `app\(main)\configuracoes\financeiro\page.js`
- `app\(main)\financeiro\conciliacao\page.js`
- `app\(main)\financeiro\page.js`
- `components\contratos\DetalhesVendaContrato.js`
- `components\financeiro\ContasManager.js`
- `components\financeiro\FiltroFinanceiro.js`
- `components\financeiro\ImportacaoFinanceiraManager.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\financeiro\LancamentoImporter.js`
- `components\financeiro\OfxUploader.js`
- `components\painel\ConstrutorKpiForm.js`
- `components\pedidos\PedidoForm.js`
- `components\relatorios\financeiro\FinanceiroDashboard.js`
- `components\relatorios\financeiro\RelatorioDREContainer.js`
- `components\relatorios\obras\RelatorioCustosObraContainer.js`
- `components\rh\AjusteSaldoModal.js`
- `components\rh\LancarValeModal.js`

#### Tabela: `contatos`
- `app\(main)\contatos\editar\[id]\page.js`
- `app\(main)\contatos\formatar-telefones\page.js`
- `app\(main)\contatos\page.js`
- `app\(main)\contratos\page.js`
- `app\(main)\crm\actions-meta-mapping.js`
- `app\(main)\crm\automacao\page.js`
- `app\(main)\crm\page.js`
- `app\(main)\financeiro\page.js`
- `app\(main)\pedidos\page.js`
- `app\(main)\relatorios\radar\actions.js`
- `components\configuracoes\UserManagementForm.js`
- `components\contatos\actions.js`
- `components\contatos\ContatoDetalhesSidebar.js`
- `components\contatos\ContatoForm.js`
- `components\contatos\ContatoImporter.js`
- `components\contatos\PadronizacaoManager.js`
- `components\contratos\DetalhesVendaContrato.js`
- `components\crm\CrmDetalhesSidebar.js`
- `components\email\EmailComposeModal.js`
- `components\empreendimentos\EmpreendimentoFormModal.js`
- `components\financeiro\FiltroFinanceiro.js`
- `components\financeiro\ImportacaoFinanceiraManager.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\financeiro\LancamentoImporter.js`
- `components\instagram\InstagramProfileSidebar.js`
- `components\integracoes\SyncAllContactsButton.js`
- `components\painel\ConstrutorKpiForm.js`
- `components\painel\widgets\ComercialWidget.js`
- `components\pedidos\PedidoItemModal.js`
- `components\relatorios\financeiro\FinanceiroDashboard.js`
- `components\relatorios\financeiro\RelatorioDREContainer.js`
- `components\relatorios\obras\RelatorioCustosObraContainer.js`
- `components\rh\ColaboradorDetailPanel.js`
- `components\rh\EmployeeList.js`
- `components\rh\FuncionarioModal.js`
- `components\rh\NovoContratoModal.js`
- `components\rh\RHManager.js`
- `components\shared\VincularContatoModal.js`
- `components\simuladores\SimuladorBraunas.js`
- `components\SimuladorFinanceiroPublico.js`
- `components\whatsapp\ContactProfile.js`
- `components\whatsapp\CreateBroadcastModal.js`
- `components\whatsapp\NewConversationModal.js`
- `components\whatsapp\WhatsAppInbox.js`

#### Tabela: `contatos_no_funil`
- `app\(main)\crm\capiActions.js`
- `app\(main)\crm\page.js`
- `components\whatsapp\ContactProfile.js`
- `components\whatsapp\QuickCardModal.js`

#### Tabela: `contatos_no_funil_produtos`
- `app\(main)\crm\page.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `contrato_anexos`
- `components\contratos\ContratoAnexos.js`

#### Tabela: `contrato_parcelas`
- `components\contratos\CronogramaFinanceiro.js`

#### Tabela: `contrato_permutas`
- `components\contratos\CronogramaFinanceiro.js`

#### Tabela: `contrato_produtos`
- `app\(main)\contratos\actions.js`
- `app\(main)\contratos\[id]\page.js`
- `app\(main)\relatorios\empreendimentos\page.js`
- `components\contratos\ContratoForm.js`
- `components\contratos\DetalhesVendaContrato.js`
- `components\contratos\FichaContrato.js`
- `components\produtos\ProdutoList.js`

#### Tabela: `contratos`
- `app\(main)\contratos\actions.js`
- `app\(main)\contratos\page.js`
- `app\(main)\contratos\[id]\page.js`
- `app\(main)\relatorios\empreendimentos\page.js`
- `components\contratos\ContratoForm.js`
- `components\contratos\ContratoList.js`
- `components\contratos\DetalhesVendaContrato.js`
- `components\contratos\ExtratoFinanceiroCliente.js`
- `components\contratos\FichaContrato.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\produtos\ProdutoList.js`
- `components\relatorios\RelatorioContratosBase.js`

#### Tabela: `contratos-documentos`
- `components\rh\contratos\ContratoDocumentos.js`

#### Tabela: `contratos_terceirizados`
- `app\(main)\recursos-humanos\contratos\[id]\page.js`
- `components\rh\contratos\ContratoGeral.js`
- `components\rh\GerenciamentoTerceirizados.js`
- `components\rh\NovoContratoModal.js`

#### Tabela: `contratos_terceirizados_anexos`
- `components\rh\contratos\ContratoDocumentos.js`

#### Tabela: `crm_notas`
- `components\crm\CrmDetalhesSidebar.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `crm_rodizio_config`
- `components\crm\RodizioConfigModal.js`

#### Tabela: `diarios_obra`
- `app\(main)\rdo\gerenciador\page.js`
- `app\(main)\rdo\[id]\page.js`
- `components\rdo\RdoForm.js`
- `components\rdo\RdoListManager.js`

#### Tabela: `disciplinas_projetos`
- `components\bim\BimEditModal.js`
- `components\bim\BimSidebar.js`
- `components\bim\BimUploadModal.js`

#### Tabela: `documento_tipos`
- `app\(main)\configuracoes\tipos-documento\page.js`
- `components\configuracoes\TipoDocumentoManager.js`
- `components\contratos\ContratoAnexos.js`
- `components\empreendimentos\EmpreendimentoDetailWrapper.js`
- `components\empresas\EmpresaDetailWrapper.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\gerenciador-de-arquivos\AdicionarArquivoModal.js`
- `components\pedidos\PedidoForm.js`
- `components\rh\contratos\ContratoDocumentos.js`
- `components\rh\FichaCompletaFuncionario.js`

#### Tabela: `documentos-financeiro`
- `components\financeiro\DocumentosManager.js`
- `components\financeiro\ExtratoCartaoManager.js`
- `components\financeiro\LancamentoDetalhesSidebar.js`
- `components\financeiro\LancamentoFormModal.js`

#### Tabela: `documentos_funcionarios`
- `app\(main)\funcionarios\visualizar\[id]\page.js`
- `components\rh\ColaboradorDetailPanel.js`
- `components\rh\FichaCompletaFuncionario.js`

#### Tabela: `elementos_bim`
- `components\bim\BimElementBudget.js`
- `components\bim\BimFilterPanel.js`
- `components\bim\BimProperties.js`

#### Tabela: `email_configuracoes`
- `components\email\EmailComposeModal.js`
- `components\email\EmailConnectionConfig.js`
- `components\email\EmailRulesConfig.js`
- `components\email\EmailSidebar.js`
- `components\email\EmailSignatureConfig.js`

#### Tabela: `email_messages_cache`
- `components\email\EmailInbox.js`

#### Tabela: `emails`
- `app\(main)\contatos\editar\[id]\page.js`
- `components\contatos\actions.js`
- `components\contatos\ContatoForm.js`
- `components\contatos\ContatoImporter.js`
- `components\crm\CrmDetalhesSidebar.js`
- `components\email\EmailComposeModal.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `empreendimento-anexos`
- `app\(main)\gerenciador-de-arquivos\page.js`
- `components\contratos\ContratoAnexos.js`
- `components\empreendimentos\EmpreendimentoDetails.js`
- `components\empreendimentos\EmpreendimentoDetailWrapper.js`
- `components\gerenciador-de-arquivos\AdicionarArquivoModal.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `empreendimento_anexos`
- `app\(main)\gerenciador-de-arquivos\page.js`
- `components\empreendimentos\EmpreendimentoDetails.js`
- `components\empreendimentos\EmpreendimentoDetailWrapper.js`
- `components\gerenciador-de-arquivos\AdicionarArquivoModal.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `empreendimentos`
- `app\(main)\contratos\page.js`
- `app\(main)\empreendimentos\page.js`
- `app\(main)\empreendimentos\[id]\produtos\page.js`
- `app\(main)\financeiro\page.js`
- `app\(main)\rdo\page.js`
- `app\(main)\relatorios\empreendimentos\page.js`
- `app\(main)\simulador-financiamento\page.js`
- `components\bim\BimEditModal.js`
- `components\bim\BimSidebar.js`
- `components\bim\BimUploadModal.js`
- `components\comercial\TabelaVendaCorretorAba.js`
- `components\contratos\ContratoForm.js`
- `components\empreendimentos\EmpreendimentoCard.js`
- `components\empreendimentos\EmpreendimentoDetails.js`
- `components\empreendimentos\EmpreendimentoDetailWrapper.js`
- `components\empreendimentos\EmpreendimentoFormModal.js`
- `components\empreendimentos\EmpreendimentoList.js`
- `components\financeiro\FiltroFinanceiro.js`
- `components\financeiro\ImportacaoFinanceiraManager.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\gerenciador-de-arquivos\AdicionarArquivoModal.js`
- `components\painel\ConstrutorKpiForm.js`
- `components\relatorios\financeiro\FinanceiroDashboard.js`
- `components\relatorios\financeiro\RelatorioDREContainer.js`
- `components\relatorios\obras\RelatorioCustosObraContainer.js`
- `components\rh\FuncionarioModal.js`
- `components\TabelaVenda.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `empresa-anexos`
- `components\empresas\EmpresaDetails.js`
- `components\empresas\EmpresaDetailWrapper.js`

#### Tabela: `empresa_anexos`
- `components\empresas\EmpresaDetails.js`
- `components\empresas\EmpresaDetailWrapper.js`

#### Tabela: `estoque`
- `components\almoxarifado\AdicionarMaterialManualModal.js`
- `components\almoxarifado\AlmoxarifadoManager.js`

#### Tabela: `etapa_obra`
- `app\(main)\financeiro\page.js`
- `app\(main)\pedidos\page.js`
- `components\atividades\form\ActivityContextFields.js`
- `components\bim\BimQuantitativosOverlay.js`
- `components\financeiro\FiltroFinanceiro.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\orcamento\OrcamentoDetalhes.js`
- `components\pedidos\PedidoForm.js`
- `components\pedidos\PedidoItemModal.js`

#### Tabela: `faturas_cartao`
- `components\financeiro\ExtratoCartaoManager.js`
- `components\financeiro\LancamentoDetalhesSidebar.js`
- `components\financeiro\PanelConciliacaoCartao.js`

#### Tabela: `feedback`
- `app\(main)\admin\feedbacks\page.js`
- `app\(main)\configuracoes\feedback\visualizar\page.js`
- `components\feedback\FeedbackKanban.js`

#### Tabela: `feedbacks`
- `components\feedback\FeedbackModal.js`

#### Tabela: `feriados`
- `app\(main)\relatorios\rh\page.js`
- `components\configuracoes\rh\JornadasSection.js`
- `components\painel\widgets\MeuRhWidget.js`
- `components\rh\FeriadoManager.js`
- `components\rh\FolhaPonto.js`

#### Tabela: `funcionarios`
- `app\(main)\atividades\page.js`
- `app\(main)\configuracoes\usuarios\page.js`
- `app\(main)\crm\page.js`
- `app\(main)\financeiro\page.js`
- `app\(main)\funcionarios\visualizar\[id]\page.js`
- `app\(main)\MainLayoutClient.js`
- `app\(main)\relatorios\rh\page.js`
- `components\almoxarifado\BaixaEstoqueModal.js`
- `components\almoxarifado\PainelMovimentacoes.js`
- `components\almoxarifado\RegistrarRetiradaModal.js`
- `components\configuracoes\rh\CargosManager.js`
- `components\contatos\LinkEmployeesToContacts.js`
- `components\financeiro\PlanejamentoFolha.js`
- `components\painel\RhSection.js`
- `components\painel\widgets\MeuRhWidget.js`
- `components\rdo\RdoForm.js`
- `components\rh\ColaboradorDetailPanel.js`
- `components\rh\EmployeeList.js`
- `components\rh\FichaFuncionario.js`
- `components\rh\FolhaPonto.js`
- `components\rh\FuncionarioModal.js`
- `components\rh\GerenciamentoFuncionarios.js`
- `components\rh\GerenciamentoPonto.js`
- `components\rh\PontoImporter.js`
- `components\rh\RHManager.js`

#### Tabela: `funcionarios-documentos`
- `app\(main)\funcionarios\visualizar\[id]\page.js`
- `components\rh\ColaboradorDetailPanel.js`
- `components\rh\FichaCompletaFuncionario.js`
- `components\rh\RHManager.js`

#### Tabela: `funcoes`
- `app\(main)\configuracoes\permissoes\page.js`
- `app\(main)\configuracoes\usuarios\page.js`
- `components\configuracoes\PermissionManager.js`
- `components\notificacao\ConfiguracaoNotificacoes.js`
- `components\notificacao\GerenciadorNotificacoes.js`

#### Tabela: `funis`
- `app\(main)\crm\automacao\page.js`
- `app\(main)\crm\page.js`
- `components\crm\AutomacaoModal.js`
- `components\crm\ContatoCardCRM.js`
- `components\whatsapp\CreateBroadcastModal.js`
- `components\whatsapp\QuickCardModal.js`

#### Tabela: `historico_lancamentos_financeiros`
- `components\financeiro\AuditoriaManager.js`

#### Tabela: `historico_movimentacao_funil`
- `components\crm\CrmDetalhesSidebar.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `historico_salarial`
- `app\(main)\relatorios\rh\page.js`
- `components\rh\FichaCompletaFuncionario.js`
- `components\rh\FolhaPonto.js`
- `components\rh\FuncionarioModal.js`

#### Tabela: `indices_governamentais`
- `components\configuracoes\IndicesManager.js`
- `components\contratos\ExtratoFinanceiroCliente.js`

#### Tabela: `instagram_conversations`
- `components\instagram\InstagramInbox.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `integracoes_google`
- `app\(main)\configuracoes\integracoes\page.js`

#### Tabela: `integracoes_meta`
- `app\(main)\configuracoes\integracoes\page.js`
- `app\(main)\relatorios\radar\actions.js`

#### Tabela: `jornada_detalhes`
- `components\rh\JornadaManager.js`

#### Tabela: `jornadas`
- `components\configuracoes\rh\JornadasSection.js`
- `components\rh\FuncionarioModal.js`
- `components\rh\JornadaManager.js`

#### Tabela: `kpis_personalizados`
- `app\(main)\relatorios\financeiro\page.js`
- `components\painel\ConstrutorKpiForm.js`
- `components\painel\ConstrutorKpiManager.js`
- `components\painel\CustomKpiSection.js`
- `components\painel\KpiBuilderModal.js`
- `components\painel\SmartKpiCard.js`

#### Tabela: `lancamentos`
- `app\(main)\financeiro\conciliacao\page.js`
- `components\contratos\ExtratoFinanceiroCliente.js`
- `components\contratos\ParcelasPagas.js`
- `components\financeiro\AtivoFormModal.js`
- `components\financeiro\AtivosManager.js`
- `components\financeiro\AuditoriaFinanceira.js`
- `components\financeiro\conciliacao\index.js`
- `components\financeiro\ConciliacaoManager.js`
- `components\financeiro\ExtratoCartaoManager.js`
- `components\financeiro\ExtratoManager.js`
- `components\financeiro\ImportacaoFinanceiraManager.js`
- `components\financeiro\LancamentoDetalhesSidebar.js`
- `components\financeiro\LancamentoFormModal.js`
- `components\financeiro\LancamentoImporter.js`
- `components\financeiro\LancamentosManager.js`
- `components\financeiro\PagamentoFaturaModal.js`
- `components\financeiro\PanelConciliacaoCartao.js`
- `components\financeiro\PanelConciliacaoOFX.js`
- `components\financeiro\PassivosManager.js`
- `components\financeiro\ReciboModal.js`
- `components\financeiro\TransferenciaFinder.js`
- `components\painel\widgets\FinanceiroWidget.js`
- `components\rh\contratos\ContratoFinanceiro.js`
- `components\rh\FichaCompletaFuncionario.js`
- `components\rh\FolhaPonto.js`

#### Tabela: `lancamentos_anexos`
- `components\financeiro\LancamentoFormModal.js`

#### Tabela: `materiais`
- `components\almoxarifado\AdicionarMaterialManualModal.js`
- `components\almoxarifado\AlmoxarifadoManager.js`
- `components\bim\BimInsumoAvulsoModal.js`
- `components\bim\BimVinculoMaterialModal.js`
- `components\configuracoes\GerenciadorMateriais.js`
- `components\materiais\MaterialImporter.js`
- `components\materiais\MaterialManager.js`
- `components\orcamento\OrcamentoDetalhes.js`
- `components\pedidos\PedidoItemModal.js`

#### Tabela: `meta_form_config`
- `app\(main)\crm\actions-meta-mapping.js`

#### Tabela: `meta_forms_catalog`
- `app\(main)\crm\actions-meta-mapping.js`

#### Tabela: `modelos_contrato`
- `components\contratos\FichaContrato.js`
- `components\contratos\GeradorContrato.js`
- `components\empreendimentos\EmpreendimentoDetails.js`

#### Tabela: `movimentacoes_estoque`
- `components\almoxarifado\AdicionarMaterialManualModal.js`
- `components\almoxarifado\HistoricoMovimentacoesModal.js`

#### Tabela: `notificacoes`
- `components\dashboard\NotificationTimeline.js`
- `components\notificacao\NotificationBell.js`
- `components\painel\widgets\NotificacoesWidget.js`

#### Tabela: `notification_subscriptions`
- `components\notificacao\NotificationManager.js`

#### Tabela: `ocorrencias`
- `components\rdo\RdoForm.js`

#### Tabela: `orcamento_itens`
- `components\bim\BimElementBudget.js`
- `components\orcamento\OrcamentoDetalhes.js`

#### Tabela: `orcamentos`
- `components\orcamento\OrcamentoDetalhes.js`
- `components\orcamento\OrcamentoManager.js`

#### Tabela: `parcelas_adicionais`
- `components\CondicoesPagamento.js`

#### Tabela: `pedidos-anexos`
- `components\pedidos\PedidoForm.js`

#### Tabela: `pedidos_compra`
- `app\(main)\pedidos\page.js`
- `components\pedidos\ComprasKanban.js`
- `components\pedidos\PedidoForm.js`
- `components\rdo\RdoForm.js`

#### Tabela: `pedidos_compra_anexos`
- `components\pedidos\PedidoForm.js`

#### Tabela: `pedidos_compra_historico_fases`
- `components\pedidos\PedidoDetalhesSidebar.js`

#### Tabela: `pedidos_compra_itens`
- `components\pedidos\ComprasKanban.js`
- `components\pedidos\PedidoForm.js`

#### Tabela: `pedidos_fases`
- `app\(main)\pedidos\page.js`

#### Tabela: `permissoes`
- `app\(main)\configuracoes\tipos-documento\page.js`
- `components\configuracoes\PermissionManager.js`

#### Tabela: `politicas_plataforma`
- `app\(main)\configuracoes\politicas\actions.js`
- `components\compliance\TermsUpdateEnforcer.js`

#### Tabela: `pontos`
- `app\(main)\funcionarios\visualizar\[id]\page.js`
- `app\(main)\relatorios\rh\page.js`
- `components\painel\widgets\MeuRhWidget.js`
- `components\rh\ColaboradorDetailPanel.js`
- `components\rh\FolhaPonto.js`

#### Tabela: `produtos_empreendimento`
- `app\(main)\comercial\tabela-de-vendas\page.js`
- `app\(main)\contratos\actions.js`
- `app\(main)\contratos\page.js`
- `app\(main)\crm\page.js`
- `app\(main)\empreendimentos\[id]\produtos\page.js`
- `app\(main)\relatorios\empreendimentos\page.js`
- `components\comercial\TabelaVendaCorretorAba.js`
- `components\contratos\ContratoForm.js`
- `components\contratos\DetalhesVendaContrato.js`
- `components\empreendimentos\EmpreendimentoDetailWrapper.js`
- `components\produtos\ProdutoList.js`
- `components\simuladores\SimuladorBraunas.js`
- `components\SimuladorFinanceiroPublico.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `projetos_bim`
- `components\bim\BimEditModal.js`
- `components\bim\BimFileItem.js`
- `components\bim\BimSidebar.js`
- `components\bim\BimUploader.js`
- `components\bim\BimUploadModal.js`
- `components\bim\ProjectList.js`
- `components\orcamento\OrcamentoDetalhes.js`

#### Tabela: `quadro_de_areas`
- `components\empreendimentos\EmpreendimentoDetailWrapper.js`

#### Tabela: `rdo-fotos`
- `components\rdo\RdoForm.js`
- `components\rdo\RdoPhotoGallery.js`

#### Tabela: `rdo-pdfs`
- `components\rdo\RdoForm.js`

#### Tabela: `rdo_fotos_uploads`
- `app\(main)\rdo\gerenciador\page.js`
- `components\rdo\RdoForm.js`

#### Tabela: `regras_roteamento_funil`
- `app\(main)\crm\automacao\page.js`

#### Tabela: `simulacoes`
- `components\contratos\PlanoPagamentoContrato.js`
- `components\crm\CrmDetalhesSidebar.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `sinapi`
- `components\bim\BimInsumoAvulsoModal.js`
- `components\bim\BimVinculoMaterialModal.js`

#### Tabela: `subetapas`
- `app\(main)\pedidos\page.js`
- `components\atividades\form\ActivityContextFields.js`
- `components\orcamento\BimImportModal.js`
- `components\orcamento\OrcamentoItemModal.js`
- `components\pedidos\PedidoItemModal.js`

#### Tabela: `sys_chat_messages`
- `components\chat\ChatHooks.js`

#### Tabela: `sys_chat_mural_comments`
- `components\chat\ChatMuralHooks.js`

#### Tabela: `sys_chat_mural_likes`
- `components\chat\ChatMuralHooks.js`

#### Tabela: `sys_chat_mural_posts`
- `components\chat\ChatMuralHooks.js`

#### Tabela: `sys_notification_templates`
- `components\notificacao\ConfiguracaoNotificacoes.js`
- `components\notificacao\GerenciadorNotificacoes.js`

#### Tabela: `sys_org_notification_settings`
- `components\notificacao\ConfiguracaoNotificacoes.js`

#### Tabela: `sys_user_notification_prefs`
- `components\perfil\MinhasNotificacoes.js`

#### Tabela: `tabelas_sistema`
- `components\notificacao\ConfiguracaoNotificacoes.js`
- `components\notificacao\GerenciadorNotificacoes.js`
- `components\perfil\MinhasNotificacoes.js`

#### Tabela: `telefones`
- `app\(main)\contatos\editar\[id]\page.js`
- `app\(main)\contatos\formatar-telefones\page.js`
- `components\contatos\actions.js`
- `components\contatos\ContatoForm.js`
- `components\contatos\ContatoImporter.js`
- `components\contatos\PadronizacaoManager.js`
- `components\crm\CrmDetalhesSidebar.js`
- `components\simuladores\SimuladorBraunas.js`
- `components\SimuladorFinanceiroPublico.js`
- `components\whatsapp\ContactProfile.js`

#### Tabela: `usuario_aceite_politicas`
- `app\(main)\configuracoes\politicas\actions.js`
- `components\compliance\TermsUpdateEnforcer.js`

#### Tabela: `usuarios`
- `app\(main)\admin\feedbacks\page.js`
- `app\(main)\comercial\tabela-de-vendas\page.js`
- `app\(main)\configuracoes\feedback\page.js`
- `app\(main)\configuracoes\feedback\visualizar\page.js`
- `app\(main)\configuracoes\integracoes\page.js`
- `app\(main)\configuracoes\permissoes\page.js`
- `app\(main)\configuracoes\tipos-documento\page.js`
- `app\(main)\configuracoes\usuarios\actions.js`
- `app\(main)\configuracoes\usuarios\inviteAction.js`
- `app\(main)\configuracoes\usuarios\page.js`
- `app\(main)\contratos\actions.js`
- `app\(main)\contratos\[id]\page.js`
- `app\(main)\empresas\page.js`
- `app\(main)\MainLayoutClient.js`
- `app\(main)\pedidos\page.js`
- `app\(main)\relatorios\radar\actions.js`
- `app\(main)\teste-ia\page.js`
- `components\chat\ChatHooks.js`
- `components\compliance\TermsUpdateEnforcer.js`
- `components\configuracoes\CotacoesManager.js`
- `components\configuracoes\GerenciadorMateriais.js`
- `components\configuracoes\PoliticasModal.js`
- `components\configuracoes\UserManagementForm.js`
- `components\contatos\actions.js`
- `components\contratos\CronogramaFinanceiro.js`
- `components\contratos\GeradorContrato.js`
- `components\crm\RodizioConfigModal.js`
- `components\financeiro\AuditoriaManager.js`
- `components\financeiro\LancamentoDetalhesSidebar.js`
- `components\gerenciador-de-arquivos\AdicionarArquivoModal.js`
- `components\MenuSettingsForm.js`
- `components\notificacao\ConfiguracaoNotificacoes.js`
- `components\notificacao\VariableManagerModal.js`
- `components\perfil\MinhasNotificacoes.js`
- `components\perfil\PreferenciasInterface.js`
- `components\ProfileForm.js`
- `components\rh\FolhaPonto.js`

#### Tabela: `variaveis_virtuais`
- `components\notificacao\GerenciadorNotificacoes.js`
- `components\notificacao\VariableManagerModal.js`

#### Tabela: `whatsapp-media`
- `components\whatsapp\MessagePanel.js`
- `components\whatsapp\TemplateMessageModal.js`

#### Tabela: `whatsapp_broadcast_lists`
- `app\(main)\caixa-de-entrada\data-fetching.js`
- `components\whatsapp\CreateBroadcastModal.js`

#### Tabela: `whatsapp_conversations`
- `app\(main)\caixa-de-entrada\data-fetching.js`

#### Tabela: `whatsapp_list_members`
- `components\whatsapp\BroadcastPanel.js`
- `components\whatsapp\CreateBroadcastModal.js`

#### Tabela: `whatsapp_messages`
- `app\(main)\caixa-de-entrada\actions.js`
- `app\(main)\caixa-de-entrada\data-fetching.js`

#### Tabela: `whatsapp_scheduled_broadcasts`
- `components\whatsapp\BroadcastPanel.js`

