// O caminho para o globals.css foi corrigido de './' para '../'
import '../globals.css'; 
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';

// Este é o layout para a parte principal da aplicação (área logada).
export default function MainAppLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />

      <div className="flex-1">
        <Header />

        <main className="ml-[260px] mt-[65px] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}