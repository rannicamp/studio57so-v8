//app\(main)\financeiro\categorias\page.js
import CategoriasManager from "../../../../components/financeiro/CategoriasManager";
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default function CategoriasPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href="/financeiro" className="text-gray-400 hover:text-blue-500" title="Voltar para Financeiro">
                        <FontAwesomeIcon icon={faArrowLeft} size="lg" />
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 uppercase">
                        Plano de Contas (Categorias)
                    </h1>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-sm text-gray-600 mb-6">
                    Organize suas finanças criando um plano de contas claro. Aqui você pode adicionar, editar e remover categorias e subcategorias para classificar todas as suas receitas e despesas.
                </p>
                <CategoriasManager />
            </div>
        </div>
    );
}