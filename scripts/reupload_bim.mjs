import fs from 'fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhuvnutzklhskkwbpxdz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodXZudXR6a2xoc2trd2JweGR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkyNjY0NiwiZXhwIjoyMDY1NTAyNjQ2fQ.wprEVKNDXXIjHJ32fQQnTBGdMdGLBL7SrXUio5-dDXc';

async function main() {
  console.log('🔄 Buscando projetos BIM no Supabase...');
  
  // Buscar um projeto para testar (ex: o de 41Mb)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projetos_bim?select=id,nome,url_arquivo&order=id.desc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  const projetos = await res.json();
  
  for (const p of projetos) {
    if (p.url_arquivo) {
      console.log(`\n==================================`);
      console.log(`📦 Encontrado Projeto: ${p.nome} (ID: ${p.id})`);
      console.log(`🔗 URL: ${p.url_arquivo}`);
      
      // Enviando para a nossa própria API Next.js que está rodando em localhost:3000
      try {
        console.log(`🚀 Iniciando Upload para o novo Bucket Persistente da Autodesk...`);
        let ext = p.nome.toLowerCase().includes('.rvt') || p.url_arquivo.toLowerCase().includes('.rvt') ? '.rvt' : '.ifc';
        let safeName = p.nome.replace(/[^a-zA-Z0-9_-]/g, '_') + ext;

        const uploadRes = await fetch('http://localhost:3000/api/aps/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileUrl: p.url_arquivo,
            fileName: safeName
          })
        });
        
        const uploadData = await uploadRes.json();
        console.log(`✅ Resultado do Upload API:`, uploadData);
        
        if (uploadData.urn) {
            console.log(`\n💾 ATUALIZANDO BANCO COM O NOVO URN: ${uploadData.urn}`);
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/projetos_bim?id=eq.${p.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ urn_autodesk: uploadData.urn })
            });
            if(updateRes.ok) {
                console.log(`🎉 URN Atualizado com sucesso no banco para o projeto ${p.id}!`);
            } else {
                console.error(`❌ Falha ao atualizar banco:`, await updateRes.text());
            }
        }
      } catch (err) {
        console.error(`❌ Erro no disparo do upload:`, err);
      }
    }
  }
}

main();
