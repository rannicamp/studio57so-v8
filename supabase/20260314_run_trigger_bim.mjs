import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres.vhuvnutzklhskkwbpxdz:Srbr19010720%40@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✅ Conectado ao Supabase!');

try {
    console.log('⏳ Criando Função Recalculate_BIM_Element_Status...');
    await client.query(`
        CREATE OR REPLACE FUNCTION public.recalculate_bim_element_status(
            p_external_id text, 
            p_projeto_bim_id bigint, 
            p_organizacao_id bigint
        ) RETURNS void AS $$
        DECLARE
            v_total int;
            v_concluidas int;
            v_andamento int;
            v_atrasadas int;
            v_novo_status text;
        BEGIN
            SELECT 
                count(*),
                count(*) FILTER (WHERE lower(a.status) LIKE '%onclu%' OR lower(a.status) LIKE '%xecut%'),
                count(*) FILTER (WHERE lower(a.status) LIKE '%anda%' OR lower(a.status) LIKE '%inici%'),
                count(*) FILTER (WHERE lower(a.status) LIKE '%atras%' OR lower(a.status) LIKE '%bloq%')
            INTO 
                v_total, v_concluidas, v_andamento, v_atrasadas
            FROM public.atividades_elementos ae
            JOIN public.activities a ON a.id = ae.atividade_id
            WHERE ae.external_id = p_external_id 
              AND ae.projeto_bim_id = p_projeto_bim_id
              AND ae.organizacao_id = p_organizacao_id;

            IF v_total = 0 THEN
                v_novo_status := 'Planejado';
            ELSIF v_concluidas = v_total THEN
                v_novo_status := 'Concluído';
            ELSIF v_atrasadas > 0 THEN
                v_novo_status := 'Atrasado';
            ELSIF v_andamento > 0 OR v_concluidas > 0 THEN
                v_novo_status := 'Em Andamento';
            ELSE
                v_novo_status := 'Planejado';
            END IF;

            UPDATE public.elementos_bim
            SET status_execucao = v_novo_status
            WHERE external_id = p_external_id
              AND projeto_bim_id = p_projeto_bim_id
              AND organizacao_id = p_organizacao_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('⏳ Criando Function trg_activity_status_change...');
    await client.query(`
        CREATE OR REPLACE FUNCTION public.trg_activity_status_change()
        RETURNS trigger AS $$
        DECLARE
            r RECORD;
        BEGIN
            IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
                FOR r IN 
                    SELECT external_id, projeto_bim_id, organizacao_id 
                    FROM public.atividades_elementos
                    WHERE atividade_id = NEW.id
                LOOP
                    PERFORM public.recalculate_bim_element_status(r.external_id, r.projeto_bim_id, r.organizacao_id);
                END LOOP;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('⏳ Criando Trigger em activities...');
    await client.query(`DROP TRIGGER IF EXISTS trg_activity_status_change_exec ON public.activities;`);
    await client.query(`
        CREATE TRIGGER trg_activity_status_change_exec
            AFTER UPDATE ON public.activities
            FOR EACH ROW
            EXECUTE FUNCTION public.trg_activity_status_change();
    `);

    console.log('⏳ Criando Function trg_atividades_elementos_change...');
    await client.query(`
        CREATE OR REPLACE FUNCTION public.trg_atividades_elementos_change()
        RETURNS trigger AS $$
        BEGIN
            IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
                PERFORM public.recalculate_bim_element_status(NEW.external_id, NEW.projeto_bim_id, NEW.organizacao_id);
                RETURN NEW;
            ELSIF (TG_OP = 'DELETE') THEN
                PERFORM public.recalculate_bim_element_status(OLD.external_id, OLD.projeto_bim_id, OLD.organizacao_id);
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('⏳ Criando Trigger em atividades_elementos...');
    await client.query(`DROP TRIGGER IF EXISTS trg_atividades_elementos_change_exec ON public.atividades_elementos;`);
    await client.query(`
        CREATE TRIGGER trg_atividades_elementos_change_exec
            AFTER INSERT OR UPDATE OR DELETE ON public.atividades_elementos
            FOR EACH ROW
            EXECUTE FUNCTION public.trg_atividades_elementos_change();
    `);

    console.log('✅ Tudo criado com sucesso!');
} catch (error) {
    console.error('❌ ERRO:', error.message, error.stack);
} finally {
    await client.end();
    console.log('🔌 Conexão encerrada.');
}
