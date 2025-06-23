import EmpresaForm from '../../../components/EmpresaForm'; // Importa nosso novo formulário
import Link from 'next/link';

// Esta página não precisa buscar dados, então pode ser mais simples
export default function CadastroEmpresaPage() {
  return (
    <div>
        <Link href="/" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para o Dashboard
        </Link>
        {/* Renderiza o formulário */}
        <EmpresaForm />
    </div>
  );
}