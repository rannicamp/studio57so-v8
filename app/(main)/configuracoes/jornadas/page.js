import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import JornadaManager from '../../../../components/JornadaManager';
import FeriadoManager from '../../../../components/FeriadoManager'; // Importa o novo componente

export default async function JornadasPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Busca os dados das jornadas e, AGORA TAMBÉM, dos feriados
  const [{ data: jornadas }, { data: feriados }] = await Promise.all([
    supabase.from('jornadas').select(`*, detalhes:jornada_detalhes(*)`).order('nome_jornada'),
    supabase.from('feriados').select('*').order('data_feriado')
  ]);

  return (
    <div className="space-y-10"> {/* Aumenta o espaçamento entre as seções */}
      <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para Configurações
      </Link>
      
      {/* Seção de Jornadas de Trabalho (já existente) */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciar Jornadas de Trabalho</h1>
        <p className="text-gray-600">
          Crie e edite os tipos de jornada de trabalho, definindo horários de entrada, saída e intervalos.
        </p>
        <div className="bg-white rounded-lg shadow p-6">
          <JornadaManager initialJornadas={jornadas || []} />
        </div>
      </div>

      {/* Nova Seção de Feriados */}
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