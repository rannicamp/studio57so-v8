// app/api/contatos/duplicates/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Função auxiliar para normalizar strings (remove acentos, espaços extras e deixa minúsculo)
function normalizeString(str) {
    if (!str) return '';
    return str
        .normalize('NFD') // Separa os acentos das letras
        .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
        .toLowerCase()
        .trim();
}

// Função auxiliar para limpar números (telefones, cpf, cnpj)
function cleanNumber(str) {
    if (!str) return '';
    return str.replace(/\D/g, ''); // Remove tudo que não é dígito
}

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );

  try {
    const body = await request.json();
    const { organizacaoId } = body;

    if (!organizacaoId) {
        return NextResponse.json({ error: 'ID da organização é obrigatório.' }, { status: 400 });
    }

    // Busca todos os contatos DA ORGANIZAÇÃO
    // Trazemos telefones e emails juntos para análise cruzada
    const { data: contatos, error } = await supabase
      .from('contatos')
      .select('*, telefones(telefone), emails(email)')
      .eq('organizacao_id', organizacaoId)
      .range(0, 9999); // Limite alto para garantir análise completa

    if (error) {
      console.error("[API /contatos/duplicates] Erro ao buscar contatos:", error);
      throw error;
    }
    
    // Mapas para agrupamento inteligente
    const cpfMap = new Map();
    const cnpjMap = new Map();
    const nameMap = new Map();
    const phoneMap = new Map();
    const emailMap = new Map();
    const razaoSocialMap = new Map();
    const nomeFantasiaMap = new Map();

    contatos.forEach(contato => {
      // MODIFICAÇÃO IMPORTANTE: Usamos o objeto COMPLETO do contato
      // para que o MergeModal tenha acesso a endereços, datas, etc.
      const contatoDetails = {
        ...contato, // Spread operator copia tudo (nome, id, endereco, etc)
        telefones: contato.telefones || [],
        emails: contato.emails || [],
      };

      // 1. ANÁLISE DE CPF (Números limpos)
      if (contato.cpf) {
        const cleanCpf = cleanNumber(contato.cpf);
        if (cleanCpf.length === 11) { // Validação básica de tamanho
            const list = cpfMap.get(cleanCpf) || [];
            list.push(contatoDetails);
            cpfMap.set(cleanCpf, list);
        }
      }

      // 2. ANÁLISE DE CNPJ (Números limpos)
      if (contato.cnpj) {
        const cleanCnpj = cleanNumber(contato.cnpj);
        if (cleanCnpj.length === 14) {
            const list = cnpjMap.get(cleanCnpj) || [];
            list.push(contatoDetails);
            cnpjMap.set(cleanCnpj, list);
        }
      }

      // 3. ANÁLISE DE NOME (Normalizado)
      if (contato.nome) {
        const normalizedName = normalizeString(contato.nome);
        // Ignora nomes muito curtos ou genéricos demais se necessário
        if (normalizedName.length > 2) { 
            const list = nameMap.get(normalizedName) || [];
            list.push(contatoDetails);
            nameMap.set(normalizedName, list);
        }
      }

      // 4. ANÁLISE DE RAZÃO SOCIAL (Normalizado)
      if (contato.razao_social) {
        const normalizedRazao = normalizeString(contato.razao_social);
        if (normalizedRazao.length > 2) {
            const list = razaoSocialMap.get(normalizedRazao) || [];
            list.push(contatoDetails);
            razaoSocialMap.set(normalizedRazao, list);
        }
      }

      // 5. ANÁLISE DE NOME FANTASIA (Normalizado)
      if (contato.nome_fantasia) {
        const normalizedFantasia = normalizeString(contato.nome_fantasia);
        if (normalizedFantasia.length > 2) {
            const list = nomeFantasiaMap.get(normalizedFantasia) || [];
            list.push(contatoDetails);
            nomeFantasiaMap.set(normalizedFantasia, list);
        }
      }

      // 6. ANÁLISE DE TELEFONES
      if (contato.telefones && contato.telefones.length > 0) {
        contato.telefones.forEach(tel => {
          if (tel.telefone) {
            const cleanPhone = cleanNumber(tel.telefone);
            // Consideramos duplicata se os últimos 8 dígitos coincidirem (ignora DDD se um tiver e outro não, ou 9º dígito)
            if (cleanPhone.length >= 8) {
                const list = phoneMap.get(cleanPhone) || [];
                // Evita adicionar o mesmo contato duas vezes no mesmo grupo
                if (!list.some(c => c.id === contato.id)) { 
                    list.push(contatoDetails); 
                    phoneMap.set(cleanPhone, list); 
                }
            }
          }
        });
      }

      // 7. ANÁLISE DE E-MAILS
      if (contato.emails && contato.emails.length > 0) {
        contato.emails.forEach(em => {
          if (em.email) {
            const normalizedEmail = em.email.trim().toLowerCase();
            if (normalizedEmail.length > 5) {
                const list = emailMap.get(normalizedEmail) || [];
                if (!list.some(c => c.id === contato.id)) { 
                    list.push(contatoDetails); 
                    emailMap.set(normalizedEmail, list); 
                }
            }
          }
        });
      }
    });

    // Consolidar Grupos
    const duplicateGroups = [];

    // Helper para adicionar grupo se tiver > 1 contato
    const addGroup = (map, type) => {
        map.forEach((contatosList, value) => {
            if (contatosList.length > 1) {
                duplicateGroups.push({ type, value, contatos: contatosList });
            }
        });
    };

    addGroup(cpfMap, 'CPF');
    addGroup(cnpjMap, 'CNPJ');
    addGroup(nameMap, 'Nome');
    addGroup(razaoSocialMap, 'Razão Social');
    addGroup(nomeFantasiaMap, 'Nome Fantasia');
    addGroup(phoneMap, 'Telefone');
    addGroup(emailMap, 'E-mail');
    
    // Remover duplicatas de GRUPOS (Ex: mesmo grupo encontrado pelo nome E pelo email)
    // Criamos uma chave única baseada nos IDs dos contatos envolvidos
    const uniqueDuplicateGroups = Array.from(new Map(duplicateGroups.map(group => {
      const idsKey = group.contatos.map(c => c.id).sort((a, b) => a - b).join(',');
      // Preferência de tipo de duplicata para exibição
      return [idsKey, group];
    })).values());

    // Ordenar por tipo para ficar organizado na tela
    uniqueDuplicateGroups.sort((a, b) => {
        const order = { 'CPF': 1, 'CNPJ': 2, 'Nome': 3, 'Razão Social': 4, 'Telefone': 5, 'E-mail': 6 };
        return (order[a.type] || 99) - (order[b.type] || 99);
    });

    return NextResponse.json(uniqueDuplicateGroups);

  } catch (error) {
    console.error("[API /contatos/duplicates] ERRO CRÍTICO:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}