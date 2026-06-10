-- Função para processar o transbordo de leads sob responsabilidade da Stella IA para a fila circular do rodízio comercial
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
BEGIN
    -- 1. Obter o ID do contato da Stella IA para esta organização
    SELECT contato_id INTO v_stella_contato_id
    FROM public.usuarios
    WHERE email = 'stella.org' || NEW.organizacao_id || '@elo57.com.br';

    -- 2. Se a Stella IA não estiver configurada ou se o lead não estava atribuído à Stella, ignora
    IF v_stella_contato_id IS NULL OR OLD.corretor_id IS DISTINCT FROM v_stella_contato_id THEN
        RETURN NEW;
    END IF;

    -- 3. Se a coluna mudou para as colunas humanas (Intervenção Humana ou Cliente Potencial)
    -- IDs de sistema: 
    -- '7de9b5b4-05fa-4813-82d8-7790406ee268' -> INTERVENÇÃO HUMANA
    -- '0553d8db-5259-41bc-ae9e-b8803014ed93' -> CLIENTE POTENCIAL
    IF NEW.coluna_id IN ('7de9b5b4-05fa-4813-82d8-7790406ee268', '0553d8db-5259-41bc-ae9e-b8803014ed93') THEN
        
        -- 3a. Loop para obter o próximo corretor da sequência ordenada, pulando a própria Stella se ela estiver na fila
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

        -- 3b. Se um corretor foi retornado com sucesso da sequência do rodízio (e não é a própria Stella)
        IF v_corretor_sequencia.contato_id IS NOT NULL AND v_corretor_sequencia.contato_id IS DISTINCT FROM v_stella_contato_id THEN
            -- Atribui o corretor humano da vez ao card do funil
            NEW.corretor_id := v_corretor_sequencia.contato_id;

            -- 3c. Desativa o piloto automático da Stella IA no contato
            UPDATE public.contatos
            SET ia_atendimento_ativo = false
            WHERE id = NEW.contato_id;

            -- Obter nome do corretor para registrar na nota do CRM
            SELECT nome INTO v_nome_corretor
            FROM public.contatos
            WHERE id = v_corretor_sequencia.contato_id;

            -- 3d. Gravar uma nota na timeline do CRM documentando o transbordo
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

-- Criar a trigger BEFORE UPDATE na tabela contatos_no_funil
DROP TRIGGER IF EXISTS trg_transbordo_rodizio_crm ON public.contatos_no_funil;
CREATE TRIGGER trg_transbordo_rodizio_crm
    BEFORE UPDATE OF coluna_id ON public.contatos_no_funil
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_processar_transbordo_rodizio();
