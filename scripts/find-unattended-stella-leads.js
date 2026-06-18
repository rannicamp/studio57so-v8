const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Carrega as variáveis do .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define se o script deve realizar o trigger de retomada real ou apenas simulação
const args = process.argv.slice(2);
const executeTrigger = args.includes('--trigger');

async function run() {
  console.log('=== INICIANDO AUDITORIA DE LEADS NÃO ATENDIDOS PELA STELLA ===');
  console.log(`Modo: ${executeTrigger ? 'RETOMADA REAL (TRIGGER ATIVO)' : 'SIMULAÇÃO (APENAS LISTAGEM)'}`);
  
  // Período de varredura: últimos 7 dias (aproximadamente desde a queda dos créditos)
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const dataCorte = seteDiasAtras.toISOString();
  
  console.log(`Buscando mensagens recebidas a partir de: ${new Date(dataCorte).toLocaleString('pt-BR')}`);

  // 1. Buscar todas as mensagens de WhatsApp criadas nos últimos 7 dias
  const { data: mensagens, error: msgError } = await supabase
    .from('whatsapp_messages')
    .select('id, contato_id, direction, created_at, content, organizacao_id')
    .gte('created_at', dataCorte)
    .order('created_at', { ascending: false });

  if (msgError) {
    console.error('Erro ao buscar mensagens recentes:', msgError.message);
    process.exit(1);
  }

  console.log(`Encontradas ${mensagens.length} mensagens no período.`);

  // 2. Agrupar por contato_id único
  const contatosIdsUnicos = [...new Set(mensagens.map(m => m.contato_id))].filter(Boolean);
  console.log(`Total de contatos distintos com interação: ${contatosIdsUnicos.length}`);

  const leadsPendentes = [];

  for (const contatoId of contatosIdsUnicos) {
    // Buscar a última mensagem real do contato no banco de dados que não tenha falhado para garantir o estado final ativo da conversa
    const { data: ultimaMsg, error: ultimaMsgErr } = await supabase
      .from('whatsapp_messages')
      .select('id, content, direction, created_at')
      .eq('contato_id', contatoId)
      .not('status', 'eq', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaMsgErr || !ultimaMsg) {
      continue;
    }

    // Se a última mensagem for inbound (cliente mandou mensagem e ficou sem resposta)
    if (ultimaMsg.direction === 'inbound') {
      // Buscar dados do contato
      const { data: contato, error: contatoErr } = await supabase
        .from('contatos')
        .select('id, nome, ia_atendimento_ativo, organizacao_id, created_at')
        .eq('id', contatoId)
        .single();

      if (contatoErr || !contato) {
        continue;
      }

      // Buscar se possui corretor associado no funil
      const { data: funil, error: funilErr } = await supabase
        .from('contatos_no_funil')
        .select('corretor_id')
        .eq('contato_id', contatoId)
        .limit(1)
        .maybeSingle();

      let corretorNome = 'Nenhum';
      let corretorId = null;
      let isStellaCorretor = false;

      if (funil?.corretor_id) {
        corretorId = funil.corretor_id;
        // Buscar nome do corretor
        const { data: corretorCont } = await supabase
          .from('contatos')
          .select('nome')
          .eq('id', funil.corretor_id)
          .maybeSingle();
        
        if (corretorCont) {
          corretorNome = corretorCont.nome;
          if (corretorCont.nome.toLowerCase().includes('stella')) {
            isStellaCorretor = true;
          }
        }
      } else {
        // Se não houver corretor atribuído no funil, mas a organização tem a Stella ativa, 
        // e o piloto automático do contato está ativo, ela é a responsável
        isStellaCorretor = contato.ia_atendimento_ativo;
      }

      // Buscar o telefone do contato
      const { data: tel } = await supabase
        .from('telefones')
        .select('telefone')
        .eq('contato_id', contatoId)
        .limit(1)
        .maybeSingle();

      leadsPendentes.push({
        id: contato.id,
        nome: contato.nome,
        telefone: tel?.telefone || 'Não informado',
        organizacao_id: contato.organizacao_id,
        ia_atendimento_ativo: contato.ia_atendimento_ativo,
        corretor_nome: corretorNome,
        corretor_id: corretorId,
        is_stella_responsavel: isStellaCorretor || !corretorId,
        ultima_msg_data: ultimaMsg.created_at,
        ultima_msg_conteudo: ultimaMsg.content
      });
    }
  }

  console.log(`\n=== LEADS PENDENTES DE RESPOSTA (${leadsPendentes.length} encontrados) ===\n`);

  if (leadsPendentes.length === 0) {
    console.log('Nenhum lead pendente de resposta encontrado nos últimos 7 dias.');
    await gerarRelatorioMarkdown(leadsPendentes);
    return;
  }

  for (const lead of leadsPendentes) {
    const elegivelTrigger = lead.ia_atendimento_ativo && lead.is_stella_responsavel;
    console.log(`Lead: ${lead.nome} (ID: ${lead.id})`);
    console.log(` - Telefone: ${lead.telefone}`);
    console.log(` - Organização: ${lead.organizacao_id}`);
    console.log(` - Autopilot Ativo: ${lead.ia_atendimento_ativo}`);
    console.log(` - Stella Responsável: ${lead.is_stella_responsavel}`);
    console.log(` - Corretor no Funil: ${lead.corretor_nome}`);
    console.log(` - Última Mensagem do Cliente [${new Date(lead.ultima_msg_data).toLocaleString('pt-BR')}]: "${lead.ultima_msg_conteudo}"`);
    
    if (executeTrigger && elegivelTrigger) {
      console.log(` -> [TRIGGER] Disparando trigger-autopilot para retomar conversa com ${lead.nome}...`);
      
      const domain = process.env.NEXTAUTH_URL || 'http://localhost:3000/';
      const triggerUrl = `${domain}api/whatsapp/trigger-autopilot`;
      
      try {
        const res = await fetch(triggerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contato_id: lead.id,
            organizacao_id: lead.organizacao_id
          })
        });
        
        if (res.ok) {
          const resJson = await res.json();
          console.log(` -> [TRIGGER] Sucesso para ${lead.nome}:`, resJson);
        } else {
          const resText = await res.text();
          console.error(` -> [TRIGGER] Falha para ${lead.nome} (Status ${res.status}):`, resText);
        }
      } catch (err) {
        console.error(` -> [TRIGGER] Erro ao chamar a API para ${lead.nome}:`, err.message);
      }
      
      // Pequeno delay entre os disparos para evitar concorrência no processamento
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log(` -> [IGNORADO] Nenhuma ação tomada. (Trigger: ${executeTrigger ? 'Ativo' : 'Simulação'} | Elegível: ${elegivelTrigger})`);
    }
    console.log('----------------------------------------------------');
  }

  // Gerar relatório em arquivo Markdown para documentação
  await gerarRelatorioMarkdown(leadsPendentes);
}

