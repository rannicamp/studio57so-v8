// Caminho do arquivo: app/(landingpages)/refugiobraunas/obrigado/page.js
import Link from 'next/link';

export default function PaginaObrigado() {
  const primaryColor = '#2c5234';

  return (
    <div className="h-screen bg-gray-800 flex flex-col items-center justify-center text-white text-center p-4">
      <h1 className="text-5xl font-bold mb-4">Obrigado!</h1>
      <p className="text-xl max-w-2xl mb-8">
        Recebemos suas informações com sucesso. Em breve, um de nossos especialistas entrará em contato com você.
      </p>
      <Link href="/refugiobraunas">
        <div 
            className="text-white py-3 px-8 rounded-md font-bold text-lg hover:opacity-90 transition-colors cursor-pointer"
            style={{ backgroundColor: primaryColor }}
        >
          Voltar para a página
        </div>
      </Link>
    </div>
  );
}