"use client";

import { useState, Fragment, useEffect, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';

export default function PermissionManager({ initialFuncoes }) {
  const supabase = createClient();
  const [funcoes, setFuncoes] = useState(initialFuncoes);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetState, setDragTargetState] = useState(false);
  const pendingChanges = useRef([]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        savePendingChanges();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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
    },
    // --- NOVO GRUPO DE CONFIGURAÇÕES ADICIONADO AQUI ---
    {
      title: 'Configurações',
      resources: [
        { key: 'config_view_usuarios', name: 'Acesso: Gestão de Usuários' },
        { key: 'config_view_permissoes', name: 'Acesso: Permissões de Acesso' },
        { key: 'config_view_jornadas', name: 'Acesso: Jornadas de Trabalho' },
        { key: 'config_view_tipos_documento', name: 'Acesso: Tipos de Documento' },
        { key: 'config_view_integracoes', name: 'Acesso: Integrações' },
        { key: 'config_view_materiais', name: 'Acesso: Base de Materiais' },
        { key: 'config_view_treinamento_ia', name: 'Acesso: Treinamento da IA' },
      ]
    }
  ];

  const updateLocalPermission = (funcaoId, recursoKey, tipoPermissao, valor) => {
    setFuncoes(currentFuncoes =>
      currentFuncoes.map(funcao => {
        if (funcao.id === funcaoId) {
          const newPermissoes = [...funcao.permissoes];
          const permissaoIndex = newPermissoes.findIndex(p => p.recurso === recursoKey);

          if (permissaoIndex > -1) {
            newPermissoes[permissaoIndex] = { ...newPermissoes[permissaoIndex], [tipoPermissao]: valor };
          } else {
            newPermissoes.push({ funcao_id: funcaoId, recurso: recursoKey, [tipoPermissao]: valor });
          }
          return { ...funcao, permissoes: newPermissoes };
        }
        return funcao;
      })
    );
    
    const change = { funcao_id: funcaoId, recurso: recursoKey, [tipoPermissao]: valor };
    const existingChangeIndex = pendingChanges.current.findIndex(c => c.funcao_id === funcaoId && c.recurso === recursoKey);
    if(existingChangeIndex > -1) {
        pendingChanges.current[existingChangeIndex] = { ...pendingChanges.current[existingChangeIndex], ...change };
    } else {
        pendingChanges.current.push(change);
    }
  };

  const handleMouseDown = (funcaoId, recursoKey, tipoPermissao, currentValue) => {
    setIsDragging(true);
    const targetValue = !currentValue;
    setDragTargetState(targetValue);
    updateLocalPermission(funcaoId, recursoKey, tipoPermissao, targetValue);
  };

  const handleMouseEnter = (funcaoId, recursoKey, tipoPermissao) => {
    if (isDragging) {
      updateLocalPermission(funcaoId, recursoKey, tipoPermissao, dragTargetState);
    }
  };

  const savePendingChanges = () => {
    if (pendingChanges.current.length === 0) return;

    const promise = async () => {
      const { error } = await supabase
        .from('permissoes')
        .upsert(pendingChanges.current, { onConflict: 'funcao_id, recurso' });
      
      pendingChanges.current = [];
      
      if (error) {
        throw error;
      }
    };

    toast.promise(promise(), {
      loading: `Salvando ${pendingChanges.current.length} permissões...`,
      success: 'Permissões atualizadas com sucesso!',
      error: (err) => `Erro ao salvar: ${err.message}`,
    });
  };

  const getPermissao = (funcao, recursoKey, tipo) => {
    const permissao = funcao.permissoes.find(p => p.recurso === recursoKey);
    return permissao ? !!permissao[tipo] : false;
  };

  return (
    <div className="space-y-4 select-none">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-20">Função</th>
              {resourceGroups.map(group => (
                <th key={group.title} colSpan={group.resources.length * 4} className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border-l-2 border-gray-300">{group.title}</th>
              ))}
            </tr>
            <tr>
              <th className="px-6 py-3 sticky left-0 bg-gray-50 z-20"></th>
              {resourceGroups.flatMap(group =>
                group.resources.map(recurso => (
                  <th key={recurso.key} colSpan="4" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-gray-300">
                    {recurso.name}
                  </th>
                ))
              )}
            </tr>
            <tr>
              <th className="px-6 py-3 sticky left-0 bg-gray-50 z-20"></th>
              {resourceGroups.flatMap(group =>
                group.resources.map(recurso => (
                  <Fragment key={recurso.key}>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 border-l-2 border-gray-300">Ver</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 border-l">Criar</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 border-l">Editar</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 border-l">Excluir</th>
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
                      {['pode_ver', 'pode_criar', 'pode_editar', 'pode_excluir'].map((tipo, tipoIndex) => {
                        const isChecked = getPermissao(funcao, recurso.key, tipo);
                        const borderClass = tipoIndex === 0 ? 'border-l-2 border-gray-300' : 'border-l';
                        return (
                          <td
                            key={tipo}
                            className={`px-2 py-4 text-center cursor-pointer ${borderClass}`}
                            onMouseDown={() => handleMouseDown(funcao.id, recurso.key, tipo, isChecked)}
                            onMouseEnter={() => handleMouseEnter(funcao.id, recurso.key, tipo)}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded pointer-events-none"
                              readOnly
                              checked={isChecked}
                              disabled={funcao.nome_funcao === 'Proprietário'}
                            />
                          </td>
                        );
                      })}
                    </Fragment>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Nota: As permissões para a função &apos;Proprietário&apos; não podem ser alteradas. Clique e arraste para alterar múltiplas permissões.
      </p>
    </div>
  );
}