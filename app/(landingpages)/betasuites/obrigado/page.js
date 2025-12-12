// Caminho: app/(landingpages)/studiosbeta/obrigado/page.js
import Link from 'next/link';

export default function ObrigadoPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white text-center p-4">
      <h1 className="text-4xl font-bold text-amber-400">Obrigado!</h1>
      <p className="mt-4 text-lg">
        Seu interesse no Studios Beta foi registrado com sucesso.
      </p>
      <p className="mt-2 text-gray-300">
        Entraremos em contato em breve com mais informações exclusivas sobre o lançamento.
      </p>
      <Link href="/studiosbeta" className="mt-8 bg-amber-500 text-gray-900 font-bold py-2 px-6 rounded-full hover:bg-amber-600 transition-colors">
          Voltar para a página
      </Link>
    </div>
  );
}