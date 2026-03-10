// app/(landingpages)/refugiobraunas/simulador/page.js
import React from 'react';
import SimuladorBraunas from '@/components/simuladores/SimuladorBraunas';
import BotaoVoltar from '@/components/BotaoVoltar';

export const dynamic = 'force-dynamic';

export default function SimuladorBraunasPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8">
            <div className="w-full max-w-5xl mx-auto space-y-4">
                <BotaoVoltar baseUrl="/refugiobraunas" />

                <div className="flex justify-center mb-6">
                    <img 
                        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULO.PNG" 
                        alt="Logo Studio 57" 
                        className="h-14 w-auto drop-shadow-sm opacity-80" 
                    />
                </div>

                <div className="bg-white p-2 md:p-6 rounded-3xl shadow-xl border border-gray-100">
                    <SimuladorBraunas />
                </div>
                
                <p className="text-center text-xs text-gray-400 font-medium pt-8 pb-4">
                    © {new Date().getFullYear()} Studio 57. Todos os direitos reservados. Esta é uma ferramenta de simulação didática baseada no IPCA Acumulado 12M retroativo. Os valores sofrem correções mensais em contrato.
                </p>
            </div>
        </div>
    );
}
