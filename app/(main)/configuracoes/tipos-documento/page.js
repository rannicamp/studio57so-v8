//app/(main)/configuracoes/tipos-documento/page.js
import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import TipoDocumentoManager from '../../../../components/configuracoes/TipoDocumentoManager';

export default async function TiposDocumentoPage() {
    const supabase = await createClient();

    // 1. Verifica se há um usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // 2. Busca o perfil do usuário para obter a função e a organização
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('funcao_id, organizacao_id, funcoes ( nome_funcao )')
        .eq('id', user.id)
        .single();

    if (userError || !userData) {
        console.error("Erro ao buscar dados do usuário:", userError);
        redirect('/');
    }
    
    const { funcao_id, organizacao_id } = userData;

    // 3. Verifica a permissão de acesso
    if (userData.funcoes?.nome_funcao !== 'Proprietário') {
        const { data: permissionData, error: permissionError } = await supabase
            .from('permissoes')
            .select('pode_ver')
            .eq('funcao_id', funcao_id)
            .eq('recurso', 'config_tipos_documento')
            .single();

        if (permissionError || !permissionData?.pode_ver) {
            redirect('/'); // Redireciona se não tiver permissão
        }
    }

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: A busca por tipos de documento agora é filtrada pelo `organizacao_id`
    // do usuário logado, garantindo que apenas os dados da organização correta
    // sejam carregados e enviados para o componente.
    // =================================================================================
    const { data: tipos, error } = await supabase
        .from('documento_tipos')
        .select('*')
        .eq('organizacao_id', organizacao_id) // <-- FILTRO DE SEGURANÇA!
        .order('sigla');
        
    if (error) console.error("Erro ao buscar tipos de documento:", error);

    return (
        <div className="space-y-6">
            <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para Configurações
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Gerenciar Tipos de Documento</h1>
            <p className="text-gray-600">
                Adicione, edite ou remova as siglas e abreviaturas usadas para nomear os arquivos do sistema.
            </p>
            <div className="bg-white rounded-lg shadow p-6">
                <TipoDocumentoManager initialData={tipos || []} />
            </div>
        </div>
    );
}