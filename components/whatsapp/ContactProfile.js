// components/whatsapp/ContactProfile.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUserCircle } from '@fortawesome/free-solid-svg-icons';

export default function ContactProfile({ contact, onClose }) {
    if (!contact) return (
        <div className="flex items-center justify-center h-full text-gray-500">
            <p>Selecione uma conversa para ver os detalhes do contato.</p>
        </div>
    );

    // ##### ESTRUTURA DE ROLAGEM INDEPENDENTE #####
    return (
        <div className="flex flex-col h-full">
            {/* Cabeçalho Fixo */}
            <div className="p-4 border-b flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold">Perfil do Contato</h2>
                </div>
            </div>
            
            {/* Área de Rolagem */}
            <div className="flex-grow overflow-y-auto p-4">
                <div className="flex flex-col items-center mt-6">
                    <FontAwesomeIcon icon={faUserCircle} size="8x" className="text-gray-300" />
                    <h3 className="text-xl font-semibold mt-4">{contact.nome}</h3>
                    {/* Mais informações do contato podem ser adicionadas aqui no futuro */}
                </div>
            </div>
        </div>
    );
}