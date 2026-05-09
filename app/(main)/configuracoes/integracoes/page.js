export const dynamic = 'force-dynamic';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import FacebookButton from '@/components/integracoes/FacebookButton';
import WhatsappButton from '@/components/integracoes/WhatsappButton';
import MetaSetupWizard from '@/components/integracoes/MetaSetupWizard';
import GoogleCalendarButton from '@/components/integracoes/GoogleCalendarButton';

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

  // 5. Busca as integrações do GOOGLE
  const { data: integracoesGoogle } = await supabase
    .from('integracoes_google')
    .select('is_active, tipo_conexao')
    .eq('user_id', user.id);

  const googleAgenda = integracoesGoogle?.find(i => i.tipo_conexao === 'agenda');
  const googleDrive = integracoesGoogle?.find(i => i.tipo_conexao === 'drive');
  const googleContatos = integracoesGoogle?.find(i => i.tipo_conexao === 'contatos');

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Central de Integrações</h1>
      <p className="text-gray-600 mb-8">Conecte suas contas de redes sociais e ferramentas externas ao Elo 57 para turbinar seus resultados.</p>

      {/* O Modal Mágico (Fica invisível até que a URL tenha ?step=select_page) */}
      <MetaSetupWizard organizacaoId={organizacaoId} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <FacebookButton 
          isConnected={!!integracaoMeta?.status} 
          accountName={integracaoMeta?.nome_conta} 
        />
        <WhatsappButton 
          initialData={integracaoWhatsapp}
          organizacaoId={organizacaoId}
        />
      </div>

      <h2 className="text-2xl font-bold mb-6 text-gray-900">Ecossistema Google Workspace</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* 🟢 Botão do Google Agenda */}
        <GoogleCalendarButton
          isConnected={!!googleAgenda?.is_active}
          tipo="agenda"
          title="Google Agenda"
          description={!!googleAgenda?.is_active 
            ? 'Suas atividades do Elo 57 estão sendo enviadas automaticamente para o seu Google Agenda.'
            : 'Conecte sua conta para enviar automaticamente suas atividades para as agendas no seu celular.'}
        />

        {/* 🟢 Botão do Google Drive */}
        <GoogleCalendarButton
          isConnected={!!googleDrive?.is_active}
          tipo="drive"
          title="Google Drive (Cofre)"
          description={!!googleDrive?.is_active 
            ? 'Cofre conectado! O sistema fará backup de contratos e planilhas na nuvem.'
            : 'Conecte o Drive Corporativo para criar um cofre de backup automático e seguro.'}
        />

        {/* 🟢 Botão do Google Contacts */}
        <GoogleCalendarButton
          isConnected={!!googleContatos?.is_active}
          tipo="contatos"
          title="Google Contatos"
          description={!!googleContatos?.is_active 
            ? 'Seus leads estão sendo sincronizados com a agenda do seu celular automaticamente.'
            : 'Conecte para sincronizar os contatos e leads direto na agenda do seu celular.'}
        />

      </div>
    </div>
  );
}