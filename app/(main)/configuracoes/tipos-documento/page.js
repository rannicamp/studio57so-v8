import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import TipoDocumentoManager from '../../../../components/TipoDocumentoManager';

export default async function TiposDocumentoPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: tipos, error } = await supabase.from('documento_tipos').select('*').order('sigla');
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