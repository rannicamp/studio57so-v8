require('dotenv').config({ path: '../.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function uploadStorie() {
  const filePath = 'C:\\Projetos\\editor de videos\\out\\Storie_Avaliacao_PeroVaz.mp4';
  
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    return;
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = '10/Storie_Avaliacao_PeroVaz.mp4';
  
  console.log('1. Fazendo upload para o Supabase Storage...');
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('empreendimento-anexos')
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: true
    });
    
  if (uploadError) {
    console.error('Erro no upload:', uploadError);
    return;
  }
  
  console.log('Upload concluído:', uploadData);
  
  console.log('2. Registrando no banco de dados (empreendimento_anexos)...');
  
  const payload = {
    empreendimento_id: 10,
    caminho_arquivo: storagePath,
    nome_arquivo: '[VIDEO] - STORIE AVALIACAO PERO VAZ.mp4',
    descricao: 'Anúncio Vertical Focado na Avaliação Caixa x Preço',
    categoria_aba: 'marketing',
    status: 'Ativo',
    organizacao_id: 2,
    disponivel_corretor: true
  };
  
  // Verifica se já existe para não duplicar
  const { data: existing } = await supabase.from('empreendimento_anexos')
    .select('id').eq('empreendimento_id', 10).eq('caminho_arquivo', storagePath).single();
    
  if (existing) {
    console.log('Arquivo já registrado no banco de dados. ID:', existing.id);
  } else {
    const { data: insertData, error: insertError } = await supabase.from('empreendimento_anexos')
      .insert([payload]);
      
    if (insertError) {
      console.error('Erro ao inserir no banco:', insertError);
    } else {
      console.log('Inserido com sucesso no banco de dados!');
    }
  }
}

uploadStorie();
