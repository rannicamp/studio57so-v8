"use client";

import { useState, Fragment } from 'react';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';

export default function PermissionManager({ initialFuncoes }) {
  const supabase = createClient();
  const [funcoes, setFuncoes] = useState(initialFuncoes);

  // RECURSOS AGORA AGRUPADOS POR CATEGORIA
  const resourceGroups = [
    {
      title: 'Administrativo',
      resources: [
        { key: 'dashboard', name: 'Dashboard' },
        { key: 'financeiro', name: 'Financeiro' },
        { key: 'funcionarios', name: 'Funcionários' },
        { key: 'ponto', name: 'Controle de Ponto' },
        { key: 'empresas', name: 'Empresas' },
        { key: 'empreendimentos', name: 'Empreendimentos' },
        { key: 'contratos', name: 'Contratos' },
      ]
    },
    {
      title: 'Comercial',
      resources: [
        { key: 'caixa-de-entrada', name: 'Caixa de Entrada' },
        { key: 'crm', name: 'CRM' },
        { key: 'funil', name: 'Funil de Vendas' },
        { key: 'anuncios', name: 'Anúncios' },
        { key: 'contatos', name: 'Contatos' },
        { key: 'simulador', name: 'Simulador' },
      ]
    },
    {
      title: 'Obra',
      resources: [
        { key: 'orcamento', name: 'Orçamentação' },
        { key: 'pedidos', name: 'Pedidos de Compra' },
        { key: 'rdo', name: 'Diário de Obra (RDO)' },
        { key: 'atividades', name: 'Atividades' },
      ]
    },
    {
      title: 'Sistema',
      resources: [
        { key: 'usuarios', name: 'Usuários' },
        { key: 'permissoes', name: 'Permissões' },
      ]
    }
  ];

  const handlePermissionChange = (funcaoId, recursoKey, tipoPermissao, valor) => {
    const originalFuncoes = JSON.parse(JSON.stringify(funcoes));

    const updatedFuncoes = funcoes.map(funcao => {
      if (funcao.id === funcaoId) {
        let permissaoEncontrada = false;
        const novasPermissoes = funcao.permissoes.map(p => {
          if (p.recurso === recursoKey) {
            permissaoEncontrada = true;
            return { ...p, [tipoPermissao]: valor };
          }
          return p;
        });

        if (!permissaoEncontrada) {
          novasPermissoes.push({ funcao_id: funcaoId, recurso: recursoKey, [tipoPermissao]: valor });
        }
        return { ...funcao, permissoes: novasPermissoes };
      }
      return funcao;
    });
    setFuncoes(updatedFuncoes);

    const promise = async () => {
      const { error } = await supabase
        .from('permissoes')
        .upsert({
          funcao_id: funcaoId,
          recurso: recursoKey,
          [tipoPermissao]: valor
        }, {
          onConflict: 'funcao_id, recurso'
        });

      if (error) {
        setFuncoes(originalFuncoes);
        throw error;
      }
    };

    toast.promise(promise(), {
      loading: 'Salvando permissão...',
      success: 'Permissão atualizada com sucesso!',
      error: (err) => `Erro ao salvar: ${err.message}`,
    });
  };

  const getPermissao = (funcao, recursoKey, tipo) => {
    const permissao = funcao.permissoes.find(p => p.recurso === recursoKey);
    return permissao ? permissao[tipo] : false;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {/* LINHA DOS GRUPOS */}
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Função</th>
              {resourceGroups.map(group => (
                <th
                  key={group.title}
                  colSpan={group.resources.length * 4}
                  className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border-l"
                >
                  {group.title}
                </th>
              ))}
            </tr>
            {/* LINHA DOS RECURSOS */}
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10"></th>
              {resourceGroups.map(group => (
                <Fragment key={group.title}>
                  {group.resources.map(recurso => (
                    <th key={recurso.key} colSpan="4" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l">
                      {recurso.name}
                    </th>
                  ))}
                </Fragment>
              ))}
            </tr>
            {/* LINHA DAS PERMISSÕES */}
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10"></th>
              {resourceGroups.flatMap(group =>
                group.resources.map(recurso => (
                  <Fragment key={recurso.key}>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 border-l">Ver</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Criar</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Editar</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Excluir</th>
                  </Fragment>
                ))
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {funcoes.map(funcao => (
              <tr key={funcao.id}>
                <td className="px-6 py-4 whitespace-nowrap font-semibold text-sm text-gray-800 sticky left-0 bg-white z-10">
                  {funcao.nome_funcao}
                </td>
                {resourceGroups.flatMap(group =>
                  group.resources.map(recurso => (
                    <Fragment key={recurso.key}>
                      {['pode_ver', 'pode_criar', 'pode_editar', 'pode_excluir'].map(tipo => (
                        <td key={tipo} className="px-2 py-4 text-center border-l">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={getPermissao(funcao, recurso.key, tipo)}
                            onChange={(e) => handlePermissionChange(funcao.id, recurso.key, tipo, e.target.checked)}
                            disabled={funcao.nome_funcao === 'Proprietário'}
                          />
                        </td>
                      ))}
                    </Fragment>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Nota: As permissões para a função &apos;Proprietário&apos; não podem ser alteradas. Esta função sempre terá acesso total.
      </p>
    </div>
  );
}