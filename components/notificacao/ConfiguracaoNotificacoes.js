"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMoneyBill, 
  faHardHat, 
  faBullhorn, 
  faCog, 
  faSave, 
  faSpinner, 
  faBell 
} from '@fortawesome/free-solid-svg-icons';

export default function ConfiguracaoNotificacoes({ userId }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estado inicial padrão (tudo ativado por padrão)
  const [prefs, setPrefs] = useState({
    financeiro: true,
    comercial: true,
    operacional: true,
    sistema: true
  });

  // 1. Carrega as preferências do banco ao abrir
  useEffect(() => {
    async function loadPrefs() {
      if (!userId) return;
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('preferencias_notificacao')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Erro ao carregar prefs:", error);
      } else if (data?.preferencias_notificacao) {
        // Mescla com o padrão para garantir que chaves novas não quebrem o código
        setPrefs(prev => ({ ...prev, ...data.preferencias_notificacao }));
      }
      setLoading(false);
    }
    loadPrefs();
  }, [userId]);

  // 2. Salva no banco
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ preferencias_notificacao: prefs })
        .eq('id', userId);

      if (error) throw error;
      toast.success("Preferências atualizadas com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar preferências.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex justify-center py-10">
        <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400 text-2xl" />
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faBell} className="text-blue-600" />
        Canais de Notificação
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Escolha quais tipos de alerta você deseja receber no sininho e no celular.
        <br/><span className="text-xs text-gray-400">* Nota: Alguns avisos críticos de sistema não podem ser desativados.</span>
      </p>

      <div className="space-y-4">
        {/* FINANCEIRO */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600 w-10 h-10 flex items-center justify-center">
              <FontAwesomeIcon icon={faMoneyBill} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Financeiro</p>
              <p className="text-xs text-gray-500">Contas a pagar, recebimentos, fluxo de caixa.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={prefs.financeiro} onChange={() => toggle('financeiro')} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* COMERCIAL */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600 w-10 h-10 flex items-center justify-center">
              <FontAwesomeIcon icon={faBullhorn} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Comercial</p>
              <p className="text-xs text-gray-500">Novos leads, vendas, metas batidas.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={prefs.comercial} onChange={() => toggle('comercial')} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* OPERACIONAL */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-full text-orange-600 w-10 h-10 flex items-center justify-center">
              <FontAwesomeIcon icon={faHardHat} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Obras & Operacional</p>
              <p className="text-xs text-gray-500">Pedidos de compra, diário de obra, estoque.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={prefs.operacional} onChange={() => toggle('operacional')} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* SISTEMA */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-gray-200 p-3 rounded-full text-gray-600 w-10 h-10 flex items-center justify-center">
              <FontAwesomeIcon icon={faCog} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Sistema</p>
              <p className="text-xs text-gray-500">Atualizações, segurança, backups.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={prefs.sistema} onChange={() => toggle('sistema')} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
          {saving ? 'Salvando...' : 'Salvar Preferências'}
        </button>
      </div>
    </div>
  );
}