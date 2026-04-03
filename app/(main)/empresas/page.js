export const dynamic = 'force-dynamic';
// app/(main)/empresas/page.js
import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import EmpresaManager from '../../../components/empresas/EmpresaManager';

export const metadata = {
 title: 'Elo 57 | Gestão de Empresas',
};

export default async function GerenciamentoEmpresasPage() {
 const supabase = await createClient();

 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 redirect('/login');
 }

 const { data: userProfile } = await supabase
 .from('usuarios')
 .select('organizacao_id, funcao:funcoes ( nome_funcao )')
 .eq('id', user.id)
 .single();

 const organizacaoId = userProfile?.organizacao_id;
 const userRole = userProfile?.funcao?.nome_funcao;

 // Apenas 'Proprietário' e 'Administrador' podem ver esta página
 if (!['Proprietário', 'Administrador'].includes(userRole)) {
 redirect('/');
 }

 if (!organizacaoId) {
 return <p className="p-4 text-red-500 text-center font-bold">Erro: Organização do usuário não encontrada.</p>;
 }

 // Busca todas as empresas já na renderização do servidor para entregar hidratado ao Client Component
 const { data: companies, error } = await supabase
 .from('cadastro_empresa')
 .select('*')
 .eq('organizacao_id', organizacaoId)
 .order('razao_social');

 if (error) {
 console.error('Erro ao buscar empresas:', error.message);
 return <p className="p-4 text-red-500 text-center">Não foi possível carregar o diretório de empresas no momento.</p>;
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <EmpresaManager initialEmpresas={companies || []} />
 </div>
 );
}