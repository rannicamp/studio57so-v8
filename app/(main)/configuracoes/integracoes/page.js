export const dynamic = 'force-dynamic';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import FacebookButton from '@/components/integracoes/FacebookButton';
import WhatsappButton from '@/components/integracoes/WhatsappButton'; // <--- IMPORTANDO O BOTAO DO WHATSAPP
import MetaSetupWizard from '@/components/integracoes/MetaSetupWizard'; // <--- IMPORTANDO O WIZARD MAGICO

export default async function IntegracoesPage() {
 const supabase = await createClient();

 // 1. Verifica Usuário
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) redirect('/login');

 // 2. Pega ID da Organização
 const { data: usuario } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
 if (!usuario?.organizacao_id) return <div>Erro: Sem organização.</div>;

 const organizacaoId = usuario.organizacao_id;

 // 3. Busca se já está conectado no FACEBOOK
 const { data: integracaoMeta } = await supabase
 .from('integracoes_meta')
 .select('status, nome_conta')
 .eq('organizacao_id', organizacaoId)
 .single();

 // 4. Busca se já está conectado no WHATSAPP (A MÁGICA ACONTECE AQUI)
 const { data: integracaoWhatsapp } = await supabase
 .from('configuracoes_whatsapp')
 .select('*')
 .eq('organizacao_id', organizacaoId)
 .single();

 return (
 <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-300">
 <h1 className="text-3xl font-bold mb-2 text-gray-900">Central de Integrações</h1>
 <p className="text-gray-600 mb-8">Conecte suas contas de redes sociais e ferramentas externas ao Elo 57 para turbinar seus resultados.</p>

 {/* O Modal Mágico (Fica invisível até que a URL tenha ?step=select_page) */}
 <MetaSetupWizard organizacaoId={organizacaoId} />

 {/* Ajustei para 3 colunas em telas grandes (lg:grid-cols-3) para caberem os 3 cards lindamente */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

 {/* 🟢 Botão do Facebook */}
 <FacebookButton
 isConnected={!!integracaoMeta?.status}
 accountName={integracaoMeta?.nome_conta}
 />

 {/* 🟢 Botão do WhatsApp Oficial */}
 <WhatsappButton
 initialData={integracaoWhatsapp}
 organizacaoId={organizacaoId}
 />

 {/* ⚪ Placeholder Google (Ajustei o design para ficar do mesmo tamanho dos outros) */}
 <div className="border border-gray-100 rounded-2xl p-8 shadow-sm bg-gray-50/50 opacity-70 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300 delay-150">
 <div>
 <div className="flex items-center gap-4 mb-6">
 <div className="w-14 h-14 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-500 shadow-inner">
 <span className="text-xl font-bold">G</span>
 </div>
 <div>
 <h3 className="font-bold text-gray-900 text-lg">Google Ads</h3>
 <p className="text-sm text-gray-500">Search & YouTube</p>
 </div>
 </div>
 <p className="text-sm text-gray-600 mb-6 leading-relaxed">
 Conecte sua conta do Google para acompanhar métricas e importar leads de campanhas de pesquisa diretamente no dashboard.
 </p>
 </div>
 <div className="mt-auto pt-6 border-t border-gray-100">
 <button disabled className="w-full py-3 bg-gray-100 text-gray-400 border border-gray-200 rounded-xl font-bold uppercase tracking-wider text-sm flex justify-center items-center cursor-not-allowed">
 Em breve
 </button>
 </div>
 </div>

 </div>
 </div>
 );
}