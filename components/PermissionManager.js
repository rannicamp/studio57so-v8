"use client";

import { useState, Fragment } from 'react';
import { createClient } from '../utils/supabase/client';

export default function PermissionManager({ initialFuncoes }) {
  const supabase = createClient();
  const [funcoes, setFuncoes] = useState(initialFuncoes);
  const [message, setMessage] = useState('');

  const recursos = [
    { key: 'empresas', name: 'Empresas' },
    { key: 'empreendimentos', name: 'Empreendimentos' },
    { key: 'funcionarios', name: 'Funcionários' },
    { key: 'atividades', name: 'Atividades' },
    { key: 'rdo', name: 'Diário de Obra (RDO)' },
    { key: 'usuarios', name: 'Usuários' },
    { key: 'permissoes', name: 'Permissões' },
  ];

  const handlePermissionChange = async (funcaoId, recursoKey, tipoPermissao, valor) => {
    setMessage('Salvando...');

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
      setMessage(`Erro ao salvar: ${error.message}`);
      console.error(error);
    } else {
      setMessage('Permissão atualizada com sucesso!');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const getPermissao = (funcao, recursoKey, tipo) => {
    const permissao = funcao.permissoes.find(p => p.recurso === recursoKey);
    return permissao ? permissao[tipo] : false;
  };

  return (
    <div className="space-y-4">
      {message && <p className="text-center font-medium text-sm">{message}</p>}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Função</th>
              {recursos.map(recurso => (
                <th key={recurso.key} colSpan="4" className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border-l">
                  {recurso.name}
                </th>
              ))}
            </tr>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10"></th>
              {recursos.map(recurso => (
                <Fragment key={recurso.key}>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 border-l">Ver</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Criar</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Editar</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500">Excluir</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {funcoes.map(funcao => (
              <tr key={funcao.id}>
                <td className="px-6 py-4 whitespace-nowrap font-semibold text-sm text-gray-800 sticky left-0 bg-white">
                  {funcao.nome_funcao}
                </td>
                {recursos.map(recurso => (
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
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
       <p className="text-xs text-gray-500 mt-2">
        {/* CORREÇÃO AQUI */}
        Nota: As permissões para a função &apos;Proprietário&apos; não podem ser alteradas. Esta função sempre terá acesso total.
      </p>
    </div>
  );
}