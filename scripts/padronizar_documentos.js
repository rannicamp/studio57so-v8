import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function padronizarNome(nomeOriginal) {
  if (!nomeOriginal) return "Documento";
  
  // Remove extensões comuns .pdf, .jpg, .png, .jpeg, etc
  let limpo = nomeOriginal.replace(/\.(pdf|jpg|jpeg|png|doc|docx|xls|xlsx|rar|zip|csv|webp|gif)$/i, '');
  
  // Substitui underlines, hífens e pontos literais soltos por espaços
  limpo = limpo.replace(/[-_]/g, ' ');
  
  // Remove sufixos como (1), (2), ou timestamps compridos tipo 16402324... ou UUIDs parciais ou Whatsapp Image 2024-05-12 at 10.23.44
  limpo = limpo.replace(/\(\d+\)/g, ''); // Remove (1)
  limpo = limpo.replace(/\b\d{10,}\b/g, ''); // Remove timestamps
  limpo = limpo.replace(/whatsapp image.*at/gi, 'Imagem');
  limpo = limpo.replace(/whatsapp .*? at/gi, 'Arquivo');
  
  // Tira "Copia de" ou "Copia" se estiver no início
  limpo = limpo.replace(/^c[oó]pia\s+de\s+/i, '');
  
  // Remove múltiplos espaços
  limpo = limpo.replace(/\s+/g, ' ').trim();
  
  // Capitalize (Primeira letra maiúscula em cada palavra)
  const palavrasMenores = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'por', 'sem', 'a', 'o', 'as', 'os'];
  limpo = limpo.split(' ').map((word, index) => {
    const w = word.toLowerCase();
    
    // Algumas siglas específicas para MAIÚSCULO sempre
    if (['cnh', 'rg', 'cpf', 'aso', 'pdf', 'epi', 'cres', 'ctps', 'mei', 'cnpj'].includes(w)) {
      return w.toUpperCase();
    }

    if (palavrasMenores.includes(w) && index !== 0) {
      return w;
    }
    
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
  
  if (limpo.length === 0) return "Documento Sem Nome";
  return limpo;
}

async function run() {
  console.log("Iniciando Padronização de Nomes e Tipos - Documentos Funcionários\n");

  const { data: tipos, error: errTipos } = await supabase.from('documento_tipos').select('id, sigla, descricao');
  if (errTipos) {
    console.error("Erro ao buscar tipos:", errTipos);
    return;
  }
  
  console.log(`Encontrados ${tipos.length} tipos de documento.`);

  // Mapa para fácil busca
  // Vamos buscar por palavras chave na descricao ou sigla
  const mapeamentoTipos = [
    { keys: ['cnh', 'habilitacao', 'habilitação', 'motorista'], sigla: 'CNH' },
    { keys: ['rg', 'identidade', 'id'], sigla: 'RG' },
    { keys: ['cpf'], sigla: 'CPF' },
    { keys: ['aso', 'atestado', 'exame', 'clinico', 'medico', 'saude', 'saúde'], sigla: 'ASO' }, // ou AAD (Admissional)
    { keys: ['residencia', 'endereço', 'endereco', 'luz', 'agua', 'telefone', 'cres'], sigla: 'CRES' }, // Comprovante Residencia
    { keys: ['trabalho', 'ctps', 'carteira'], sigla: 'CTPS' }, // Carteira de Trabalho
    { keys: ['epi', 'equipamento', 'segurança', 'bota', 'capacete'], sigla: 'EPI' },
    { keys: ['vt', 'transporte', 'onibus', 'trn', 'vtn'], sigla: 'VTN' }, // Vale transporte
    { keys: ['curriculo', 'cv', 'resumo'], sigla: 'CV' },
    { keys: ['contrato', 'experiencia', 'cte'], sigla: 'CTE' },
    { keys: ['uniforme', 'roupa', 'reu'], sigla: 'REU' },
    { keys: ['foto', 'rosto', '3x4', 'perfil'], sigla: 'FT' },
    { keys: ['certidao', 'casamento', 'nascimento'], sigla: 'CRT' }, // Ad hoc
  ];

  const buscarTipoId = (nomeDesejado) => {
    let nomeLower = (nomeDesejado || '').toLowerCase();
    
    for (let mapa of mapeamentoTipos) {
      if (mapa.keys.some(k => nomeLower.includes(k))) {
        let tipo = tipos.find(t => t.sigla === mapa.sigla);
        if (tipo) return tipo.id;
      }
    }
    // Fallback: se não tiver nenhum desses, ver se bate alguma sigla direto
    let possivel = tipos.find(t => nomeLower.includes(t.sigla.toLowerCase()));
    if (possivel) return possivel.id;
    
    return null;
  };

  const { data: docs, error: errDocs } = await supabase.from('documentos_funcionarios').select('*');
  if (errDocs) {
    console.error("Erro ao buscar documentos:", errDocs);
    return;
  }

  console.log(`Encontrados ${docs.length} documentos de funcionários para revisar.`);

  let alterados = 0;
  
  for (let doc of docs) {
    const nomeVelho = doc.nome_documento || '';
    const nomeNovo = padronizarNome(nomeVelho);
    
    let isChanged = false;
    let atualizacoes = {};

    if (nomeVelho !== nomeNovo) {
      atualizacoes.nome_documento = nomeNovo;
      isChanged = true;
    }

    if (!doc.tipo_documento_id) {
      const tipoSugerido = buscarTipoId(nomeNovo) || buscarTipoId(doc.caminho_arquivo);
      if (tipoSugerido) {
        atualizacoes.tipo_documento_id = tipoSugerido;
        isChanged = true;
      }
    }

    if (isChanged) {
      console.log(`ID: ${doc.id}`);
      console.log(`\tNome antigo: ${nomeVelho}`);
      console.log(`\tNovo nome  : ${atualizacoes.nome_documento || nomeVelho}`);
      if (atualizacoes.tipo_documento_id) {
        console.log(`\tNovo Tipo  : ID ${atualizacoes.tipo_documento_id}`);
      }
      
      const { error: errUpdate } = await supabase.from('documentos_funcionarios').update(atualizacoes).eq('id', doc.id);
      if (errUpdate) {
        console.error(`\tX Erro ao atualizar ID ${doc.id}: ${errUpdate.message}`);
      } else {
        alterados++;
      }
    }
  }

  console.log(`\nFinalizado! ${alterados} registros foram padronizados com sucesso.`);
}

run();
