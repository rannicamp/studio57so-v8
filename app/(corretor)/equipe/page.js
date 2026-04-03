// app/(corretor)/equipe/page.js
'use client'

import { useState, useEffect } from 'react'
import { useLayout } from '@/contexts/LayoutContext'
import { createClient } from '@/utils/supabase/client'
import { Toaster, toast } from 'sonner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUsers, faBan, faCheckCircle, faLink, faEnvelope, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { toggleCorretorStatus } from './actions'

export default function GestaoEquipePage() {
 const { user, isUserLoading } = useLayout()
 const supabase = createClient()
 const [corretores, setCorretores] = useState([])
 const [isLoading, setIsLoading] = useState(true)

 // Verifica se o usuário tem permissão (Gerente de Corretagem ID 21)
 const isGerente = user?.funcao_id === 21;

 useEffect(() => {
 if (isUserLoading || !user) return;
 if (!isGerente) {
 setIsLoading(false);
 return;
 }

 async function fetchEquipe() {
 setIsLoading(true);
 try {
 const { data, error } = await supabase
 .from('usuarios')
 .select('id, nome, sobrenome, email, is_active, created_at, contatos!contatos_criado_por_usuario_id_fkey(cpf, creci)')
 .eq('organizacao_id', user.organizacao_id)
 .eq('funcao_id', 20) // 20 = Corretor
 .order('nome');

 if (error) throw error;
 setCorretores(data || []);
 } catch (err) {
 toast.error('Erro ao buscar equipe: ' + err.message);
 } finally {
 setIsLoading(false);
 }
 }

 fetchEquipe();
 }, [user, isUserLoading, isGerente, supabase]);

 const handleCopyLink = () => {
 if (!user?.organizacao_id) return;
 const link = `${window.location.origin}/cadastro-corretor?org=${user.organizacao_id}`;
 navigator.clipboard.writeText(link);
 toast.success('Link de convite copiado para a área de transferência!');
 };

 const handleToggleStatus = async (corretorId, currentStatus) => {
 if (!confirm(`Deseja realmente ${currentStatus ? 'INATIVAR' : 'REATIVAR'} este corretor?`)) return;
 // Optimistic update
 setCorretores(corretores.map(c => c.id === corretorId ? { ...c, is_active: !currentStatus } : c));
 toast.info('Atualizando status...');

 const result = await toggleCorretorStatus(corretorId, !currentStatus);
 if (result.success) {
 toast.success('Status atualizado com sucesso!');
 } else {
 toast.error('Gafes técnicas! Revertendo alteração...');
 // Revert if failed
 setCorretores(corretores.map(c => c.id === corretorId ? { ...c, is_active: currentStatus } : c));
 }
 };

 if (isUserLoading || isLoading) {
 return <div className="flex justify-center items-center h-64"><FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500" /></div>;
 }

 if (!isGerente) {
 return (
 <div className="flex flex-col items-center justify-center h-64 text-center">
 <FontAwesomeIcon icon={faBan} className="text-6xl text-red-500 mb-4" />
 <h2 className="text-2xl font-bold text-gray-800">Acesso Negado</h2>
 <p className="text-gray-600 mt-2">Esta tela é exclusiva para Gerentes de Corretagem.</p>
 </div>
 );
 }

 return (
 <div className="max-w-7xl mx-auto space-y-6">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
 <div>
 <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
 <FontAwesomeIcon icon={faUsers} className="text-blue-600" /> Minha Equipe de Corretores
 </h1>
 <p className="text-gray-500 mt-1">Gerencie os acessos e convide novos parceiros para a base.</p>
 </div>
 <button onClick={handleCopyLink}
 className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
 >
 <FontAwesomeIcon icon={faLink} /> Copiar Link de Convite
 </button>
 </div>

 <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-gray-200">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corretor</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato / CRECI</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {corretores.length === 0 ? (
 <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-500">Nenhum corretor encontrado na sua organização.</td></tr>
 ) : (
 corretores.map((corretor) => (
 <tr key={corretor.id} className={!corretor.is_active ? 'bg-red-50' : 'hover:bg-gray-50'}>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center">
 <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
 {corretor.nome.charAt(0).toUpperCase()}
 </div>
 <div className="ml-4">
 <div className="text-sm font-medium text-gray-900">{corretor.nome} {corretor.sobrenome}</div>
 <div className="text-sm text-gray-500">{corretor.email}</div>
 </div>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
 <div>CPF: {corretor.contatos?.[0]?.cpf || 'Não informado'}</div>
 <div className="text-xs text-gray-400 mt-0.5">CRECI: {corretor.contatos?.[0]?.creci || 'Não informado'}</div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${corretor.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
 {corretor.is_active ? 'Ativo' : 'Inativo'}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
 <div className="flex items-center justify-end gap-3">
 {/* Botão de WhatsApp Fantasma para futura integração */}
 <button className="text-gray-400 hover:text-green-600 transition-colors"
 title="Em breve: Enviar mensagem WhatsApp"
 onClick={() => toast.info('Integração de WhatsApp do Gestor em desenvolvimento.')}
 >
 <FontAwesomeIcon icon={faEnvelope} className="text-lg" />
 </button>

 <button
 onClick={() => handleToggleStatus(corretor.id, corretor.is_active)}
 className={`${corretor.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
 title={corretor.is_active ? 'Inativar Usuário' : 'Reativar Usuário'}
 >
 <FontAwesomeIcon icon={corretor.is_active ? faBan : faCheckCircle} className="text-lg" />
 </button>
 </div>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )
}
