// app/(public)/simulador-financiamento/page.js

import { createClient } from '@/utils/supabase/server';
import SimuladorFinanceiroPublico from '@/components/SimuladorFinanceiroPublico';
import BotaoVoltar from '@/components/BotaoVoltar'; 

export const dynamic = 'force-dynamic';

export default async function SimuladorPage() {
    // CORREÇÃO DEFINITIVA:
    // 1. Não precisamos passar cookies() como argumento, sua função já faz isso.
    // 2. Adicionamos 'await' aqui porque sua função createClient é async.
    const supabase = await createClient();

    // Agora o 'supabase' é o cliente real, então o .from() vai funcionar!
    const { data: empreendimentos, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, status')
        .eq('listado_para_venda', true)
        .order('nome');

    if (error) {
        console.error("Erro ao buscar empreendimentos para o simulador:", error);
    }

    const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULO.PNG";

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-5xl mx-auto">
                
                <BotaoVoltar />

                <div className="mb-8 flex justify-center">
                    <img src={logoUrl} alt="Logo Studio 57" className="h-16 w-auto" />
                </div>
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-200">
                    <SimuladorFinanceiroPublico
                        empreendimentos={empreendimentos || []}
                    />
                </div>
                <p className="text-center text-xs text-gray-400 mt-4">
                    © {new Date().getFullYear()} Studio 57. Todos os direitos reservados. Esta é uma ferramenta de simulação e os valores podem sofrer alterações.
                </p>
            </div>
        </div>
    );
}