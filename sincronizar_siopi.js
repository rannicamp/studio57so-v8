import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const SIOPI_DIR = 'C:\\Users\\Ranniere\\OneDrive\\S57 ARQUITETURA\\MODELO CENTRAL\\2024_000_RESIDENCIAL ALFA\\SIOPI';
const ORG_ID = 2; // Passado pelo Ranniere

function sanitizePath(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_ \[\]]/g, '_');
}

async function runSync() {
  console.log("==================================================");
  console.log("🟢 INICIANDO SIOPI SYNC: Upload Mestre em Massa");
  console.log("==================================================\n");

  // 1. Achar o Empreendimento Alfa
  const { data: empreendimentos, error: errEmp } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .ilike('nome', '%Alfa%')
    .limit(1);

  if (errEmp || !empreendimentos || empreendimentos.length === 0) {
    console.error("❌ Empreendimento Residencial Alfa não encontrado no Banco de Dados!");
    return;
  }
  
  const empreendimentoId = empreendimentos[0].id;
  console.log(`🏢 Empreendimento Encontrado: ${empreendimentos[0].nome} (ID: ${empreendimentoId})`);

  // 2. Tabela de Tipos (Mapas)
  const { data: tipos } = await supabase.from('documento_tipos').select('id, sigla');
  const getTipo = (sigla) => tipos?.find(t => t.sigla && t.sigla.trim().toUpperCase() === sigla.toUpperCase());

  // 3. Ler Pasta Local (Pular o LEIAME)
  const files = fs.readdirSync(SIOPI_DIR).filter(f => !f.includes('LEIAME') && fs.lstatSync(path.join(SIOPI_DIR, f)).isFile());
  
  console.log(`📁 Encontrados ${files.length} arquivos locais prontos para ir pra nuvem.`);

  let upserts = 0;
  let inserts = 0;
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(SIOPI_DIR, fileName);
    const fileBuffer = fs.readFileSync(filePath);
    
    // Evitar erros 400 do Supabase limpando acentos do caminho físico
    const safeStorageName = sanitizePath(fileName);
    const storagePath = `${empreendimentoId}/anexos/${safeStorageName}`;
    
    process.stdout.write(`\r[${i+1}/${files.length}] Processando: ${fileName.substring(0, 30)}...`);

    // -> Extrair Carimbos de IA Simplificados (A partir do nome ex: [ART] - ...)
    let siglaExtraida = 'OUT';
    let abaAlvo = 'geral';

    const matchSigla = fileName.match(/\[([a-zA-Z0-9\-]+)\]/);
    if(matchSigla && matchSigla[1]) {
       siglaExtraida = matchSigla[1].toUpperCase();
    }

    // Regras de Abas pelo Dicionário SIOPI
    const ENGENHARIA = ['ART', 'RRT', 'PROJ', 'RLT', 'AAD'];
    const JURIDICO = ['CT', 'CON', 'MAT', 'CS', 'CNPJ', 'CND', 'REQ'];
    const MARKETING = ['IMG', 'VID', 'TAB', 'BOK', 'LOGO-P'];

    if (ENGENHARIA.includes(siglaExtraida)) abaAlvo = 'engenharia';
    else if (JURIDICO.includes(siglaExtraida)) abaAlvo = 'juridico';
    else if (MARKETING.includes(siglaExtraida)) abaAlvo = 'marketing';

    const tipoAchado = getTipo(siglaExtraida);
    const tipoDocumentoId = tipoAchado ? tipoAchado.id : null;

    // Delay para evitar Rate Limiting da Nuvem
    await new Promise(resolve => setTimeout(resolve, 300));

    const getContentType = (fileName) => {
      const ext = fileName.split('.').pop().toLowerCase();
      if (ext === 'pdf') return 'application/pdf';
      if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
      if (ext === 'png') return 'image/png';
      if (['mp4'].includes(ext)) return 'video/mp4';
      return 'application/octet-stream';
    };

    // Passo A: Upload Físico (Storage Upsert)
    const { error: storageError } = await supabase.storage
      .from('empreendimento-anexos')
      .upload(storagePath, fileBuffer, {
        upsert: true,
        contentType: getContentType(fileName)
      });

    if(storageError) {
      console.log(`\n❌ Falha estrutural de Upload - ${fileName}: ${storageError.message}`);
      errors++;
      continue;
    }

    // Passo B: Atualizar / Inserir Banco
    const { data: dbVerify } = await supabase
      .from('empreendimento_anexos')
      .select('id')
      .eq('empreendimento_id', empreendimentoId)
      .eq('nome_arquivo', fileName)
      .limit(1);

    const payloadDB = {
      empreendimento_id: empreendimentoId,
      organizacao_id: ORG_ID,
      nome_arquivo: fileName,
      caminho_arquivo: storagePath,
      categoria_aba: abaAlvo,
      tipo_documento_id: tipoDocumentoId
    };

    if(dbVerify && dbVerify.length > 0) {
      // UPDATE 
      const existingId = dbVerify[0].id;
      const { error: updErr } = await supabase.from('empreendimento_anexos').update(payloadDB).eq('id', existingId);
      if(updErr) { console.log(`\n❌ Erro no DB Update (${fileName}):`, updErr.message); errors++; }
      else upserts++;
    } else {
      // INSERT
      const { error: insErr } = await supabase.from('empreendimento_anexos').insert(payloadDB);
      if(insErr) { console.log(`\n❌ Erro no DB Insert (${fileName}):`, insErr.message); errors++; }
      else inserts++;
    }
  }

  console.log("\n\n==================================================");
  console.log("✅ SIOPI SYNC COMLUÍDO COM SUCESSO!");
  console.log(`Nuvem Sobreposta (Updates DB): ${upserts}`);
  console.log(`Arquivos Inéditos (Inserts DB): ${inserts}`);
  console.log(`Erros Críticos: ${errors}`);
  console.log("==================================================");
}

runSync();
