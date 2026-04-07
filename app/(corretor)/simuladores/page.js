// app/(corretor)/simuladores/page.js
import { createClient } from '@/utils/supabase/server';
import SimuladorTabs from './SimuladorTabs';

export const dynamic = 'force-dynamic';

export default async function SimuladoresHubPage() {
 const supabase = await createClient();

 // Busca de empreendimentos para o Simulador Padrão
 const { data: empreendimentos, error } = await supabase
 .from('empreendimentos')
 .select('id, nome, status, logo_url, observacoes, proprietaria:cadastro_empresa!empresa_proprietaria_id(logo_url)')
 .eq('listado_para_venda', true)
 .order('nome');

 if (error) {
 console.error("Erro ao buscar empreendimentos para o simulador:", error);
 }

 return (
 <div className="max-w-7xl mx-auto space-y-6">
 <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
 <h1 className="text-2xl font-bold text-gray-800">
 Calculadora e Simuladores
 </h1>
 <p className="text-gray-500 mt-1">
 Ferramentas de simulação de financiamento e parcelamento direto para clientes.
 </p>
 </div>
 <SimuladorTabs empreendimentos={empreendimentos || []} />
 </div>
 );
}
