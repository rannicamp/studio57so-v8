// components/whatsapp/ContactProfile.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faUserCircle } from '@fortawesome/free-solid-svg-icons'

export default function ContactProfile({ contact, onClose }) {
  if (!contact) return null;

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-lg font-bold">Perfil do Contato</h2>
      </div>
      <div className="flex flex-col items-center mt-6">
        <FontAwesomeIcon icon={faUserCircle} size="8x" className="text-gray-300" />
        <h3 className="text-xl font-semibold mt-4">{contact.nome}</h3>
      </div>
    </div>
  )
}