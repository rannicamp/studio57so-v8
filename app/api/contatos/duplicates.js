// app/api/contatos/duplicates.js

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
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
      throw error;
    }

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

      // Agrupa por CPF, se existir
      if (contato.cpf && contato.cpf.trim() !== '') {
        const list = cpfMap.get(contato.cpf) || [];
        list.push(contatoDetails);
        cpfMap.set(contato.cpf, list);
      }

      // Agrupa por CNPJ, se existir
      if (contato.cnpj && contato.cnpj.trim() !== '') {
        const list = cnpjMap.get(contato.cnpj) || [];
        list.push(contatoDetails);
        cnpjMap.set(contato.cnpj, list);
      }
      
      // Agrupa por Nome (ignorando maiúsculas/minúsculas)
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
            // Adiciona apenas se o contato ainda não estiver na lista deste telefone
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
            // Adiciona apenas se o contato ainda não estiver na lista deste email
            if (!list.some(c => c.id === contato.id)) {
              list.push(contatoDetails);
              emailMap.set(normalizedEmail, list);
            }
          }
        });
      }
    });

    const duplicateGroups = [];

    // Adiciona os grupos de CPF com mais de 1 contato
    cpfMap.forEach((contatos, value) => {
      if (contatos.length > 1) {
        duplicateGroups.push({ type: 'CPF', value, contatos });
      }
    });

    // Adiciona os grupos de CNPJ com mais de 1 contato
    cnpjMap.forEach((contatos, value) => {
      if (contatos.length > 1) {
        duplicateGroups.push({ type: 'CNPJ', value, contatos });
      }
    });

    // Adiciona os grupos de Nome com mais de 1 contato
    nameMap.forEach((contatos, normalizedName) => {
      if (contatos.length > 1) {
        // Usa o nome original do primeiro contato do grupo para exibição
        duplicateGroups.push({ type: 'Nome', value: contatos[0].nome, contatos });
      }
    });

    // Adiciona os grupos de Telefone com mais de 1 contato
    phoneMap.forEach((contatos, value) => {
      if (contatos.length > 1) {
        duplicateGroups.push({ type: 'Telefone', value, contatos });
      }
    });

    // Adiciona os grupos de E-mail com mais de 1 contato
    emailMap.forEach((contatos, value) => {
      if (contatos.length > 1) {
        duplicateGroups.push({ type: 'E-mail', value, contatos });
      }
    });

    // Remove grupos que são exatamente iguais (mesmo tipo e mesma lista de IDs)
    const uniqueDuplicateGroups = Array.from(new Map(duplicateGroups.map(group => {
      const key = `${group.type}-${group.contatos.map(c => c.id).sort().join(',')}`;
      return [key, group];
    })).values());


    // Retorna a lista de grupos duplicados
    return new Response(JSON.stringify(uniqueDuplicateGroups), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro ao buscar duplicatas:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}