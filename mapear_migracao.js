import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function gerarProposta() {
  console.log("Iniciando mapeamento inteligente dos 142 arquivos...");

  const { data: tipos } = await supabase.from('documento_tipos').select('id, sigla, descricao');
  const anexos = JSON.parse(fs.readFileSync('diagnostico_anexos.json', 'utf-8'));

  // Função auxiliar para encontrar o ID do tipo pela sigla exata (ignorando espaços soltos no banco)
  const getTipo = (siglaBusca) => {
    return tipos.find(t => t.sigla && t.sigla.trim().toUpperCase() === siglaBusca.toUpperCase());
  };

  const proposta = anexos.map(anexo => {
    let nomeOriginal = anexo.nome_atual;
    let nomeUpper = nomeOriginal.toUpperCase();
    
    let novaSigla = anexo.tipo_atual_sigla ? anexo.tipo_atual_sigla.trim() : 'OUT';
    let novaAba = anexo.aba_atual;
    let novoNome = nomeOriginal;

    // REGRAS DE INFERÊNCIA BASEADAS EM PALAVRAS-CHAVE DO NOME
    if (nomeUpper.includes('ART ')) {
      novaSigla = 'ART';
      novaAba = 'engenharia';
    } else if (nomeUpper.includes('RRT')) {
      novaSigla = 'RRT';
      novaAba = 'engenharia';
    } else if (nomeUpper.includes('MEMORIAL')) {
      novaSigla = 'PROJ';
      novaAba = 'engenharia';
    } else if (nomeUpper.includes('CRONOGRAMA') || nomeUpper.includes('SONDAGEM')) {
      novaSigla = 'RLT'; // Relatórios
      novaAba = 'engenharia';
    } else if (nomeUpper.includes('PROJETO') || nomeUpper.includes('QUADROS NBR') || nomeUpper.includes('PLANTA')) {
      if(!nomeUpper.includes('HUMANIZADA')){ 
        novaSigla = 'PROJ';
        novaAba = 'engenharia';
      }
    } else if (nomeUpper.includes('MATRÍCULA') || nomeUpper.includes('MATRICULA') || nomeUpper.includes('LOTE')) {
      novaSigla = 'MAT';
      novaAba = 'juridico';
    } else if (nomeUpper.includes('CONTRATO') || nomeUpper.includes('ADITIVO') || nomeUpper.includes('COMPRA E VENDA')) {
      novaSigla = 'CON';
      novaAba = 'juridico';
    } else if (nomeUpper.includes('ALVARÁ') || nomeUpper.includes('CERTIDÃO') || nomeUpper.includes('CND') || nomeUpper.includes('BCI')) {
      novaSigla = 'CT';
      novaAba = 'juridico';
    } else if (nomeUpper.endsWith('.JPG') || nomeUpper.endsWith('.PNG') || nomeUpper.endsWith('.MP4')) {
      novaSigla = nomeUpper.endsWith('.MP4') ? 'VID' : 'IMG';
      novaAba = 'marketing';
    }

    // FORMATAÇÃO DO NOVO NOME SEGUNDO O GABARITO (Se já não tiver a sigla)
    if (!novoNome.startsWith(`[${novaSigla}]`)) {
      // Limpar sujeiras antigas do nome (ex: RESIDENCIAL ALFA_, 250131_) para o nome enxuto
      let nomeLimpo = nomeOriginal;
      if(nomeLimpo.includes('RESIDENCIAL ALFA_')) nomeLimpo = nomeLimpo.replace('RESIDENCIAL ALFA_', '');
      
      novoNome = `[${novaSigla}] - ${nomeLimpo}`;
    }

    // Encontrar o UUID verdadeiro do novo tipo
    const tipoDB = getTipo(novaSigla);
    const novoTipoId = tipoDB ? tipoDB.id : null;

    return {
      id: anexo.id,
      nome_antigo: anexo.nome_atual,
      aba_antiga: anexo.aba_atual,
      sigla_antiga: anexo.tipo_atual_sigla ? anexo.tipo_atual_sigla.trim() : 'NULL',
      
      // As propostas de mudança!
      NOVO_NOME: novoNome,
      NOVA_ABA: novaAba,
      NOVA_SIGLA_DB: novaSigla,
      NOVO_TIPO_ID: novoTipoId
    };
  });

  fs.writeFileSync('proposta_migracao.json', JSON.stringify(proposta, null, 2), 'utf-8');
  console.log("Mapeamento concluído! O arquivo 'proposta_migracao.json' foi criado para a revisão do Ranniere.");

  // Mostrar uma amostra rápida no terminal
  console.log("\n--- AMOSTRA RÁPIDA (Os 5 primeiros itens modificados) ---");
  const modificados = proposta.filter(p => p.NOVA_ABA !== p.aba_antiga || p.NOVO_NOME !== p.nome_antigo);
  console.log(modificados.slice(0, 5));
}

gerarProposta();
