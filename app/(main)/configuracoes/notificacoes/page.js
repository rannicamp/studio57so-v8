import ConfiguracaoNotificacoes from '@/components/notificacao/ConfiguracaoNotificacoes';

export const metadata = {
  title: 'Configurações de Alertas | Studio 57',
  description: 'Ajuste os alertas da sua franquia e ative as notificações Push no seu aparelho.',
};

export default function NotificacoesPage() {
  return (
    <div className="h-full bg-gray-50/50">
        <ConfiguracaoNotificacoes />
    </div>
  );
}