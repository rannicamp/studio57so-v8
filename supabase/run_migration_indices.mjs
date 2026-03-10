// c:\Projetos\studio57so-v8\supabase\run_migration_indices.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config'; // Certifique-se de que a variável de ambiente SUPABASE_SERVICE_ROLE_KEY esteja disponível

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function aplicarMigracao() {
  const sqlPath = path.resolve('supabase', 'migrations', '20260310_novo_indice_financeiro.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  console.log("Iniciando aplicação do SQL no Supabase Studio 57...");
  
  try {
    // Usando uma rota rpc ou direto pelo exec se existir. O Supabase REST nem sempre aceita SQL puro por query.
    // Vamos chamar o query via uma chamada POST genérica ou usando uma técnica alternativa.
    // O mais seguro quando não temos psql local é rodar isso via REST, mas a API padrão não deixa rodar SQL DDL (Create Table).
    // Vou tentar rodar como Postgres Function temporal, se falhar, precisaremos instruir o Ranniere a copiar e colar no painel SQL do Supabase.
    console.log("Tentando contactar tabela (Teste ping)...");
    const { data, error } = await supabase.from('contatos').select('id').limit(1);
    if(error) console.error("Erro ping:", error);
    else console.log("Ping OK. \n\n==== ATENÇÃO ====");
    
    console.log("A biblioteca @supabase/supabase-js NÃO permite executar comandos DDL (CREATE TABLE) diretamente por questões de segurança da API rest.");
    console.log("Para aplicar a tabela, rodaremos este script usando a ferramenta de CLI do DEVONILDO ou instruiremos o usuário a colar no SQL Editor do Supabase.");
    
  } catch(e) {
    console.error("Exceção:", e);
  }
}

aplicarMigracao();
