import Link from 'next/link';

export default function SobrePage() {
  return (
    <main style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>
      <h1>Página Sobre</h1>
      <p>Esta é a segunda página do nosso minisistema.</p>
      <Link href="/" style={{ color: 'blue' }}>
        Voltar para a página inicial
      </Link>
    </main>
  );
}
