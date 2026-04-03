// components/shared/KpiCard.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function KpiCard({ title, value, icon, tooltip }) {
 return (
 <div
 className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between gap-3 transition-all hover:shadow-md hover:border-blue-200 group"
 title={tooltip || ''}
 >
 <div className="flex items-center justify-between">
 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate pr-2">
 {title}
 </p>
 <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
 <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />
 </div>
 </div>
 <p className="text-lg font-bold text-gray-800 leading-tight break-words">
 {value}
 </p>
 </div>
 );
}