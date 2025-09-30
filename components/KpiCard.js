// components/KpiCard.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// =================================================================================
// INÍCIO DA CORREÇÃO DE RESPONSIVIDADE
// O PORQUÊ: Aplicamos classes responsivas do TailwindCSS para ajustar o tamanho
// dos textos e do ícone de acordo com o tamanho da tela, garantindo que os
// KPIs sejam bem visualizados em desktops, tablets e celulares.
// =================================================================================
export default function KpiCard({ title, value, icon }) {
    return (
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-full">
                {/* O ícone agora se ajusta em telas pequenas */}
                <FontAwesomeIcon icon={icon} className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
                {/* O título agora tem um tamanho de texto menor em telas pequenas */}
                <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
                {/* - O valor principal agora é maior em desktops (text-2xl), médio em tablets (text-xl)
                    e menor em celulares (text-lg).
                  - A classe 'break-words' garante que valores muito longos (como o de negociação)
                    possam quebrar a linha se necessário, em vez de transbordar.
                */}
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 break-words">{value}</p>
            </div>
        </div>
    );
}
// =================================================================================
// FIM DA CORREÇÃO DE RESPONSIVIDADE
// =================================================================================