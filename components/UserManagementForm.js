"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faTimes, faUserShield } from '@fortawesome/free-solid-svg-icons';

// --- Sub-componente para o Modal de Gestão de Funções ---
const RolesManagerModal = ({ isOpen, onClose, initialRoles, onRolesUpdate }) => {
    // ##### INÍCIO DA CORREÇÃO #####
    // Os hooks foram movidos para o topo da função, antes de qualquer retorno.
    const supabase = createClient();
    const [roles, setRoles] = useState(initialRoles);
    const [newRoleName, setNewRoleName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null; // A verificação agora acontece DEPOIS dos hooks.
    // ##### FIM DA CORREÇÃO #####

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        setLoading(true);
        setError('');

        const { data, error } = await supabase
            .from('funcoes')
            .insert({ nome_funcao: newRoleName })
            .select()
            .single();

        if (error) {
            setError(error.message);
        } else {
            const updatedRoles = [...roles, data];
            setRoles(updatedRoles);
            onRolesUpdate(updatedRoles);
            setNewRoleName('');
        }
        setLoading(false);
    };

    const handleDeleteRole = async (roleId) => {
        if (window.confirm("Atenção: Excluir esta função pode afetar os usuários associados a ela. Deseja continuar?")) {
            setLoading(true);
            setError('');
            const { error } = await supabase.from('funcoes').delete().eq('id', roleId);
            if (error) {
                setError(error.message);
            } else {
                const updatedRoles = roles.filter(r => r.id !== roleId);
                setRoles(updatedRoles);
                onRolesUpdate(updatedRoles);
            }
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Gerenciar Funções</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>

                {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="Nome da nova função"
                            className="flex-grow p-2 border rounded-md"
                        />
                        <button onClick={handleAddRole} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
                        </button>
                    </div>
                    <ul className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2">
                        {roles.map(role => (
                            <li key={role.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <span className="font-medium">{role.nome_funcao}</span>
                                {role.nome_funcao !== 'Proprietário' && (
                                    <button onClick={() => handleDeleteRole(role.id)} disabled={loading} className="text-red-500 hover:text-red-700">
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};


// --- Componente Principal ---
export default function UserManagementForm({ initialUsers, allEmployees, allRoles }) {
  const supabase = createClient();
  const [users, setUsers] = useState(initialUsers);
  const [roles, setRoles] = useState(allRoles);
  const [message, setMessage] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({});
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);

  const handleEditClick = (user) => {
    setEditingUserId(user.id);
    setFormData({
      ...user,
      funcionario_id: user.funcionario_id || '',
      funcao_id: user.funcao?.id || '',
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
    const updateData = { nome, sobrenome, email, funcionario_id: funcionario_id || null, is_active, funcao_id: funcao_id || null };

    const { error } = await supabase.from('usuarios').update(updateData).eq('id', id);

    if (error) {
      setMessage(`Erro ao salvar: ${error.message}`);
    } else {
      setMessage('Usuário salvo com sucesso!');
      setEditingUserId(null);
      setUsers(prevUsers => prevUsers.map(user =>
        user.id === id ? { 
          ...user, 
          ...updateData,
          funcionario: allEmployees.find(emp => emp.id == funcionario_id) || null,
          funcao: roles.find(role => role.id == funcao_id) || null,
        } : user
      ));
    }
  };

  return (
    <div className="space-y-6">
      <RolesManagerModal
        isOpen={isRolesModalOpen}
        onClose={() => setIsRolesModalOpen(false)}
        initialRoles={roles}
        onRolesUpdate={(updatedRoles) => setRoles(updatedRoles)}
      />

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Lista de Usuários Cadastrados</h2>
        <button
            onClick={() => setIsRolesModalOpen(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-700 flex items-center gap-2"
        >
            <FontAwesomeIcon icon={faUserShield} />
            Gerenciar Funções
        </button>
      </div>
      
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
                        {roles.map(role => (
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