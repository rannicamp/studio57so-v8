import { createClient } from '../../../../../utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import FichaCompletaFuncionario from '../../../../../components/FichaCompletaFuncionario';

async function getEmployeeData(id) {
    const supabase = createClient();
    
    const { data: employee, error } = await supabase.from('funcionarios').select('*').eq('id', id).single();
    if (error || !employee) return { employee: null };
    
    // Busca todos os dados em paralelo para mais performance
    const [
        { data: documents },
        { data: jornadas },
        { data: pontos },
        { data: abonos }
    ] = await Promise.all([
        supabase.from('documentos_funcionarios').select('*').eq('funcionario_id', id),
        supabase.from('jornadas').select('*, detalhes:jornada_detalhes(*)'),
        supabase.from('pontos').select('*').eq('funcionario_id', id),
        supabase.from('abonos').select('*').eq('funcionario_id', id)
    ]);

    return { 
        employee, 
        documents: documents || [], 
        jornadas: jornadas || [],
        pontos: pontos || [],
        abonos: abonos || []
    };
}

export default async function VisualizarFuncionarioPage({ params }) {
    const { employee, documents, jornadas, pontos, abonos } = await getEmployeeData(params.id);

    if (!employee) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <Link href="/funcionarios" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Funcionários
            </Link>

            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
                <FichaCompletaFuncionario 
                    employee={employee} 
                    allDocuments={documents}
                    allJornadas={jornadas}
                    allPontos={pontos}
                    allAbonos={abonos}
                />
            </div>
        </div>
    );
}