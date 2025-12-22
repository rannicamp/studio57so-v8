// app/(main)/configuracoes/jornadas/page.js
import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import JornadaManager from '../../../../components/JornadaManager';
import FeriadoManager from '../../../../components/FeriadoManager';

export default async function JornadasPage() {
    // CORREÇÃO: Adicionado 'await' aqui
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
            .eq('recurso', 'config_jornadas')
            .single();

        if (permissionError || !permissionData?.pode_ver) {
            redirect('/'); // Redireciona se não tiver permissão
        }
    }
    
    const [{ data: jornadas }, { data: feriados }] = await Promise.all([
        supabase
            .from('jornadas')
            .select(`*, detalhes:jornada_detalhes(*)`)
            .eq('organizacao_id', organizacao_id) 
            .order('nome_jornada'),
        supabase
            .from('feriados')
            .select('*')
            .eq('organizacao_id', organizacao_id) 
            .order('data_feriado')
    ]);

    return (
        <div className="space-y-10">
            <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para Configurações
            </Link>
            
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciar Jornadas de Trabalho</h1>
                <p className="text-gray-600">
                    Crie e edite os tipos de jornada de trabalho, definindo horários de entrada, saída e intervalos.
                </p>
                <div className="bg-white rounded-lg shadow p-6">
                    <JornadaManager initialJornadas={jornadas || []} />
                </div>
            </div>

            <div className="space-y-6 pt-10 border-t">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciar Feriados</h1>
                <p className="text-gray-600">
                    Adicione feriados nacionais, estaduais ou municipais. Estes dias não serão contados como dias úteis na folha de ponto.
                </p>
                <div className="bg-white rounded-lg shadow p-6">
                    <FeriadoManager initialFeriados={feriados || []} />
                </div>
            </div>
        </div>
    );
}