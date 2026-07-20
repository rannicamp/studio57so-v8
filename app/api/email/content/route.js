import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET(request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  const folderName = searchParams.get('folder');
  const accountId = searchParams.get('accountId');

  if (!uid || !folderName) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 1. BUSCAR CONFIGURAÇÃO DO E-MAIL
    let config = null;
    if (accountId && accountId !== 'undefined' && accountId !== 'null') {
      const { data: configs } = await supabase.from('email_configuracoes').select('*').eq('id', accountId);
      config = configs?.[0];
    } else {
      const { data: configs } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).limit(1);
      config = configs?.[0];
    }

    const isDemo = config?.organizacao_id === 57 || 
                   config?.email === 'elo57@studio57.arq.br' || 
                   config?.email?.includes('demo') || 
                   config?.email?.includes('fake') || 
                   config?.email?.includes('vanguard') ||
                   !config; // Fallback

    if (isDemo || uid === '101' || uid === '102' || uid === '103' || uid === '104' || String(uid).startsWith('10')) {
      const mockContents = {
        '101': {
          id: 101,
          subject: 'Nota Fiscal Eletrônica - Cimento Alfa - NF 15429',
          from: 'faturamento@cimentoalfa.com.br',
          to: config?.email || 'elo57@studio57.arq.br',
          date: new Date(new Date().getTime() - 2 * 60 * 60 * 1000).toISOString(),
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background-color: #ffffff;">
              <div style="background-color: #0f172a; padding: 20px; color: white; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">Cimento Alfa S/A</span>
                <span style="font-size: 11px; background-color: #2563eb; padding: 4px 8px; border-radius: 9999px; font-weight: bold; text-transform: uppercase; color: white;">Elo 57 Suprimentos</span>
              </div>
              <div style="padding: 24px; color: #334155; line-height: 1.6;">
                <p style="margin-top: 0; font-size: 14px;">Prezados da <strong>Vanguard Incorporações</strong>,</p>
                <p style="font-size: 14px;">Confirmamos o faturamento e envio da <strong>Nota Fiscal Eletrônica nº 15429</strong> referente ao fornecimento de Cimento Usinado (C25) para a concretagem das estruturas do <strong>Residencial Vista Parque</strong>.</p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
                  <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Resumo do Faturamento:</h4>
                  <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Insumo contratado:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a; border-bottom: 1px solid #f1f5f9;">Cimento Usinado (C25) - 40m³</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Valor do Faturamento:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #2563eb; font-size: 15px; border-bottom: 1px solid #f1f5f9;">R$ 15.400,00</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Data de Vencimento:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">15/07/2026</td>
                    </tr>
                  </table>
                </div>
                <p style="font-size: 14px;">O arquivo XML e a respectiva guia de pagamento em formato PDF encontram-se anexados a este e-mail.</p>
                <p style="margin-bottom: 0; font-size: 14px;">Atenciosamente,<br><strong>Faturamento Cimento Alfa</strong></p>
              </div>
              <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                Demonstração de homologação de compras via <strong style="color: #2563eb;">Elo 57 - ERP de Construtoras</strong>
              </div>
            </div>
          `,
          text: 'Prezados,\n\nSegue em anexo a Nota Fiscal Eletrônica nº 15429 referente ao fornecimento de Cimento Usinado (C25) conforme pedido nº 1098 alocado no Residencial Vista Parque.\n\nValor total: R$ 15.400,00.\n\nFavor programar o pagamento para a data acordada em contrato.\n\nAtenciosamente,\nFaturamento Cimento Alfa',
          attachments: [{ filename: 'NF_15429_Cimento.pdf', size: 142093, contentType: 'application/pdf' }]
        },
        '102': {
          id: 102,
          subject: 'Proposta de Parceria de Vendas - Lançamento Vista Parque',
          from: 'Rodrigo Silveira <contato@grupometaimoveis.com.br>',
          to: config?.email || 'elo57@studio57.arq.br',
          date: new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString(),
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background-color: #ffffff;">
              <div style="background-color: #000000; padding: 20px; color: white; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">Meta Imóveis B2B</span>
                <span style="font-size: 11px; background-color: #2563eb; padding: 4px 8px; border-radius: 9999px; font-weight: bold; text-transform: uppercase; color: white;">Elo 57 Vendas</span>
              </div>
              <div style="padding: 24px; color: #334155; line-height: 1.6;">
                <p style="margin-top: 0; font-size: 14px;">Prezada Diretoria da <strong>Vanguard Incorporações</strong>,</p>
                <p style="font-size: 14px;">Acompanhamos com muito entusiasmo o início das fundações do <strong>Residencial Vista Parque</strong> na última semana e gostaríamos de formalizar o interesse do <strong>Grupo Meta Imóveis</strong> em ingressar na força de vendas credenciada de vocês.</p>
                <p style="font-size: 14px;">Contamos com uma carteira ativa de mais de 500 compradores qualificados de alto padrão na região, além de uma equipe especializada de 35 corretores autônomos prontos para atuar.</p>
                <p style="font-size: 14px;">Gostaríamos de solicitar uma reunião comercial de 15 minutos para apresentar o nosso book estratégico e retirar o material de vendas das unidades.</p>
                <p style="margin-bottom: 0; font-size: 14px;">Atenciosamente,<br><strong>Rodrigo Silveira</strong><br>Diretor Comercial - Grupo Meta Imóveis</p>
              </div>
              <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                Demonstração de homologação de parcerias via <strong style="color: #2563eb;">Elo 57 - CRM Comercial</strong>
              </div>
            </div>
          `,
          text: 'Prezada Diretoria da Vanguard,\n\nNós da Meta Imóveis acompanhamos o início das obras do Residencial Vista Parque e gostaríamos de formalizar nosso interesse em fazer parte do time credenciado de vendas de vocês.\n\nContamos com uma carteira de mais de 500 clientes qualificados na região.\n\nSegue anexo nosso book de apresentação.\n\nAguardo retorno para agendarmos uma reunião.\n\nAtenciosamente,\nRodrigo Silveira - Diretor Comercial',
          attachments: []
        },
        '103': {
          id: 103,
          subject: 'Currículo para Vaga de Engenharia - Carlos Henrique Souza',
          from: 'Carlos Henrique Souza <carlos.henrique@demo.com>',
          to: config?.email || 'elo57@studio57.arq.br',
          date: new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString(),
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background-color: #ffffff;">
              <div style="background-color: #0f172a; padding: 20px; color: white; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">Recrutamento & Carreira</span>
                <span style="font-size: 11px; background-color: #2563eb; padding: 4px 8px; border-radius: 9999px; font-weight: bold; text-transform: uppercase; color: white;">Elo 57 RH</span>
              </div>
              <div style="padding: 24px; color: #334155; line-height: 1.6;">
                <p style="margin-top: 0; font-size: 14px;">Prezado departamento de Recursos Humanos da <strong>Vanguard</strong>,</p>
                <p style="font-size: 14px;">Envio meu currículo em anexo para me candidatar à vaga de <strong>Engenheiro Residente de Obras</strong> que se encontra aberta no portal da construtora.</p>
                <p style="font-size: 14px;">Sou graduado em Engenharia Civil pela UFMG, possuo pós-graduação em Gestão de Projetos e conto com mais de 6 anos de experiência em gestão integrada de canteiros, coordenação de empreiteiros terceirizados e controle rigoroso de orçamentos e prazos.</p>
                <p style="font-size: 14px;">Estou à inteira disposição para uma entrevista e para apresentar projetos executados anteriormente.</p>
                <p style="margin-bottom: 0; font-size: 14px;">Atenciosamente,<br><strong>Carlos Henrique Souza</strong><br>Engenheiro Civil - CREA/MG 19283-D</p>
              </div>
              <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                Demonstração de homologação de recrutamento via <strong style="color: #2563eb;">Elo 57 - Recursos Humanos</strong>
              </div>
            </div>
          `,
          text: 'Prezado RH,\n\nEnvio em anexo meu currículo atualizado para a vaga de Engenheiro de Obras da Vanguard.\n\nPossuo mais de 5 anos de experiência em gestão de canteiro de obras e coordenação de equipes.\n\nAtenciosamente,\nCarlos Henrique Souza',
          attachments: [{ filename: 'curriculo_carlos_henrique.pdf', size: 89450, contentType: 'application/pdf' }]
        },
        '104': {
          id: 104,
          subject: 'Comprovante de Pagamento Parcela de Entrada - João de Souza',
          from: 'João de Souza Beltrano <joao.beltrano@exemplo.com>',
          to: config?.email || 'elo57@studio57.arq.br',
          date: new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background-color: #ffffff;">
              <div style="background-color: #0f172a; padding: 20px; color: white; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">Portal do Comprador</span>
                <span style="font-size: 11px; background-color: #2563eb; padding: 4px 8px; border-radius: 9999px; font-weight: bold; text-transform: uppercase; color: white;">Elo 57 Financeiro</span>
              </div>
              <div style="padding: 24px; color: #334155; line-height: 1.6;">
                <p style="margin-top: 0; font-size: 14px;">Olá, equipe financeira da <strong>Vanguard Construtora</strong>,</p>
                <p style="font-size: 14px;">Conforme acordado no contrato, segue anexo o comprovante da transferência bancária referente à parcela de **Sinal e Entrada** da aquisição do apartamento <strong>AP 101</strong> no <strong>Residencial Vista Parque</strong>.</p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0;">
                  <h4 style="margin: 0 0 8px 0; color: #166534; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Dados do Pagamento:</h4>
                  <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; color: #15803d; border-bottom: 1px solid #dcfce7;">Forma de Envio:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #166534; border-bottom: 1px solid #dcfce7;">PIX (TED Bancária)</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #15803d; border-bottom: 1px solid #dcfce7;">Valor Pago:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #166534; font-size: 15px; border-bottom: 1px solid #dcfce7;">R$ 50.000,00</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #15803d;">Referência:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #166534;">E57-JOAO-AP101-VISTAPARQUE</td>
                    </tr>
                  </table>
                </div>
                <p style="font-size: 14px;">Fico no aguardo da confirmação do recebimento por parte de vocês para que possamos assinar o contrato final.</p>
                <p style="margin-bottom: 0; font-size: 14px;">Atenciosamente,<br><strong>João de Souza Beltrano</strong></p>
              </div>
              <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                Demonstração de conciliação financeira via <strong style="color: #2563eb;">Elo 57 - Contratos & Recebíveis</strong>
              </div>
            </div>
          `,
          text: 'Prezada equipe financeira,\n\nSegue em anexo o comprovante da transferência bancária referente ao Sinal de Entrada do meu contrato de compra do apartamento AP 101.\n\nQualquer dúvida estou à disposição.\n\nAtenciosamente,\nJoão de Souza Beltrano',
          attachments: [{ filename: 'comprovante_entrada.pdf', size: 240500, contentType: 'application/pdf' }]
        }
      };

      const mockEmail = mockContents[String(uid)] || {
        id: uid,
        subject: 'Demonstração de Caixa de Entrada - Elo 57',
        from: 'suporte@elo57.com.br',
        to: config?.email || 'elo57@studio57.arq.br',
        date: new Date().toISOString(),
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background-color: #ffffff;">
            <div style="background-color: #2563eb; padding: 24px; color: white; text-align: center; background-image: linear-gradient(to right, #2563eb, #1d4ed8);">
              <span style="font-size: 22px; font-weight: bold; letter-spacing: 0.5px; display: block;">Elo 57</span>
              <span style="font-size: 12px; opacity: 0.8; text-transform: uppercase; font-weight: bold; margin-top: 4px; display: block;">Central de Demonstração</span>
            </div>
            <div style="padding: 32px 24px; color: #334155; line-height: 1.6;">
              <p style="margin-top: 0; font-size: 15px; font-weight: bold; color: #0f172a;">Olá, seu lindo!</p>
              <p style="font-size: 14px;">Este e-mail é uma simulação de conteúdo carregada para demonstração da nossa <strong>Caixa de Entrada Inteligente</strong>.</p>
              <p style="font-size: 14px;">No Elo 57, a sua caixa de entrada é totalmente integrada com o CRM e o módulo de compras de materiais. Quando um fornecedor envia uma Nota Fiscal ou um cliente envia um comprovante, o sistema lê e processa as informações em background para você.</p>
              <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 13px; font-weight: bold; color: #1e3a8a;">💡 Dica de Apresentação:</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #1e40af;">
                  Mostre para os seus clientes como os e-mails são agrupados, as regras de triagem automatizadas e como é fácil criar uma Atividade ou Tarefa vinculada a este e-mail no menu de ações rápidas no topo!
                </p>
              </div>
              <p style="font-size: 14px; margin-bottom: 0;">Equipe de Engenharia do <strong>Studio 57</strong></p>
            </div>
            <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              Você está navegando em ambiente de testes da Vanguard Incorporações
            </div>
          </div>
        `,
        text: 'Olá, seu lindo!\n\nEste é um e-mail de simulação para demonstração do gerenciador de e-mails da Elo 57.\n\nNo Elo 57, a sua caixa de entrada é integrada ao CRM e de forma offline-first.\n\nAtenciosamente,\nEquipe Studio 57',
        attachments: []
      };

      return NextResponse.json(mockEmail);
    }

    // 2. CASO SEJA CONTA REAL, CONSULTA CACHE LOCAL DO SUPABASE
    let queryCache = supabase
      .from('email_messages_cache')
      .select('conteudo_cache')
      .eq('uid', uid)
      .eq('folder_path', folderName);

    if (accountId) queryCache = queryCache.eq('account_id', accountId);

    const { data: cacheData } = await queryCache.single();

    // Se já tem conteúdo em cache, retorna rápido
    if (cacheData?.conteudo_cache && cacheData.conteudo_cache.html) {
      return NextResponse.json(cacheData.conteudo_cache);
    }

    // 3. BUSCA NO IMAP REAL (Se não tem cache ou é a primeira leitura)
    if (!config) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });
    }

    const imapConfig = {
      imap: {
        user: config.imap_user || config.email,
        password: config.senha_app,
        host: config.imap_host,
        port: config.imap_port || 993,
        tls: true,
        authTimeout: 20000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    const connection = await imapSimple.connect(imapConfig);
    await connection.openBox(folderName, { readOnly: true });

    const searchCriteria = [['UID', uid]];
    const fetchOptions = {
      bodies: [''],
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    if (messages.length === 0) {
      connection.end();
      // Auto-cura: Se não achou na Hostinger, deletamos do cache local para limpar sujeira!
      await supabase
        .from('email_messages_cache')
        .delete()
        .eq('uid', uid)
        .eq('folder_path', folderName)
        .eq('account_id', config.id);

      return NextResponse.json({ error: 'Este e-mail foi movido ou apagado do servidor por outro dispositivo.' }, { status: 404 });
    }

    const source = messages[0].parts.find(part => part.which === '')?.body;
    const parsed = await simpleParser(source);

    // Sanitização de anexos e identificação de convites de calendário (iCalendar/ICS)
    let meetingHtml = null;
    const attachmentsMeta = parsed.attachments.map(att => {
      let filename = att.filename;
      if (!filename && (att.contentType?.includes('calendar') || att.contentType?.includes('ics'))) {
        filename = 'convite.ics';
      }

      if (att.content && (att.contentType?.includes('calendar') || filename?.endsWith('.ics'))) {
        try {
          const icsText = att.content.toString('utf8');
          const eventDetails = parseICS(icsText);
          if (eventDetails && eventDetails.summary) {
            meetingHtml = generateMeetingHtml(eventDetails);
          }
        } catch (icsErr) {
          console.error('Erro ao processar anexo de calendário:', icsErr);
        }
      }

      return {
        filename: filename || 'Anexo sem nome',
        contentType: att.contentType,
        size: att.size,
        content: null
      };
    });

    const emailDataForDb = {
      id: uid,
      subject: parsed.subject,
      from: parsed.from?.text,
      to: parsed.to?.text,
      cc: parsed.cc?.text,
      date: parsed.date,
      html: meetingHtml || parsed.html || parsed.textAsHtml || '',
      text: parsed.text || '',
      attachments: attachmentsMeta
    };

    // 4. ATUALIZA O CACHE (SEM FORÇAR LIDO)
    await supabase
      .from('email_messages_cache')
      .update({
        conteudo_cache: emailDataForDb,
        html_body: emailDataForDb.html ? emailDataForDb.html.substring(0, 100000) : null,
        has_attachments: parsed.attachments.length > 0,
        updated_at: new Date().toISOString()
      })
      .eq('uid', uid)
      .eq('folder_path', folderName)
      .eq('account_id', config.id);

    connection.end();

    return NextResponse.json(emailDataForDb);

  } catch (error) {
    console.error('Erro ao baixar conteúdo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PARSEADORES AUXILIARES DE CONVITE DE REUNIÃO (iCalendar / ICS) ────────────────
function parseICS(icsText) {
  // Desdobra linhas longas (RFC 5545 especifica que linhas continuadas começam com espaço ou tab)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');

  // Pega apenas a parte do evento VEVENT
  const veventMatch = unfolded.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/i);
  if (!veventMatch) return null;
  const eventBody = veventMatch[1];

  const getVal = (key) => {
    const regex = new RegExp(`^${key}[^:]*:(.*)$`, 'im');
    const match = eventBody.match(regex);
    return match ? match[1].trim() : '';
  };

  const getCN = (key) => {
    const regex = new RegExp(`^${key};[^:]*CN=([^:;]+)`, 'im');
    const match = eventBody.match(regex);
    return match ? match[1].trim() : '';
  };

  let summary = getVal('SUMMARY');
  let organizerCN = getCN('ORGANIZER');
  let organizerEmail = getVal('ORGANIZER').replace(/mailto:/i, '');
  let location = getVal('LOCATION');
  let description = getVal('DESCRIPTION');
  let dtstartRaw = getVal('DTSTART');
  let dtendRaw = getVal('DTEND');

  // Fallbacks de chaves sem parâmetros complexos
  if (!summary) {
    const simpleSummary = eventBody.match(/^SUMMARY:(.*)$/im);
    summary = simpleSummary ? simpleSummary[1].trim() : '(Sem Título)';
  }
  if (!organizerCN) {
    const simpleOrg = eventBody.match(/^ORGANIZER:(.*)$/im);
    organizerCN = simpleOrg ? simpleOrg[1].replace(/mailto:/i, '').trim() : '';
  }

  // Parse de datas do formato iCalendar YYYYMMDDTHHMMSS
  const parseIcalDate = (raw) => {
    if (!raw) return null;
    const match = raw.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (!match) return null;
    return new Date(match[1], match[2] - 1, match[3], match[4], match[5], match[6]);
  };

  const dtstart = parseIcalDate(dtstartRaw);
  const dtend = parseIcalDate(dtendRaw);

  return {
    summary,
    organizer: organizerCN || organizerEmail,
    organizerEmail,
    location,
    description: description.replace(/\\n/g, '\n').replace(/\\,/g, ','),
    dtstart,
    dtend
  };
}

function generateMeetingHtml(event) {
  const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const formatDate = (date) => {
    if (!date) return '';
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const weekday = weekdays[date.getDay()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${weekday}, ${day} de ${month} de ${year} às ${hours}:${minutes}`;
  };

  const startStr = formatDate(event.dtstart);
  let timeRange = startStr;
  
  if (event.dtstart && event.dtend) {
    const endHours = String(event.dtend.getHours()).padStart(2, '0');
    const endMinutes = String(event.dtend.getMinutes()).padStart(2, '0');
    timeRange = `${startStr} – ${endHours}:${endMinutes}`;
  }

  const monthShort = event.dtstart ? monthsShort[event.dtstart.getMonth()] : 'AGENDA';
  const dayNum = event.dtstart ? event.dtstart.getDate() : '?';

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background-color: #ffffff;">
      <div style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px; display: flex; align-items: center; gap: 15px;">
        <div style="background-color: #2563eb; color: white; padding: 12px; border-radius: 8px; width: 48px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-sizing: border-box;">
          <span style="font-size: 9px; text-transform: uppercase; line-height: 1;">${monthShort}</span>
          <span style="font-size: 18px; line-height: 1.1; margin-top: 2px;">${dayNum}</span>
        </div>
        <div>
          <h3 style="margin: 0; color: #0f172a; font-size: 16px; font-weight: bold;">Convite de Reunião</h3>
          <p style="margin: 3px 0 0 0; color: #64748b; font-size: 13px;">Recebido via agendador de calendário</p>
        </div>
      </div>
      
      <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
        <h4 style="margin: 0 0 16px 0; color: #1e3a8a; font-size: 18px; font-weight: bold; line-height: 1.3;">
          ${event.summary}
        </h4>
        
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="vertical-align: top;">
              <td style="padding: 4px 0; color: #64748b; font-weight: bold; width: 100px;">Quando:</td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 500;">${timeRange}</td>
            </tr>
            ${event.location ? `
            <tr style="vertical-align: top;">
              <td style="padding: 4px 0; color: #64748b; font-weight: bold;">Onde:</td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 500;">${event.location}</td>
            </tr>` : ''}
            <tr style="vertical-align: top;">
              <td style="padding: 4px 0; color: #64748b; font-weight: bold;">Organizador:</td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 500;">${event.organizer} ${event.organizerEmail ? `&lt;${event.organizerEmail}&gt;` : ''}</td>
            </tr>
          </table>
        </div>
        
        ${event.description ? `
        <div style="margin-top: 16px;">
          <h5 style="margin: 0 0 8px 0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Descrição / Mensagem:</h5>
          <div style="white-space: pre-wrap; color: #334155; background-color: #fafafa; border: 1px solid #f1f5f9; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px;">${event.description}</div>
        </div>` : ''}
      </div>
      
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
        Arquivo de convite associado (.ics) disponível nos anexos abaixo.
      </div>
    </div>
  `;
}