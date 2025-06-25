import EmpresaForm from '../../../../components/EmpresaForm';

// A página agora fica mais limpa, apenas com o título principal e o formulário.
export default function CadastroEmpresaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Cadastro de Nova Empresa</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <EmpresaForm />
      </div>
    </div>
  );
}