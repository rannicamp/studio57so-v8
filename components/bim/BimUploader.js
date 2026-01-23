// Caminho: app/components/bim/BimUploader.js
'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

export default function BimUploader({ onUploadComplete }) {
  const supabase = createClientComponentClient();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.rvt')) {
        alert('Por favor, envie apenas arquivos Revit (.rvt)');
        return;
    }

    setUploading(true);
    
    try {
        // --- ETAPA 1: Upload para o Supabase (Backup Seguro) ---
        setStatus('1/4: Salvando no Banco de Dados Seguro...');
        
        // Cria um nome único para não sobrescrever arquivos com mesmo nome
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('bim-arquivos') // Nome correto do bucket com hífen
            .upload(filePath, file);

        if (uploadError) throw new Error(`Erro Supabase Storage: ${uploadError.message}`);

        // --- ETAPA 2: Criar Registro na Tabela (Metadados) ---
        setStatus('2/4: Registrando Projeto...');
        
        const { data: projetoRef, error: dbError } = await supabase
            .from('projetos_bim')
            .insert({
                nome_arquivo: file.name,
                tamanho_bytes: file.size,
                caminho_storage: filePath,
                status: 'Processando'
            })
            .select()
            .single();

        if (dbError) throw new Error(`Erro Tabela BIM: ${dbError.message}`);

        // --- ETAPA 3: Enviar para Autodesk (Processamento) ---
        setStatus('3/4: Enviando para Nuvem Autodesk...');

        const formData = new FormData();
        formData.append('file', file);

        // Bloco de tratamento de erro robusto
        const res = await fetch('/api/aps/upload', {
            method: 'POST',
            body: formData,
        });

        // Tentamos ler a resposta como JSON
        let data;
        try {
            data = await res.json();
        } catch (e) {
            // Se falhar o parse do JSON, provavelmente é um erro 500 do servidor retornando HTML
            console.error("Erro ao ler resposta do servidor:", e);
            throw new Error(`Erro Fatal no Servidor (500). Verifique o terminal do VS Code para ver o log de erro.`);
        }

        // Se o status da requisição não for OK (200-299), lançamos o erro que veio do backend
        if (!res.ok) {
            throw new Error(data.error || `Erro na API Autodesk: ${res.statusText}`);
        }

        if (!data.urn) {
            throw new Error('O servidor respondeu, mas não enviou o código URN.');
        }

        // --- ETAPA 4: Atualizar Registro com o URN ---
        setStatus('4/4: Finalizando...');

        const { error: updateError } = await supabase
            .from('projetos_bim')
            .update({ 
                urn_autodesk: data.urn,
                status: 'Concluido'
            })
            .eq('id', projetoRef.id);

        if (updateError) throw new Error('Erro ao salvar URN no banco');

        setStatus('Sucesso! Projeto processado.');
        if (onUploadComplete) onUploadComplete(data.urn);

    } catch (error) {
        console.error(error);
        // Mostra o erro na tela para o usuário (e para você debugar)
        setStatus(`Erro: ${error.message}`);
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
        <input 
            type="file" 
            id="rvt-upload" 
            accept=".rvt" 
            onChange={handleFileChange} 
            className="hidden" 
            disabled={uploading}
        />
        
        {!uploading ? (
            <label htmlFor="rvt-upload" className="cursor-pointer flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <FontAwesomeIcon icon={faCloudUploadAlt} className="text-2xl text-blue-600" />
                </div>
                <div>
                    <span className="font-bold text-gray-700 block">Novo Projeto BIM</span>
                    <span className="text-xs text-gray-400">Upload para Supabase + Autodesk</span>
                </div>
            </label>
        ) : (
            <div className="flex flex-col items-center gap-3">
                <FontAwesomeIcon icon={faSpinner} className="text-3xl text-orange-500 animate-spin" />
                <p className="text-xs text-gray-600 font-medium animate-pulse">{status}</p>
            </div>
        )}

        {status.includes('Erro') && (
             <p className="mt-4 text-red-600 text-xs font-bold bg-red-50 p-2 rounded break-words">
                <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> {status}
             </p>
        )}

        {status.includes('Sucesso') && !uploading && (
             <p className="mt-4 text-green-600 text-sm font-bold">
                <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Processamento Concluído!
             </p>
        )}
    </div>
  );
}