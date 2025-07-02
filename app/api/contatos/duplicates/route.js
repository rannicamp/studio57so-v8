// app/api/contatos/duplicates/route.js

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );

  try {
    const { data: contatos, error } = await supabase
      .from('contatos')
      .select('*, telefones(telefone), emails(email)');

    if (error) {
      console.error("[API /contatos/duplicates] Erro ao buscar contatos:", error);
      throw error;
    }
    
    const cpfMap = new Map();
    const cnpjMap = new Map();
    const nameMap = new Map();
    const phoneMap = new Map();
    const emailMap = new Map();
    // ***** INÍCIO DA ALTERAÇÃO *****
    // Novas variáveis para agrupar por Razão Social e Nome Fantasia
    const razaoSocialMap = new Map();
    const nomeFantasiaMap = new Map();
    // ***** FIM DA ALTERAÇÃO *****

    contatos.forEach(contato => {
      const contatoDetails = {
        id: contato.id,
        nome: contato.nome,
        razao_social: contato.razao_social,
        nome_fantasia: contato.nome_fantasia,
        tipo_contato: contato.tipo_contato,
        cpf: contato.cpf,
        cnpj: contato.cnpj,
        telefones: contato.telefones ? contato.telefones.map(t => t.telefone) : [],
        emails: contato.emails ? contato.emails.map(e => e.email) : [],
      };

      // Agrupamento por CPF (sem alteração)
      if (contato.cpf && contato.cpf.trim() !== '') {
        const list = cpfMap.get(contato.cpf) || [];
        list.push(contatoDetails);
        cpfMap.set(contato.cpf, list);
      }

      // Agrupamento por CNPJ (sem alteração)
      if (contato.cnpj && contato.cnpj.trim() !== '') {
        const list = cnpjMap.get(contato.cnpj) || [];
        list.push(contatoDetails);
        cnpjMap.set(contato.cnpj, list);
      }
      
      // Agrupamento por Nome (sem alteração)
      if (contato.nome && contato.nome.trim() !== '') {
        const normalizedName = contato.nome.trim().toLowerCase();
        const list = nameMap.get(normalizedName) || [];
        list.push(contatoDetails);
        nameMap.set(normalizedName, list);
      }
      
      // ***** INÍCIO DA ALTERAÇÃO *****
      // NOVO: Agrupamento por Razão Social
      if (contato.razao_social && contato.razao_social.trim() !== '') {
        const normalizedRazao = contato.razao_social.trim().toLowerCase();
        const list = razaoSocialMap.get(normalizedRazao) || [];
        list.push(contatoDetails);
        razaoSocialMap.set(normalizedRazao, list);
      }

      // NOVO: Agrupamento por Nome Fantasia
      if (contato.nome_fantasia && contato.nome_fantasia.trim() !== '') {
        const normalizedFantasia = contato.nome_fantasia.trim().toLowerCase();
        const list = nomeFantasiaMap.get(normalizedFantasia) || [];
        list.push(contatoDetails);
        nomeFantasiaMap.set(normalizedFantasia, list);
      }
      // ***** FIM DA ALTERAÇÃO *****
      
      // Agrupamento por Telefone (sem alteração)
      if (contato.telefones) {
        contato.telefones.forEach(tel => {
          if (tel.telefone && tel.telefone.trim() !== '') {
            const list = phoneMap.get(tel.telefone) || [];
            if (!list.some(c => c.id === contato.id)) { list.push(contatoDetails); phoneMap.set(tel.telefone, list); }
          }
        });
      }

      // Agrupamento por E-mail (sem alteração)
      if (contato.emails) {
        contato.emails.forEach(em => {
          if (em.email && em.email.trim() !== '') {
            const normalizedEmail = em.email.trim().toLowerCase();
            const list = emailMap.get(normalizedEmail) || [];
            if (!list.some(c => c.id === contato.id)) { list.push(contatoDetails); emailMap.set(normalizedEmail, list); }
          }
        });
      }
    });

    const duplicateGroups = [];

    // Adiciona os grupos encontrados pelos critérios antigos
    cpfMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'CPF', value: v, contatos: c }); });
    cnpjMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'CNPJ', value: v, contatos: c }); });
    nameMap.forEach((c) => { if (c.length > 1) duplicateGroups.push({ type: 'Nome', value: c[0].nome, contatos: c }); });
    phoneMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'Telefone', value: v, contatos: c }); });
    emailMap.forEach((c, v) => { if (c.length > 1) duplicateGroups.push({ type: 'E-mail', value: v, contatos: c }); });
    
    // ***** INÍCIO DA ALTERAÇÃO *****
    // Adiciona os NOVOS grupos encontrados por Razão Social e Nome Fantasia
    razaoSocialMap.forEach((c) => { if (c.length > 1) duplicateGroups.push({ type: 'Razão Social', value: c[0].razao_social, contatos: c }); });
    nomeFantasiaMap.forEach((c) => { if (c.length > 1) duplicateGroups.push({ type: 'Nome Fantasia', value: c[0].nome_fantasia, contatos: c }); });
    // ***** FIM DA ALTERAÇÃO *****

    // Remove grupos que são exatamente iguais
    const uniqueDuplicateGroups = Array.from(new Map(duplicateGroups.map(group => {
      const key = `${group.type}-${group.contatos.map(c => c.id).sort().join(',')}`;
      return [key, group];
    })).values());

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