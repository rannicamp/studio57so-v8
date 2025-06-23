"use client";

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../utils/supabase/client';

export default function UploadPage() {
  const supabase = createClient();
  
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setMessage('Por favor, selecione um arquivo para enviar.');
      return;
    }

    setMessage('Enviando arquivo...');

    // --- INÍCIO DA LÓGICA DE RENOMEAR ---

    // 1. Pega a extensão do arquivo original (ex: "png", "jpg")
    const fileExtension = file.name.split('.').pop();
    // 2. Cria um nome de arquivo novo e único usando o tempo atual em milissegundos
    const newFileName = `${Date.now()}.${fileExtension}`;
    // 3. Define o caminho completo onde o arquivo será salvo no bucket
    const filePath = `public/${newFileName}`;

    // --- FIM DA LÓGICA DE RENOMEAR ---

    // 1. Envia o arquivo para o Supabase Storage com o NOVO NOME
    const { data: fileData, error: fileError } = await supabase.storage
      .from('marca')
      .upload(filePath, file, { // Usando o novo filePath
        cacheControl: '3600',
        upsert: false,
      });

    if (fileError) {
      setMessage(`Erro no upload do arquivo: ${fileError.message}`);
      console.error(fileError);
      return;
    }

    // 2. Salva a referência no banco de dados com o NOVO CAMINHO
    const { error: dbError } = await supabase
      .from('marcas_uploads')
      .insert([
        {
          descricao: description,
          caminho_arquivo: fileData.path, // Usando o caminho retornado pelo Storage
        },
      ]);
    
    if (dbError) {
        setMessage(`Arquivo enviado, mas erro ao salvar descrição: ${dbError.message}`);
        console.error(dbError);
    } else {
        setMessage('Upload e cadastro realizados com sucesso!');
        setFile(null);
        setDescription('');
        document.getElementById('file-input').value = "";
    }
  };

  // O restante do código (JSX do formulário) continua exatamente o mesmo
  const inputStyle = { display: 'block', width: '300px', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' };
  const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <Link href="/" style={{ color: 'blue' }}>&larr; Voltar para a página inicial</Link>
      <h1 style={{ textAlign: 'center' }}>Upload de Arquivo de Marca</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
        <label htmlFor="description" style={labelStyle}>Descrição</label>
        <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} required style={inputStyle} />
        <label htmlFor="file-input" style={labelStyle}>Arquivo</label>
        <input id="file-input" type="file" onChange={handleFileChange} accept="image/*" style={inputStyle} />
        <button type="submit" style={{ ...inputStyle, backgroundColor: '#0070f3', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Enviar Arquivo</button>
        {message && <p style={{ marginTop: '15px', textAlign: 'center', fontWeight: 'bold' }}>{message}</p>}
      </form>
    </main>
  );
}