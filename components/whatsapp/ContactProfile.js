// components/whatsapp/ContactProfile.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCircle } from '@fortawesome/free-solid-svg-icons';

export default function ContactProfile({ contact }) {
    // A verificação de contato agora é feita na página principal
    if (!contact) {
        return null; // Não renderiza nada se não houver contato
    }

    return (
        // O componente agora é apenas a área de rolagem do perfil.
        <div className="h-full overflow-y-auto p-4">
            <div className="flex flex-col items-center mt-6">
                <FontAwesomeIcon icon={faUserCircle} size="8x" className="text-gray-300" />
                <h3 className="text-xl font-semibold mt-4">{contact.nome}</h3>
                {/* Mais informações do contato podem ser adicionadas aqui no futuro */}
            </div>
        </div>
    );
}