//app\(main)\financeiro\auditoria\page.js
import AuditoriaFinanceira from '../../../../components/financeiro/AuditoriaFinanceira';
import Link from 'next/link';

export default function AuditoriaPage() {
  return (
    <div className="space-y-6">
      <Link href="/financeiro" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para o Painel Financeiro
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 uppercase">Painel de Auditoria Financeira</h1>
      <p className="text-gray-600">
        Utilize esta ferramenta para encontrar e corrigir inconsistências nos seus dados financeiros.
      </p>
      <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
        <AuditoriaFinanceira />
      </div>
    </div>
  );
}