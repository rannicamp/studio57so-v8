require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const password = process.argv[2] || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  // Extrai inteligentemente o Subdomínio correto do Projeto a partir da URL pública
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  // String de Conexão MASTER: Porta 6543 obrigatória.
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase...");
     await client.connect();
     
     console.log("Criando Função...");
     await client.query(`
        CREATE OR REPLACE FUNCTION trg_calcular_valor_venda_produto()
        RETURNS trigger AS $$
        BEGIN
          -- PASSO 1: Garantir que o Preço Base está alinhado com a Área e Preço/m²
          IF NEW.area_m2 IS NOT NULL AND NEW.preco_m2 IS NOT NULL THEN
            NEW.valor_base := NEW.area_m2 * NEW.preco_m2;
          END IF;

          -- PASSO 2: Calcular o Valor Final aplicando o Fator de Reajuste (%)
          IF NEW.valor_base IS NOT NULL THEN
            NEW.valor_venda_calculado := NEW.valor_base * (1 + (COALESCE(NEW.fator_reajuste_percentual, 0) / 100));
          ELSE
            NEW.valor_venda_calculado := NULL;
          END IF;

          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
     `);

     console.log("Verificando se a trigger existe...");
     await client.query(`DROP TRIGGER IF EXISTS trg_calcular_valor_venda_produto_trigger ON produtos_empreendimento;`);

     console.log("Criando Trigger...");
     await client.query(`
        CREATE TRIGGER trg_calcular_valor_venda_produto_trigger
        BEFORE INSERT OR UPDATE ON produtos_empreendimento
        FOR EACH ROW
        EXECUTE FUNCTION trg_calcular_valor_venda_produto();
     `);

     console.log("Atualizando histórico (UPDATE)...");
     const res = await client.query(`
        UPDATE produtos_empreendimento 
        SET 
          valor_base = CASE 
            WHEN area_m2 IS NOT NULL AND preco_m2 IS NOT NULL THEN area_m2 * preco_m2 
            ELSE valor_base 
          END,
          valor_venda_calculado = (
            CASE 
              WHEN area_m2 IS NOT NULL AND preco_m2 IS NOT NULL THEN area_m2 * preco_m2 
              ELSE valor_base 
            END
          ) * (1 + (COALESCE(fator_reajuste_percentual, 0) / 100))
     `);
     console.log(`Histórico corrigido. Linhas afetadas: ${res.rowCount}`);

     console.log("Operação SQL homologada com sucesso!");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
