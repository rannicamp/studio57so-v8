-- Cria as categorias de Antecipação vinculadas ao Sistema (Organização 1)

-- 1. Cria a categoria de Entrada / Receita
INSERT INTO public.categorias_financeiras (nome, tipo, organizacao_id)
SELECT 'Antecipação', 'Receita', 1
WHERE NOT EXISTS (
    SELECT 1 FROM public.categorias_financeiras 
    WHERE nome = 'Antecipação' AND tipo = 'Receita' AND organizacao_id = 1
);

-- 2. Cria a categoria de Saída / Despesa para as taxas
INSERT INTO public.categorias_financeiras (nome, tipo, organizacao_id)
SELECT 'Taxas de Antecipação', 'Despesa', 1
WHERE NOT EXISTS (
    SELECT 1 FROM public.categorias_financeiras 
    WHERE nome = 'Taxas de Antecipação' AND tipo = 'Despesa' AND organizacao_id = 1
);
