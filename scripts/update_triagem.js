require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const updates = [
    {
      id: 118,
      diagnostico: "O áudio capturado no painel pode estar gravado em um formato (como audio/webm) incompatível no Safari (iOS) ou falhando ao renderizar/enviar. O LameJs MP3 ou a tag <audio> podem estar falhando em reproduzir o buffer final.",
      solucao: "Revisar `useAudioRecorder.js` para garantir formato cross-browser (OGG codec sugerido para WhatsApp). Assegurar que os elementos visuais contem com options nativos cross-compat."
    },
    {
      id: 119,
      diagnostico: "As caixas de seleção de contas (`SelectConta.js`/`LancamentoFormModal.js`) em Despesas possuem filtros restritivos que barram a categoria 'Passivo'. Logo, não é possível escolher essas contas na UI financeira para abatimento.",
      solucao: "Alterar a prop de filtro de tipos no SelectConta permitindo exibir 'Passivo / Empréstimo' livremente quando operado o dropdown na UI do form modal."
    },
    {
      id: 120,
      diagnostico: "Similar ao bug do Passivo. Durante a tentativa de vinculação de boletos antecipados em painéis financeiros, as contas 'Antecipação / Securitizadora' ou Sub-cartões carecem de flag em select box/tipagem ignorando RLS em interface.",
      solucao: "Autorizar a tipologia de Conta 'Antecipação' nas views de vinculação/conciliação de boletos, isentando os limites nos select box do modal correspondente."
    },
    {
      id: 117,
      diagnostico: "Solicitação de Feature / Ideia. O sistema necessita de sumarização de Vendas em grid dedicada à contabilidade (RET). O Painel financeiro atual não consolida relacionalmente `unidade` vs `lancamentos efetuados` em grid para exportação mensal.",
      solucao: "Desenvolver roteamento `/relatorios/vendas-ret` cruzando em LEFT JOIN lançamentos tipo 'Receita' ao seu `contrato_id` base, exibindo colunas: Contrato, Cliente, Parcela, Valor, Conta Bancária."
    },
    {
      id: 121,
      diagnostico: "Erro de 'Server Action was not found on the server' (visto em anexo). Causado pelo Next.js quando um ComponentClient evoca uma Server Action sem a flag `'use server'` forte no encapsulamento ou devida a descompasso de rota/cache pos-deploy no CRM.",
      solucao: "Revisar funções de gravação das atividades assegurando `'use server'` como header obrigatório. Compilar e promover hot-reload do .next no servidor."
    },
    {
      id: 122,
      diagnostico: "O tablet barra rotação devido à propriedade 'orientation':'portrait' engessada intencionalmente no arquivo `public/manifest.json` que compõe o PWA, invalidando o uso de tela deitada.",
      solucao: "Alterar a propriedade `'orientation'` para `'any'` no manifest.json do root directory web. Repassar reload na interface PWA dos dispositivos afetados."
    }
  ];

  for(let u of updates) {
    const { data, error } = await supabase
      .from('feedback')
      .update({ diagnostico: u.diagnostico, plano_solucao: u.solucao })
      .eq('id', u.id);

    if (error) {
      console.error(`Falha no ticket ${u.id}: `, error.message);
    } else {
      console.log(`Ticket ${u.id} diagnosticado vía API REST!`);
    }
  }

  console.log("FIM");
}

runAtualizacao();
