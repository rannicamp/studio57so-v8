import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import JornadaManager from '../../../../components/JornadaManager';

export default async function JornadasPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Busca os dados iniciais das jornadas e seus detalhes
  const { data: jornadas, error } = await supabase
    .from('jornadas')
    .select(`
      *,
      detalhes:jornada_detalhes(*)
    `)
    .order('nome_jornada');

  if (error) {
    console.error("Erro ao buscar jornadas:", error);
  }

  return (
    <div className="space-y-6">
      <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para Configurações
      </Link>
      <h1 className="text-3xl font-bold text-gray-900">Gerenciar Jornadas de Trabalho</h1>
      <p className="text-gray-600">
        Crie e edite os tipos de jornada de trabalho, definindo horários de entrada, saída, intervalos e regras para feriados.
      </p>

      <div className="bg-white rounded-lg shadow p-6">
        <JornadaManager initialJornadas={jornadas || []} />
      </div>
    </div>
  );
}