'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faSpinner, faUserCircle, faInbox } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import EmailEditor from './EmailEditor';

export default function EmailSignatureConfig({ onClose }) {
  const supabase = createClient();
  const { user, organizacao_id } = useAuth();
  const queryClient = useQueryClient();

  // Buscar contas do usuário
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['emailAccounts', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).order('created_at');
      return data || [];
    },
    enabled: !!user
  });

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [settings, setSettings] = useState({
    usar_novos: true,
    usar_respostas: true,
    incluir_foto: true
  });

  // Ao carregar contas, seleciona a primeira por padrão
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Ao mudar de conta selecionada, carrega a assinatura dela
  useEffect(() => {
    if (accounts && selectedAccountId) {
      const acc = accounts.find(a => a.id.toString() === selectedAccountId.toString());
      if (acc) {
        setSignatureHtml(acc.assinatura_texto || '');
        setSettings({
          usar_novos: acc.assinatura_usar_novos ?? true,
          usar_respostas: acc.assinatura_usar_respostas ?? true,
          incluir_foto: acc.assinatura_incluir_foto ?? true
        });
      }
    }
  }, [accounts, selectedAccountId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) {
        throw new Error("Nenhuma conta selecionada.");
      }
      const payload = {
        assinatura_texto: signatureHtml,
        assinatura_usar_novos: settings.usar_novos,
        assinatura_usar_respostas: settings.usar_respostas,
        assinatura_incluir_foto: settings.incluir_foto
      };
      
      const { error } = await supabase.from('email_configuracoes')
        .update(payload)
        .eq('id', selectedAccountId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura salva com sucesso para a conta!");
      queryClient.invalidateQueries(['emailConfig', 'emailAccounts']);
      // Não fechamos o modal para ele poder conferir, apenas notificamos
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

  const userPhoto = user?.user_metadata?.avatar_url;

  if (accountsLoading) {
    return <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-3xl" /></div>;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
        <FontAwesomeIcon icon={faInbox} className="text-4xl mb-4 text-gray-300" />
        <h3 className="text-lg font-bold text-gray-700">Nenhuma conta conectada</h3>
        <p className="text-sm mt-2 max-w-md">Você precisa conectar pelo menos uma conta de e-mail na aba "Conexão" antes de configurar uma assinatura.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      {/* Seletor de Conta */}
      <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex items-center gap-4">
        <label className="text-sm font-bold text-blue-900 whitespace-nowrap">Configurar assinatura para:</label>
        <select 
          className="flex-1 max-w-md p-2 rounded border border-blue-200 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        >
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.conta_apelido || acc.nome_remetente || 'Conta'} ({acc.email})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Lado Esquerdo: Editor */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Texto da Assinatura</label>
            <div className="border rounded-lg overflow-hidden h-64 bg-white">
              <EmailEditor
                value={signatureHtml}
                onChange={setSignatureHtml}
                placeholder="Ex: Atenciosamente, {{nome}} - {{cargo}}"
              />
            </div>
            {/* Dica de Variáveis Dinâmicas */}
            <div className="mt-2 bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-3 items-start">
              <div className="mt-0.5 text-blue-500 text-lg">🪄</div>
              <div>
                <h4 className="text-xs font-bold text-blue-800 mb-1">Assinaturas Inteligentes</h4>
                <p className="text-[11px] text-blue-700 leading-tight mb-2">
                  Você pode usar <strong>Variáveis</strong> para criar uma assinatura padrão para toda a equipe.
                  Quando alguém for enviar o e-mail, o sistema substituirá automaticamente:
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200 text-[10px] font-mono text-blue-900">{"{{nome}}"}</span>
                  <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200 text-[10px] font-mono text-blue-900">{"{{cargo}}"}</span>
                  <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200 text-[10px] font-mono text-blue-900">{"{{departamento}}"}</span>
                  <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200 text-[10px] font-mono text-blue-900">{"{{telefone}}"}</span>
                  <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200 text-[10px] font-mono text-blue-900">{"{{email}}"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase">Configurações desta conta</p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.usar_novos} onChange={e => setSettings({ ...settings, usar_novos: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700">Inserir em novos e-mails</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.usar_respostas} onChange={e => setSettings({ ...settings, usar_respostas: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700">Inserir em respostas/encaminhamentos</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.incluir_foto} onChange={e => setSettings({ ...settings, incluir_foto: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700">Incluir minha foto de perfil</span>
            </label>
          </div>
        </div>

        {/* Lado Direito: Preview */}
        <div className="border-l pl-6 border-gray-100 flex flex-col h-full">
          <p className="text-xs font-bold text-gray-500 uppercase mb-4">Pré-visualização</p>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex-grow overflow-y-auto">
            <p className="text-gray-400 text-xs italic mb-4">--- Fim da mensagem ---</p>

            <div className="flex items-start gap-4">
              {settings.incluir_foto && (
                <div className="shrink-0">
                  {userPhoto ? (
                    <img src={userPhoto} alt="Perfil" className="w-16 h-16 rounded-full object-cover border border-gray-100" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <FontAwesomeIcon icon={faUserCircle} className="text-3xl" />
                    </div>
                  )}
                </div>
              )}

              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: signatureHtml || '<p>Seu Nome<br>Seu Cargo</p>' }} />
            </div>
          </div>

          <div className="mt-6 flex justify-end shrink-0">
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !selectedAccountId} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
              {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
              Salvar Assinatura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}