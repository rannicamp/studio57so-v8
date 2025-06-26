import EmpresaForm from '../../../../components/EmpresaForm';
import Link from 'next/link';

// A página agora usa o componente correto: EmpresaForm
export default function CadastroEmpresaPage() {
  return (
    <div className="space-y-6">
       <Link href="/empresas" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Empresas
        </Link>
      <h1 className="text-3xl font-bold text-gray-900">Cadastro de Nova Empresa</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        {/* Usando o formulário correto para cadastrar empresas */}
        <EmpresaForm />
      </div>
    </div>
  );
}