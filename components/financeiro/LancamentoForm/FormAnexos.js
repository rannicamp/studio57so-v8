import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faEye, faTrashAlt, faUpload, faPaperclip } from '@fortawesome/free-solid-svg-icons';

export default function FormAnexos({
 formData,
 dropdownData,
 handleAnexoChange,
 handleRemoveAnexoPreexistente,
 handleRemoveNewAnexo,
 handleNewAnexoDataChange,
 handleViewAnexo,
 isDragging,
 handleDragEvents,
 handleDrop
}) {
 return (
 <div className="pt-4 border-t mt-4">
 <label className="block text-sm font-medium mb-2">Anexos</label>
 {formData.anexos_preexistentes.length > 0 && (
 <div className="space-y-2 mb-4">
 <p className="text-xs font-semibold text-gray-600">Salvos:</p>
 {formData.anexos_preexistentes.map((anexo, index) => (
 <div key={anexo.id} className="p-2 border rounded-md bg-gray-50 flex items-center justify-between text-sm">
 <div className="flex items-center gap-2"><FontAwesomeIcon icon={faFileLines} className="text-gray-600" /><span>{anexo.nome_arquivo}</span></div>
 <div className="flex items-center gap-4">
 <button type="button" onClick={() => handleViewAnexo(anexo.caminho_arquivo)} className="text-blue-600"><FontAwesomeIcon icon={faEye} /></button>
 <button type="button" onClick={() => handleRemoveAnexoPreexistente(anexo.id, anexo.caminho_arquivo, index)} className="text-red-600"><FontAwesomeIcon icon={faTrashAlt} /></button>
 </div>
 </div>
 ))}
 </div>
 )}
 <div onDragEnter={handleDragEvents} onDragLeave={handleDragEvents} onDragOver={handleDragEvents} onDrop={handleDrop} className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
 <input type="file" id="anexo-upload" className="hidden" multiple onChange={(e) => handleAnexoChange(e.target.files)} />
 <label htmlFor="anexo-upload" className="cursor-pointer">
 <FontAwesomeIcon icon={faUpload} className="text-gray-500 text-2xl mb-2" />
 <p className="text-sm text-gray-600">Arraste arquivos ou clique aqui.</p>
 </label>
 </div>
 {formData.anexos.length > 0 && (
 <div className="space-y-3 mt-4">
 <p className="text-xs font-semibold text-gray-600">Novos:</p>
 {formData.anexos.map((anexo, index) => (
 <div key={index} className="p-3 border rounded-md bg-blue-50 space-y-2 animate-fade-in">
 <div className="flex items-center justify-between text-sm font-semibold">
 <div className="flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} className="text-gray-600" /><span>{anexo.file.name}</span></div>
 <button type="button" onClick={() => handleRemoveNewAnexo(index)} className="text-red-600"><FontAwesomeIcon icon={faTrashAlt} /></button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 <input type="text" value={anexo.descricao} onChange={(e) => handleNewAnexoDataChange(index, 'descricao', e.target.value)} placeholder="Descrição" className="w-full p-2 border rounded-md text-sm" />
 <select value={anexo.tipo_documento_id || ''} onChange={(e) => handleNewAnexoDataChange(index, 'tipo_documento_id', e.target.value)} className="w-full p-2 border rounded-md text-sm">
 <option value="">Tipo...</option>
 {dropdownData?.tiposDocumento.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.sigla} - {tipo.descricao}</option>)}
 </select>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
