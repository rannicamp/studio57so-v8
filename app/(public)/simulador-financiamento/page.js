// app/(public)/simulador-financiamento/page.js

import { createClient } from '@/utils/supabase/server';
import SimuladorFinanceiroPublico from '@/components/SimuladorFinanceiroPublico';

export const dynamic = 'force-dynamic';

export default async function SimuladorPage() {
  const supabase = createClient();

  // ***** CORREÇÃO APLICADA AQUI *****
  // Agora, a busca filtra pela nova coluna 'listado_para_venda'
  const { data: empreendimentos, error } = await supabase
    .from('empreendimentos')
    .select('id, nome, status')
    .eq('listado_para_venda', true) // Filtra apenas empreendimentos marcados para venda
    .order('nome');

  if (error) {
    console.error("Erro ao buscar empreendimentos para o simulador:", error);
  }

  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl mx-auto">
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