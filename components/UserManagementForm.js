"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';

export default function UserManagementForm({ initialUsers, allEmployees, allRoles }) {
  const supabase = createClient();
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({});

  const handleEditClick = (user) => {
    setEditingUserId(user.id);
    setFormData({
      ...user,
      funcionario_id: user.funcionario_id || '',
      funcao_id: user.funcao?.id || '', // Carrega o ID da função atual
      is_active: user.is_active,
    });
    setMessage('');
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFormData({});
    setMessage('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (value === '' ? null : value)
    }));
  };

  const handleSaveUser = async () => {
    setMessage('Salvando...');
    
    const { id, nome, sobrenome, email, funcionario_id, is_active, funcao_id } = formData;

    // Campos que serão atualizados na tabela 'usuarios'
    const updateData = {
      nome,
      sobrenome,
      email, 
      funcionario_id: funcionario_id || null, 
      is_active,
      funcao_id: funcao_id || null, // Salva o ID da função em vez de 'is_admin'
    };

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id);

    if (error) {
      setMessage(`Erro ao salvar: ${error.message}`);
      console.error('Erro ao salvar usuário:', error);
    } else {
      setMessage('Usuário salvo com sucesso!');
      setEditingUserId(null); // Sai do modo de edição

      // Atualiza o estado local para refletir a mudança na tela imediatamente
      setUsers(prevUsers => prevUsers.map(user =>
        user.id === id ? { 
          ...user, 
          ...updateData,
          funcionario: allEmployees.find(emp => emp.id == funcionario_id) || null,
          funcao: allRoles.find(role => role.id == funcao_id) || null,
        } : user
      ));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Lista de Usuários Cadastrados</h2>
      
      {message && (
        <div className={`p-3 rounded-md text-sm ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionário Associado</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Função</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                {editingUserId === user.id ? (
                  // --- MODO DE EDIÇÃO ---
                  <>
                    <td className="px-6 py-4 whitespace-nowrap"><input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm"/></td>
                    <td className="px-6 py-4 whitespace-nowrap"><input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm"/></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select name="funcionario_id" value={formData.funcionario_id || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm">
                        <option value="">Nenhum</option>
                        {allEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select name="funcao_id" value={formData.funcao_id || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm">
                        <option value="">Nenhuma</option>
                        {allRoles.map(role => (
                          <option key={role.id} value={role.id}>{role.nome_funcao}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input type="checkbox" name="is_active" checked={formData.is_active || false} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={handleSaveUser} className="text-green-600 hover:text-green-900 mr-4">Salvar</button>
                      <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900">Cancelar</button>
                    </td>
                  </>
                ) : (
                  // --- MODO DE VISUALIZAÇÃO ---
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.nome} {user.sobrenome}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.funcionario?.full_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.funcao?.nome_funcao || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{user.is_active ? 'Sim' : 'Não'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-900">Editar</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}