import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const TipoToggleButton = ({ label, icon, isActive, onClick, colorClass = 'bg-blue-500 hover:bg-blue-600' }) => {
 const baseClasses = "flex-1 p-2 rounded-md font-semibold text-xs flex items-center justify-center gap-2 transition-colors";
 const activeClasses = `shadow text-white ${colorClass}`;
 const inactiveClasses = "bg-gray-200 text-gray-600 hover:bg-gray-300";
 return (
 <button type="button" onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
 <FontAwesomeIcon icon={icon} />
 <span className="hidden sm:inline">{label}</span>
 </button>
 );
};
