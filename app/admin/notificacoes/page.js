import GerenciadorNotificacoes from '@/components/notificacao/GerenciadorNotificacoes';

export const metadata = {
  title: 'Templates de Notificações | Admin Hub',
  description: 'Gerenciamento global de templates de alerta do sistema.',
};

export default function AdminNotificacoesPage() {
  return (
    <div className="h-full bg-gray-50/50">
        <GerenciadorNotificacoes />
    </div>
  );
}
