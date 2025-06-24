"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { IMaskInput } from 'react-imask';

// Componente para exibir um campo no modo de visualização
const InfoField = ({ label, value }) => (
  <div>
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900">{value || 'Não informado'}</dd>
  </div>
);

// --- Componente principal da Ficha ---
export default function FichaFuncionario({ initialEmployee, companies, empreendimentos }) {
  const supabase = createClient();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [employee, setEmployee] = useState(initialEmployee);
  const [documents, setDocuments] = useState(initialEmployee.documentos_funcionarios || []);
  
  const [newDocFile, setNewDocFile] = useState(null);
  const [newDocName, setNewDocName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployee(prev => ({ ...prev, [name]: value === '' ? null : value }));
  };

  const handleMaskedChange = (name, value) => {
    setEmployee(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    setMessage({ type: '', text: 'Salvando alterações...' });
    
    const { cadastro_empresa, empreendimentos, documentos_funcionarios, ...employeeDataToUpdate } = employee;

    const { error } = await supabase
      .from('funcionarios')
      .update(employeeDataToUpdate)
      .eq('id', employee.id);

    if (error) {
      setMessage({ type: 'error', text: `Erro: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setIsEditing(false);
      router.refresh(); 
    }
    setIsLoading(false);
  };

  const handleDocumentUpload = async (e) => { /* ... lógica de upload ... */ };
  
  // O componente da Ficha do Funcionário
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-8">
      {/* Cabeçalho com nome e botão de ação */}
      <div className="flex justify-between items-start mb-6 border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{initialEmployee.full_name}</h2>
          <p className="text-gray-500">{initialEmployee.contract_role}</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSaveChanges() : setIsEditing(true)}
          disabled={isLoading}
          className={`px-4 py-2 rounded-md text-white font-semibold transition-colors ${isEditing ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:bg-gray-400`}>
          {isLoading ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Editar Informações')}
        </button>
      </div>
      
      {message.text && <p className={`mb-4 text-center text-sm font-medium ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message.text}</p>}

      {/* --- MODO DE EDIÇÃO --- */}
      {isEditing ? (
        <div className="space-y-8">
            {/* Seção de Vínculos */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Vínculos Profissionais</h3>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium">Empresa</label><select name="empresa_id" value={employee.empresa_id} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione</option>{companies.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}</select></div>
                <div><label className="block text-sm font-medium">Empreendimento</label><select name="empreendimento_atual_id" value={employee.empreendimento_atual_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhum</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
              </div>
            </div>
            {/* Seção de Dados Pessoais */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Dados Pessoais</h3>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-3"><label className="block text-sm font-medium">Nome Completo</label><input type="text" name="full_name" value={employee.full_name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                 <div><label className="block text-sm font-medium">CPF</label><input type="text" name="cpf" value={employee.cpf} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                 <div><label className="block text-sm font-medium">RG</label><input type="text" name="rg" value={employee.rg} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                 <div><label className="block text-sm font-medium">Data de Nascimento</label><input type="date" name="birth_date" value={employee.birth_date} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                 <div><label className="block text-sm font-medium">Estado Civil</label><select name="estado_civil" value={employee.estado_civil} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option>Solteiro(a)</option><option>Casado(a)</option><option>Divorciado(a)</option><option>Viúvo(a)</option><option>União Estável</option></select></div>
                 <div><label className="block text-sm font-medium">Telefone</label><IMaskInput mask="(00) 00000-0000" name="phone" value={employee.phone} onAccept={(v) => handleMaskedChange('phone', v)} className="mt-1 w-full p-2 border rounded-md"/></div>
                 <div className="md:col-span-3"><label className="block text-sm font-medium">Email</label><input type="email" name="email" value={employee.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/></div>
              </div>
            </div>
            {/* Adicione outras seções editáveis aqui (Endereço, Contratual, Pagamento...) */}
        </div>
      ) : (
      /* --- MODO DE VISUALIZAÇÃO --- */
        <div className="space-y-8">
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-8">
                <InfoField label="Nome Completo" value={employee.full_name} />
                <InfoField label="CPF" value={employee.cpf} />
                <InfoField label="RG" value={employee.rg} />
                <InfoField label="Data de Nascimento" value={employee.birth_date} />
                <InfoField label="Estado Civil" value={employee.estado_civil} />
                <InfoField label="Telefone" value={employee.phone} />
                <InfoField label="Email" value={employee.email} />
                <InfoField label="Empresa" value={employee.cadastro_empresa?.razao_social} />
                <InfoField label="Empreendimento Atual" value={employee.empreendimentos?.nome} />
            </dl>
        </div>
      )}

      {/* Seção de Documentos (sempre visível) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 border-t pt-6">Documentos</h3>
        <ul className="mt-4 divide-y divide-gray-200 border rounded-md">
          {documents.map(doc => (
            <li key={doc.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
              <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/funcionarios-documentos/${doc.caminho_arquivo}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                {doc.nome_documento}
              </a>
            </li>
          ))}
          {documents.length === 0 && <li className="p-3 text-gray-500">Nenhum documento encontrado.</li>}
        </ul>
        
        <form onSubmit={handleDocumentUpload} className="mt-4 p-4 border rounded-md bg-gray-50 flex items-end gap-4">
          <div className="flex-grow"><label htmlFor="doc-name-input" className="block text-sm font-medium">Nome do Documento</label><input type="text" id="doc-name-input" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} required className="mt-1 w-full p-2 border rounded-md"/></div>
          <div className="flex-grow"><label htmlFor="doc-file-input" className="block text-sm font-medium">Arquivo</label><input type="file" id="doc-file-input" onChange={(e) => setNewDocFile(e.target.files[0])} required className="mt-1 block w-full text-sm"/></div>
          <button type="submit" disabled={isLoading} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 h-10">Enviar</button>
        </form>
      </div>
    </div>
  );
}