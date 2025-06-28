// app/api/contatos/duplicates/route.js

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  console.log("\n--- [API /contatos/duplicates] Início da Requisição ---");

  // Usando a chave secreta para operações no lado do servidor
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );

  try {
    // Busca todos os contatos e seus telefones/emails associados
    const { data: contatos, error } = await supabase
      .from('contatos')
      .select('*, telefones(telefone), emails(email)');

    if (error) {
      console.error("[API /contatos/duplicates] Erro ao buscar contatos:", error);
      throw error;
    }
    
    console.log(`[API /contatos/duplicates] Total de contatos buscados do banco: ${contatos.length}`);

    const cpfMap = new Map();
    const cnpjMap = new Map();
    const nameMap = new Map();
    const phoneMap = new Map();
    const emailMap = new Map();

    // Itera sobre todos os contatos para agrupá-los por diferentes critérios
    contatos.forEach(contato => {
      // Formata os detalhes do contato para a resposta
      const contatoDetails = {
        id: contato.id,
        nome: contato.nome,
        tipo_contato: contato.tipo_contato,
        cpf: contato.cpf,
        cnpj: contato.cnpj,
        telefones: contato.telefones ? contato.telefones.map(t => t.telefone) : [],
        emails: contato.emails ? contato.emails.map(e => e.email) : [],
      };

      // Agrupa por CPF
      if (contato.cpf && contato.cpf.trim() !== '') {
        const list = cpfMap.get(contato.cpf) || [];
        list.push(contatoDetails);
        cpfMap.set(contato.cpf, list);
      }

      // Agrupa por CNPJ
      if (contato.cnpj && contato.cnpj.trim() !== '') {
        const list = cnpjMap.get(contato.cnpj) || [];
        list.push(contatoDetails);
        cnpjMap.set(contato.cnpj, list);
      }
      
      // Agrupa por Nome
      if (contato.nome && contato.nome.trim() !== '') {
        const normalizedName = contato.nome.trim().toLowerCase();
        const list = nameMap.get(normalizedName) || [];
        list.push(contatoDetails);
        nameMap.set(normalizedName, list);
      }
      
      // Agrupa por Telefone
      if (contato.telefones) {
        contato.telefones.forEach(tel => {
          if (tel.telefone && tel.telefone.trim() !== '') {
            const list = phoneMap.get(tel.telefone) || [];
            if (!list.some(c => c.id === contato.id)) {
              list.push(contatoDetails);
              phoneMap.set(tel.telefone, list);
            }
          }
        });
      }

      // Agrupa por E-mail
      if (contato.emails) {
        contato.emails.forEach(em => {
          if (em.email && em.email.trim() !== '') {
            const normalizedEmail = em.email.trim().toLowerCase();
            const list = emailMap.get(normalizedEmail) || [];
            if (!list.some(c => c.id === contato.id)) {
              list.push(contatoDetails);
              emailMap.set(normalizedEmail, list);
            }
          }
        });
      }
    });

    const duplicateGroups = [];

    cpfMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'CPF', value: v, contatos: c }); });
    cnpjMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'CNPJ', value: v, contatos: c }); });
    nameMap.forEach((c) => { if (c.length > 1) duplicateGroups.push({ type: 'Nome', value: c[0].nome, contatos: c }); });
    phoneMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'Telefone', value: v, contatos: c }); });
    emailMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'E-mail', value: v, contatos: c }); });
    
    console.log(`[API /contatos/duplicates] Grupos de duplicatas encontrados: ${duplicateGroups.length}`);

    // Remove grupos que são exatamente iguais (mesmo tipo e mesma lista de IDs)
    const uniqueDuplicateGroups = Array.from(new Map(duplicateGroups.map(group => {
      const key = `${group.type}-${group.contatos.map(c => c.id).sort().join(',')}`;
      return [key, group];
    })).values());

    console.log(`[API /contatos/duplicates] Grupos únicos de duplicatas a serem enviados: ${uniqueDuplicateGroups.length}`);
    console.log("--- [API /contatos/duplicates] Fim da Requisição ---\n");

    return new Response(JSON.stringify(uniqueDuplicateGroups), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[API /contatos/duplicates] ERRO CRÍTICO:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}