import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

const checkCondition = (message, condition) => {
 const textToCheck = message[condition.campo]?.toLowerCase() || '';
 const valueToCheck = (condition.valor || '').toLowerCase();

 if (!valueToCheck) return true;
 if (!textToCheck) return false;

 switch (condition.operador) {
 case 'contains': return textToCheck.includes(valueToCheck);
 case 'not_contains': return !textToCheck.includes(valueToCheck);
 case 'equals': return textToCheck === valueToCheck;
 case 'starts_with': return textToCheck.startsWith(valueToCheck);
 case 'ends_with': return textToCheck.endsWith(valueToCheck);
 default: return false;
 }
};

async function processAccountBatchDB(config, regras, cursor, limit, supabase) {
 let stats = { matched: 0, moved: 0, totalMessages: 0, hasMore: false };

 try {
 // 1. Pega o total de mensagens desta conta na INBOX local
 const { count } = await supabase
 .from('email_messages_cache')
 .select('*', { count: 'exact', head: true })
 .eq('account_id', config.id)
 .eq('folder_path', 'INBOX');

 stats.totalMessages = count || 0;

 if (stats.totalMessages === 0 || cursor >= stats.totalMessages) {
 return stats;
 }

 // 2. Busca o lote de mensagens usando Range (muito mais rápido que IMAP Fetch)
 const { data: messages } = await supabase
 .from('email_messages_cache')
 .select('uid, folder_path, subject, from_text, to_text, account_id, id, flags')
 .eq('account_id', config.id)
 .eq('folder_path', 'INBOX')
 .order('uid', { ascending: false })
 .range(cursor, cursor + limit - 1);

 if (!messages || messages.length === 0) {
 return stats;
 }

 stats.hasMore = (cursor + limit) < stats.totalMessages;

 const actionsToPerform = [];

 // 3. Avalia regras LOCALMENTE
 for (const message of messages) {
 const messageAdapter = {
 subject: message.subject,
 from: message.from_text,
 to: message.to_text
 };

 let ruleApplied = false;
 for (const regra of regras) {
 if (ruleApplied) break;

 try {
 if (regra.condicoes.length > 0 && regra.condicoes.every(cond => checkCondition(messageAdapter, cond))) {
 for (const acao of regra.acoes) {
 actionsToPerform.push({
 uid: message.uid,
 action: acao.tipo,
 folder: acao.pasta
 });
 }
 stats.matched++;
 ruleApplied = true;
 }
 } catch (err) { }
 }
 }

 // 4. Conecta no IMAP APENAS se houver mensagens para Mover/Deletar
 // Isso economiza incontáveis segundos de conexão atoa.
 if (actionsToPerform.length > 0) {
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

 let connection = null;
 try {
 connection = await imapSimple.connect(imapConfig);
 await connection.openBox('INBOX', { readOnly: false });

 for (const task of actionsToPerform) {
 try {
 if (task.action === 'move' && task.folder) {
 await connection.moveMessage(task.uid, task.folder);
 stats.moved++;
 await supabase.from('email_messages_cache').update({ folder_path: task.folder }).eq('account_id', config.id).eq('uid', task.uid);
 } else if (task.action === 'markRead') {
 await connection.addFlags(task.uid, '\\Seen');
 await supabase.from('email_messages_cache').update({ is_read: true }).eq('account_id', config.id).eq('uid', task.uid);
 } else if (task.action === 'delete') {
 try {
 await connection.moveMessage(task.uid, 'TRASH');
 await supabase.from('email_messages_cache').update({ folder_path: 'TRASH' }).eq('account_id', config.id).eq('uid', task.uid);
 }
 catch {
 await connection.addFlags(task.uid, '\\Deleted');
 await supabase.from('email_messages_cache').update({ flags: ['\\Deleted'] }).eq('account_id', config.id).eq('uid', task.uid);
 }
 stats.moved++;
 }
 } catch (actionError) {
 console.error(`Falha deep scan na msg ${task.uid}:`, actionError);
 }
 }
 } catch (connectionError) {
 console.error(`Erro conectar IMAP deep scan conta ${config.email}:`, connectionError.message);
 } finally {
 if (connection) try { connection.end(); } catch (e) { }
 }
 }
 } catch (e) {
 console.error(`Erro deep scan local conta ${config.email}:`, e.message);
 }

 return stats;
}

export async function POST(request) {
 const supabase = await createClient();

 try {
 const body = await request.json();
 const { ruleId, cursor = 0, limit = 50 } = body;
 const currentCursor = parseInt(cursor);

 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

 // 1. Busca TODAS as contas do usuário
 const { data: allConfigs } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
 if (!allConfigs || allConfigs.length === 0) return NextResponse.json({ error: 'Sem contas' }, { status: 404 });

 // 2. Busca as regras
 let query = supabase.from('email_regras').select('*').eq('user_id', user.id).eq('ativo', true);
 if (ruleId) query = query.eq('id', ruleId);
 else query = query.order('ordem', { ascending: true });

 const { data: regras } = await query;
 if (!regras || regras.length === 0) return NextResponse.json({ message: 'Sem regras.', done: true });

 // 3. Lógica Inteligente de Seleção de Contas
 let accountsToProcess = [];

 if (ruleId) {
 // Se for UMA regra específica, descobrimos de qual conta ela é
 const regraAlvo = regras[0];
 if (regraAlvo.account_id) {
 // Filtra apenas a conta dona da regra
 accountsToProcess = allConfigs.filter(c => c.id === regraAlvo.account_id);
 } else {
 // Fallback: se a regra não tiver conta (legado), roda em todas
 accountsToProcess = allConfigs;
 }
 } else {
 // Se for varredura geral (todas as regras), roda em todas as contas
 accountsToProcess = allConfigs;
 }

 // 4. Executa
 const results = await Promise.all(accountsToProcess.map(cfg => {
 // Filtra regras que pertencem a essa conta (ou regras sem dono/legado)
 const regrasDestaConta = regras.filter(r => !r.account_id || r.account_id === cfg.id);
 return processAccountBatchDB(cfg, regrasDestaConta, currentCursor, limit, supabase);
 }));

 const totalMessagesMax = Math.max(...results.map(r => r.totalMessages || 0));
 const matched = results.reduce((acc, r) => acc + (r.matched || 0), 0);
 const moved = results.reduce((acc, r) => acc + (r.moved || 0), 0);
 const anyAccountHasMore = results.some(r => r.hasMore);

 return NextResponse.json({
 success: true,
 done: !anyAccountHasMore,
 nextCursor: currentCursor + limit,
 totalMessages: totalMessagesMax,
 matched,
 moved
 });

 } catch (error) {
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}