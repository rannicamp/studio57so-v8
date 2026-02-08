import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { organizacaoId } = await request.json();

        if (!organizacaoId) {
            return NextResponse.json({ error: 'Organização ID é obrigatório' }, { status: 400 });
        }

        // 1. Buscar TODOS os telefones (query leve, apenas campos essenciais)
        // Trazemos também o nome/razão social para já identificar visualmente
        const { data: telefones, error } = await supabase
            .from('telefones')
            .select(`
                id,
                telefone,
                tipo,
                contato_id,
                country_code,
                contatos:contato_id (
                    id,
                    nome,
                    razao_social,
                    tipo_contato,
                    cpf,
                    cnpj
                )
            `)
            .eq('organizacao_id', organizacaoId)
            .not('telefone', 'is', null);

        if (error) throw error;

        // 2. Agrupamento Inteligente (A Mágica acontece aqui ✨)
        const groups = {};

        telefones.forEach(reg => {
            if (!reg.telefone || !reg.contatos) return; // Pula se não tiver contato vinculado

            let rawPhone = reg.telefone.replace(/\D/g, ''); // Remove não-números
            let fingerprint = rawPhone; // Chave de comparação

            // Lógica para Contatos Brasileiros (+55 ou sem DDI)
            const isBrazil = reg.country_code === '+55' || 
                             (!reg.country_code && (rawPhone.length === 10 || rawPhone.length === 11));

            if (isBrazil) {
                // Remove o 55 se estiver no começo
                if (rawPhone.startsWith('55') && rawPhone.length > 11) {
                    rawPhone = rawPhone.substring(2);
                }

                // A Regra de Ouro: DDD + Últimos 8 dígitos
                // Isso ignora se tem o 9º dígito ou não
                if (rawPhone.length >= 10) {
                    const ddd = rawPhone.substring(0, 2);
                    const last8 = rawPhone.slice(-8);
                    fingerprint = `BR-${ddd}-${last8}`;
                }
            } else {
                // Para gringos (EUA, etc), usamos o número limpo completo como chave
                fingerprint = `INT-${rawPhone}`;
            }

            // Agrupa
            if (!groups[fingerprint]) {
                groups[fingerprint] = [];
            }
            groups[fingerprint].push(reg);
        });

        // 3. Filtrar apenas os grupos que têm duplicatas (mais de 1 contato diferente)
        const duplicateGroups = [];

        Object.keys(groups).forEach(key => {
            const groupItems = groups[key];
            
            // Set para garantir que são contatos DIFERENTES (mesmo contato com 2 telefones iguais não é duplicata de pessoa)
            const uniqueContactIds = new Set(groupItems.map(item => item.contato_id));

            if (uniqueContactIds.size > 1) {
                // Formata para o frontend
                const contatosDoGrupo = [];
                const seenIds = new Set();

                groupItems.forEach(item => {
                    if (!seenIds.has(item.contato_id)) {
                        seenIds.add(item.contato_id);
                        // Prepara o objeto do contato para exibição no card
                        contatosDoGrupo.push({
                            id: item.contato_id,
                            nome: item.contatos.nome,
                            razao_social: item.contatos.razao_social,
                            tipo_contato: item.contatos.tipo_contato,
                            cpf: item.contatos.cpf,
                            cnpj: item.contatos.cnpj,
                            telefones: [{ telefone: item.telefone }] // Mostra o telefone que gerou o conflito
                        });
                    }
                });

                duplicateGroups.push({
                    type: 'Telefone',
                    value: groupItems[0].telefone, // Valor de referência (visual)
                    fingerprint: key, // Chave técnica (para debug se precisar)
                    contatos: contatosDoGrupo
                });
            }
        });

        // 4. Também buscar duplicatas por CPF/CNPJ (Lógica Clássica mantida)
        // ... (Se quiser manter a busca por nome/doc, podemos adicionar aqui, 
        // mas o foco agora foi resolver o telefone) ...
        
        // Vamos manter a busca por Documento e Email também para ser completo?
        // Vou adicionar uma busca rápida por Email/Doc no mesmo padrão para você não perder funcionalidade.
        
        const { data: contatosDoc } = await supabase
            .from('contatos')
            .select('id, nome, razao_social, cpf, cnpj, email, tipo_contato')
            .eq('organizacao_id', organizacaoId);

        if (contatosDoc) {
            const docGroups = {};
            
            contatosDoc.forEach(c => {
                // Agrupa por CPF
                if (c.cpf) {
                    const cleanCpf = c.cpf.replace(/\D/g, '');
                    if (!docGroups[`CPF-${cleanCpf}`]) docGroups[`CPF-${cleanCpf}`] = [];
                    docGroups[`CPF-${cleanCpf}`].push(c);
                }
                // Agrupa por CNPJ
                if (c.cnpj) {
                    const cleanCnpj = c.cnpj.replace(/\D/g, '');
                    if (!docGroups[`CNPJ-${cleanCnpj}`]) docGroups[`CNPJ-${cleanCnpj}`] = [];
                    docGroups[`CNPJ-${cleanCnpj}`].push(c);
                }
            });

            Object.keys(docGroups).forEach(key => {
                if (docGroups[key].length > 1) {
                    const [type, val] = key.split('-');
                    duplicateGroups.push({
                        type: type,
                        value: val,
                        contatos: docGroups[key].map(c => ({...c, telefones: []})) // Sem telefones aqui
                    });
                }
            });
        }

        return NextResponse.json(duplicateGroups);

    } catch (error) {
        console.error('Erro na API de duplicatas:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}