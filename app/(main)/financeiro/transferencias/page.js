import TransferenciaFinder from '../../../../components/financeiro/TransferenciaFinder';
import Link from 'next/link';

export default function TransferenciasPage() {
  return (
    <div className="space-y-6">
      <Link href="/financeiro" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para o Painel Financeiro
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 uppercase">Identificador de Possíveis Transferências</h1>
      <p className="text-gray-600">
        Esta ferramenta analisa seus lançamentos para encontrar possíveis transferências entre contas que não foram categorizadas como tal.
        Ela agrupa lançamentos com o <strong>mesmo valor</strong> feitos no <strong>mesmo dia</strong> em <strong>contas diferentes</strong>.
      </p>
      <div className="bg-white rounded-lg shadow p-6">
        <TransferenciaFinder />
      </div>
    </div>
  );
}