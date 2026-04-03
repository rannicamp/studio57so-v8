'use client';

import MetaCard from './cards/MetaCard';
// import GoogleCard from './cards/GoogleCard'; // Futuro
// import WhatsAppCard from './cards/WhatsAppCard'; // Futuro

export default function IntegrationsGrid({ organizacaoId, metaData, googleData, whatsAppData }) {
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {/* --- Card do Meta Ads (Facebook/Instagram) --- */}
 <MetaCard initialData={metaData} organizacaoId={organizacaoId} />

 {/* --- Card do Google (Placeholder Visual) --- */}
 <div className="border rounded-xl p-6 bg-white shadow-sm opacity-50 relative">
 <div className="absolute top-4 right-4 bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded">Em Breve</div>
 <div className="w-12 h-12 bg-white border rounded-full flex items-center justify-center mb-4 shadow-sm">
 <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-6 h-6" />
 </div>
 <h3 className="font-semibold text-lg">Google Ads</h3>
 <p className="text-sm text-gray-500 mt-2 mb-6">Conecte sua conta Google para sincronizar campanhas.</p>
 <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
 Indisponível
 </button>
 </div>

 {/* --- Outros cards viriam aqui --- */}
 </div>
 );
}