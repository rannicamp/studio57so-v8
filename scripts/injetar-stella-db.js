require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase...");
     await client.connect();
     
     console.log("Injetando SQL da coluna de funil e RPCs...");
     
     // 1. Criar a nova coluna no funil principal da Org 2
     await client.query(`
        -- Inserir a coluna se não existir
        INSERT INTO public.colunas_funil (id, nome, descricao, ordem, funil_id, organizacao_id)
        VALUES (
            '4b9b7e6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4', 
            'QUALIFICAÇÃO STELLA', 
            'Quem deve estar aqui: leads que demonstraram real interesse após a explicação do produto/marca e responderam às perguntas consultivas da Stella.',
            3, 
            'c0dd9026-6ede-4789-a77e-ec0e7fe8fa66', 
            2
        )
        ON CONFLICT (id) DO UPDATE 
        SET nome = EXCLUDED.nome, 
            descricao = EXCLUDED.descricao;

        -- Reordenar de forma estrita as colunas da Org 2 para evitar colisões
        UPDATE public.colunas_funil SET ordem = 0 WHERE id = 'e8e88027-c7be-4e8c-9667-e17fa4e06ce5';
        UPDATE public.colunas_funil SET ordem = 1 WHERE id = '660662df-a1e1-411f-9c2c-0907fce46126';
        UPDATE public.colunas_funil SET ordem = 2 WHERE id = '029c8d6a-4799-4f4b-a55e-b4d5426718c0';
        UPDATE public.colunas_funil SET ordem = 3 WHERE id = '4b9b7e6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4';
        UPDATE public.colunas_funil SET ordem = 4 WHERE id = '7de9b5b4-05fa-4813-82d8-7790406ee268';
        UPDATE public.colunas_funil SET ordem = 5 WHERE id = '0553d8db-5259-41bc-ae9e-b8803014ed93';
        UPDATE public.colunas_funil SET ordem = 6 WHERE id = '111fce3d-3219-49e1-9d09-464c76bf6a12';
        UPDATE public.colunas_funil SET ordem = 7 WHERE id = '3db11a5d-8870-4967-917a-5d67c2cae084';
        UPDATE public.colunas_funil SET ordem = 8 WHERE id = '4586f8ab-021b-4d16-bdd6-c325c32276a8';
        UPDATE public.colunas_funil SET ordem = 9 WHERE id = 'c69be155-8422-45a2-a59d-0d47458be1bc';
        UPDATE public.colunas_funil SET ordem = 10 WHERE id = 'b0bde646-940e-4def-8601-cfd5c8ab805e';
        UPDATE public.colunas_funil SET ordem = 11 WHERE id = '2e719049-ff1c-49df-8fb8-da1fcefc98cc';
        UPDATE public.colunas_funil SET ordem = 12 WHERE id = '5bdd47f6-35d6-4662-93f2-f7c0fc4ba60e';
        UPDATE public.colunas_funil SET ordem = 13 WHERE id = 'feaa8511-261d-451b-bf99-24c8a6d6e7e0';
        UPDATE public.colunas_funil SET ordem = 14 WHERE id = '2b975bc0-b96c-456d-ac30-48ab6f6dddca';
     `);
     console.log("Coluna QUALIFICAÇÃO STELLA e reordenamento do funil aplicados.");

     // 2. Criar RPCs do Gemini
     await client.query(`
        -- 2.1 Obter empreendimentos ativos listados para venda
        CREATE OR REPLACE FUNCTION public.fn_stella_obter_empreendimentos(p_organizacao_id bigint)
        RETURNS TABLE (
            id bigint,
            nome text,
            categoria text
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            RETURN QUERY
            SELECT e.id, e.nome, e.categoria::text
            FROM public.empreendimentos e
            WHERE e.organizacao_id = p_organizacao_id
              AND e.listado_para_venda = true
              AND e.arquivado = false;
        END;
        $$;

        -- 2.2 Obter dossiê em Markdown de um empreendimento
        CREATE OR REPLACE FUNCTION public.fn_stella_obter_dossie(p_empreendimento_id bigint)
        RETURNS text
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_dossie text;
        BEGIN
            SELECT dossie_ia INTO v_dossie
            FROM public.empreendimentos
            WHERE id = p_empreendimento_id;
            
            RETURN v_dossie;
        END;
        $$;

        -- 2.3 Obter estoque de unidades habitacionais livres
        CREATE OR REPLACE FUNCTION public.fn_stella_obter_estoque(p_empreendimento_id bigint, p_organizacao_id bigint)
        RETURNS TABLE (
            unidade text,
            area_m2 numeric,
            valor_venda numeric,
            status text
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            RETURN QUERY
            SELECT p.unidade, p.area_m2, p.valor_venda_calculado as valor_venda, p.status::text
            FROM public.produtos_empreendimento p
            WHERE p.empreendimento_id = p_empreendimento_id
              AND p.organizacao_id = p_organizacao_id
              AND p.status = 'Disponível'
              AND (p.unidade NOT ILIKE '%MOTO%' AND p.unidade NOT ILIKE '%CARRO%' AND p.unidade NOT ILIKE '%GARAGEM%' AND p.unidade NOT ILIKE '%VAGA%');
        END;
        $$;

        -- 2.4 Obter anexos/books de vendas disponíveis
        CREATE OR REPLACE FUNCTION public.fn_stella_obter_anexos(p_empreendimento_id bigint, p_organizacao_id bigint)
        RETURNS TABLE (
            id bigint,
            nome_arquivo text,
            caminho_arquivo text,
            descricao text
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            RETURN QUERY
            SELECT a.id, a.nome_arquivo, a.caminho_arquivo, a.descricao
            FROM public.empreendimento_anexos a
            WHERE a.empreendimento_id = p_empreendimento_id
              AND a.organizacao_id = p_organizacao_id
              AND a.disponivel_corretor = true;
        END;
        $$;
     `);
     console.log("RPCs de ferramentas da Stella criadas no Supabase.");

     // 3. Atualizar a trigger de transbordo do rodízio
     await client.query(`
        CREATE OR REPLACE FUNCTION public.fn_processar_transbordo_rodizio()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_stella_contato_id bigint;
            v_corretor_sequencia record;
            v_nome_corretor text;
            v_tentativas integer := 0;
            v_colunas_ativas jsonb;
            v_rodizio_ativo boolean;
        BEGIN
            -- 1. Obter a configuração de rodízio da organização (is_active e colunas_rodizio)
            SELECT is_active, colunas_rodizio INTO v_rodizio_ativo, v_colunas_ativas
            FROM public.crm_rodizio_config
            WHERE organizacao_id = NEW.organizacao_id;

            -- Se o rodízio geral não estiver ativo, ignora
            IF v_rodizio_ativo IS NOT TRUE THEN
                RETURN NEW;
            END IF;

            -- 2. Obter o ID do contato da Stella IA para esta organização
            SELECT contato_id INTO v_stella_contato_id
            FROM public.usuarios
            WHERE email = 'stella.org' || NEW.organizacao_id || '@elo57.com.br';

            -- 3. Se a Stella IA não estiver configurada ou se o lead não estava atribuído à Stella, ignora
            IF v_stella_contato_id IS NULL OR OLD.corretor_id IS DISTINCT FROM v_stella_contato_id THEN
                RETURN NEW;
            END IF;

            -- 4. Verificar se a nova coluna (NEW.coluna_id) está na lista de colunas configuradas para rodízio
            -- Fallback para colunas padrão do sistema se a lista estiver vazia:
            -- '7de9b5b4-05fa-4813-82d8-7790406ee268' -> INTERVENÇÃO HUMANA
            -- '4b9b7e6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4' -> QUALIFICAÇÃO STELLA
            IF (v_colunas_ativas IS NOT NULL AND jsonb_array_length(v_colunas_ativas) > 0 AND v_colunas_ativas ? NEW.coluna_id::text) 
               OR 
               ((v_colunas_ativas IS NULL OR jsonb_array_length(v_colunas_ativas) = 0) AND NEW.coluna_id IN ('7de9b5b4-05fa-4813-82d8-7790406ee268', '4b9b7e6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4'))
            THEN
                
                -- 4a. Loop para obter o próximo corretor da sequência ordenada, pulando a própria Stella se ela estiver na fila
                LOOP
                    SELECT usuario_id, contato_id INTO v_corretor_sequencia
                    FROM public.fn_distribuir_lead_rodizio(NEW.organizacao_id);
                    
                    v_tentativas := v_tentativas + 1;
                    
                    -- Se não retornou corretor, ou retornou um corretor humano válido (diferente da Stella), ou atingimos um limite de segurança (evitar loop infinito)
                    IF v_corretor_sequencia.contato_id IS NULL 
                       OR v_corretor_sequencia.contato_id IS DISTINCT FROM v_stella_contato_id 
                       OR v_tentativas > 10 
                    THEN
                        EXIT;
                    END IF;
                END LOOP;

                -- 4b. Se um corretor foi retornado com sucesso da sequência do rodízio (e não é a própria Stella)
                IF v_corretor_sequencia.contato_id IS NOT NULL AND v_corretor_sequencia.contato_id IS DISTINCT FROM v_stella_contato_id THEN
                    -- Atribui o corretor humano da vez ao card do funil
                    NEW.corretor_id := v_corretor_sequencia.contato_id;

                    -- 4c. Desativa o piloto automático da Stella IA no contato
                    UPDATE public.contatos
                    SET ia_atendimento_ativo = false
                    WHERE id = NEW.contato_id;

                    -- Obter nome do corretor para registrar na nota do CRM
                    SELECT nome INTO v_nome_corretor
                    FROM public.contatos
                    WHERE id = v_corretor_sequencia.contato_id;

                    -- 4d. Gravar uma nota na timeline do CRM documentando o transbordo
                    INSERT INTO public.crm_notas (
                        contato_id,
                        contato_no_funil_id,
                        conteudo,
                        usuario_id,
                        organizacao_id
                    ) VALUES (
                        NEW.contato_id,
                        NEW.id,
                        '🤖 Transbordo Stella IA: Lead transferido da Stella IA para o corretor humano "' || COALESCE(v_nome_corretor, 'Corretor da Sequência') || '" (próximo da fila circular do rodízio).',
                        v_corretor_sequencia.usuario_id,
                        NEW.organizacao_id
                    );
                END IF;
            END IF;

            RETURN NEW;
        END;
        $$;
     `);
     console.log("Trigger de transbordo de rodízio atualizada para Qualificação Stella.");
     console.log("Operação SQL homologada com sucesso!");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
