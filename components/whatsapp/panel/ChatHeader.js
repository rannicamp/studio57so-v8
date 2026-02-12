import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faUserCircle, faSearch, faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';

export default function ChatHeader({ contact, recipientPhone, onBack }) {
    return (
        <div className="bg-[#f0f2f5] px-4 py-2 border-b border-gray-300 flex items-center justify-between shadow-sm z-10 sticky top-0 h-16">
            <div className="flex items-center gap-3 w-full">
                {onBack && (
                    <button onClick={onBack} className="md:hidden text-[#54656f] p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors">
                        <FontAwesomeIcon icon={faArrowLeft} className="text-xl" />
                    </button>
                )}
                <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer">
                     <FontAwesomeIcon icon={faUserCircle} className="text-white text-3xl"/>
                </div>
                <div className="flex flex-col justify-center flex-grow overflow-hidden">
                    <h3 className="font-medium text-[#111b21] leading-tight truncate text-base">{contact.nome}</h3>
                    <p className="text-[13px] text-[#667781] truncate">{recipientPhone || "Toque para dados do contato"}</p>
                </div>
                <div className="flex items-center gap-4 text-[#54656f]">
                    <button className="hidden sm:block p-2 rounded-full hover:bg-black/5"><FontAwesomeIcon icon={faSearch} /></button>
                    <button className="p-2 rounded-full hover:bg-black/5"><FontAwesomeIcon icon={faEllipsisVertical} /></button>
                </div>
            </div>
        </div>
    );
}