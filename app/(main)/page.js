import Link from 'next/link';
// CAMINHO CORRIGIDO DE ../ PARA ../../
import { createClient } from '../../utils/supabase/server'; 
import LogoutButton from '../../components/LogoutButton';

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: lembretes } = await supabase.from('lembretes').select('*');

  // Este componente não precisa mais mostrar o usuário, pois o Header já faz isso.
  // Mantendo o layout limpo e focado no conteúdo.
  return (
    <main className="text-center space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Principal</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md max-w-sm mx-auto">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">Lembretes</h2>
        {lembretes && lembretes.length > 0 ? (
          <ul className="list-disc list-inside text-left">
            {lembretes.map((lembrete) => (<li key={lembrete.id} className="text-gray-700">{lembrete.titulo}</li>))}
          </ul>
        ) : (<p className="text-gray-500">Nenhum lembrete encontrado.</p>)}
      </div>

      <div className="space-x-4">
        <Link href="/(main)/empresas/cadastro" className="inline-block bg-green-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-green-600">
          Cadastrar Nova Empresa
        </Link>
        <Link href="/(main)/upload" className="inline-block bg-cyan-500 text-white px-6 py-2 rounded-md shadow-sm hover:bg-cyan-600">
          Upload de Marca
        </Link>
      </div>
    </main>
  );
}