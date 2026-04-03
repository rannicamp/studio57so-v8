-- Criação da Tabela de Telemetria de Erros da Interface
CREATE TABLE public.logs_erros_ui (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    mensagem TEXT NOT NULL,
    detalhes TEXT,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    url_atual TEXT,
    organizacao_id BIGINT,
    browser_info TEXT
);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.logs_erros_ui ENABLE ROW LEVEL SECURITY;

-- Política 1: Permitir que qualquer um consiga inserir erros (até quem não está logado)
CREATE POLICY "Permitir Insercao Universal de Erros" 
ON public.logs_erros_ui 
FOR INSERT 
WITH CHECK (true);

-- Política 2: Permitir Leitura Somente para Membros da Organização 1 (SysAdmins) e donos dos erros
CREATE POLICY "Permitir Leitura do Log" 
ON public.logs_erros_ui 
FOR SELECT TO authenticated 
USING (
  organizacao_id = 1 
  OR organizacao_id = (SELECT get_auth_user_org())
);
