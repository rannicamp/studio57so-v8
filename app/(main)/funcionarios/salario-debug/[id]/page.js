// app/(main)/funcionarios/salario-debug/[id]/page.js
import { createClient } from '../../../../../utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// Função para formatar a data
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR');
};

// Função para formatar moeda
const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default async function SalarioDebugPage({ params }) {
    const supabase = await createClient();
    const employeeId = params.id;

    // Busca o nome do funcionário
    const { data: employee, error: empError } = await supabase
        .from('funcionarios')
        .select('full_name')
        .eq('id', employeeId)
        .single();

    if (empError || !employee) {
        notFound();
    }

    // Busca TODO o histórico salarial para este funcionário, ORDENADO DO MAIS RECENTE PARA O MAIS ANTIGO
    const { data: historico, error: histError } = await supabase
        .from('historico_salarial')
        .select('*')
        .eq('funcionario_id', employeeId)
        .order('data_inicio_vigencia', { ascending: false });

    if (histError) {
        return <p className="text-red-500">Erro ao buscar histórico: {histError.message}</p>;
    }

    return (
        <div className="p-6 bg-white rounded-lg shadow space-y-4">
            <Link href={`/funcionarios/visualizar/${employeeId}`} className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Ficha do Funcionário
            </Link>
            <h1 className="text-2xl font-bold">Diagnóstico do Histórico Salarial</h1>
            <h2 className="text-xl font-semibold text-gray-700">{employee.full_name}</h2>
            <p className="text-sm text-gray-600">
                A tabela abaixo mostra todos os registros salariais ordenados do mais recente para o mais antigo. A primeira linha é a que o sistema está usando como o salário atual.
            </p>
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-2 text-left font-bold">Data de Início da Vigência</th>
                            <th className="px-4 py-2 text-right font-bold">Salário Base</th>
                            <th className="px-4 py-2 text-right font-bold">Valor Diária</th>
                            <th className="px-4 py-2 text-left font-bold">Motivo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {historico.map((item, index) => (
                            <tr key={item.id} className={index === 0 ? 'bg-yellow-100 font-bold' : ''}>
                                <td className="px-4 py-2">{formatDate(item.data_inicio_vigencia)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(item.salario_base)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(item.valor_diaria)}</td>
                                <td className="px-4 py-2">{item.motivo_alteracao}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {historico.length === 0 && <p className="text-center py-4">Nenhum histórico salarial encontrado para este funcionário.</p>}
        </div>
    );
}