-- Permitir que todas as organizações leiam as categorias financeiras criadas pela Organização 1 (Sistema)
-- Isso garante que as categorias do nível do sistema apareçam nos Dropdowns, mas bloqueadas para edição/exclusão graças às outras políticas do Supabase que restringem DELETE e UPDATE.

CREATE POLICY "Leitura_Global_Org_1_Categorias" 
ON public.categorias_financeiras 
FOR SELECT 
USING (organizacao_id = 1);