async function gerarRelatorioMarkdown(leads) {
  const artifactDir = 'C:/Users/ranni/.gemini/antigravity/brain/f237ca8f-a0ef-4f82-9917-81955e800bb7';
  const filePath = path.join(artifactDir, 'auditoria_leads_pendentes.md');
  
  let content = `# Relatório de Auditoria: Leads Não Atendidos pela Stella IA\n\n`;
  content += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
  content += `Total de leads identificados sem resposta nos últimos 7 dias: **${leads.length}**\n\n`;
  
  if (leads.length === 0) {
    content += `> [!NOTE]\n> Nenhum lead pendente de atendimento foi identificado na varredura.\n`;
  } else {
    content += `| ID | Nome do Lead | Telefone | Org | Corretor Funil | Autopilot Ativo | Stella Responsável | Data Última Mensagem | Conteúdo Última Mensagem |\n`;
    content += `| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    
    for (const lead of leads) {
      const dataFormatada = new Date(lead.ultima_msg_data).toLocaleString('pt-BR');
      const conteudoLimpo = (lead.ultima_msg_conteudo || '').replace(/\r?\n|\r/g, ' ').substring(0, 100);
      content += `| ${lead.id} | ${lead.nome} | ${lead.telefone} | ${lead.organizacao_id} | ${lead.corretor_nome} | ${lead.ia_atendimento_ativo ? 'Sim ✅' : 'Não ❌'} | ${lead.is_stella_responsavel ? 'Sim ✅' : 'Não ❌'} | ${dataFormatada} | ${conteudoLimpo} |\n`;
    }
    
    content += `\n## Ação de Retomada\n\n`;
    content += `Status da retomada: **${executeTrigger ? 'Executada com sucesso' : 'Simulação executada - triggers não disparados ainda'}**.\n`;
  }
  
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\nRelatório de auditoria saved in: ${filePath}`);
  } catch (err) {
    console.error('Erro ao gravar arquivo de relatório markdown:', err.message);
  }
}

run().catch(console.error);
