'use server';

import { createClient } from '@/utils/supabase/server'; // CORRIGIDO: de createServerClient para createClient
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// Função para formatar o telefone
const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('55')) {
        cleaned = cleaned.substring(2);
    }
    if (cleaned.length === 11) {
        return `+55${cleaned}`;
    }
    if (cleaned.length === 10) {
        // Se não tiver o 9, tentamos adicionar (pode não ser perfeito para todos os casos)
        return `+55${cleaned.substring(0, 2)}9${cleaned.substring(2)}`;
    }
    return phone; // Retorna o original se não conseguir formatar
};

export async function createContact(prevState, formData) {
    // CORRIGIDO: de createServerClient para createClient
    const supabase = createClient();

    const nome = formData.get('nome');
    const email = formData.get('email');
    const telefone = formData.get('telefone');
    const corretorId = formData.get('corretor');
    const empreendimentoInteresseId = formData.get('empreendimento_interesse');

    const formattedPhone = formatPhoneNumber(telefone);

    try {
        // Inserir o contato
        const { data: contactData, error: contactError } = await supabase
            .from('contatos')
            .insert({
                nome: nome,
                origem: 'Formulário Site',
            })
            .select()
            .single();

        if (contactError) {
            console.error("Supabase contact error:", contactError);
            throw new Error(`Erro ao criar contato: ${contactError.message}`);
        }

        const contatoId = contactData.id;

        // Inserir email e telefone
        const promises = [];
        if (email) {
            promises.push(supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal' }));
        }
        if (formattedPhone) {
            promises.push(supabase.from('telefones').insert({ contato_id: contatoId, telefone: formattedPhone, tipo: 'Principal' }));
        }
        
        const results = await Promise.all(promises);
        results.forEach(result => {
            if (result.error) {
                console.error("Supabase detail error:", result.error);
                // Não lança erro para não impedir o fluxo, mas loga
            }
        });

        // Adicionar o contato ao funil
        // 1. Encontrar o funil padrão
        const { data: funilData, error: funilError } = await supabase
            .from('funis')
            .select('id')
            .eq('nome', 'Funil de Vendas')
            .single();

        if (funilError || !funilData) {
            throw new Error('Funil de Vendas não encontrado.');
        }

        // 2. Encontrar a primeira coluna do funil
        const { data: colunaData, error: colunaError } = await supabase
            .from('colunas_funil')
            .select('id')
            .eq('funil_id', funilData.id)
            .order('ordem', { ascending: true })
            .limit(1)
            .single();

        if (colunaError || !colunaData) {
            throw new Error('Coluna inicial do funil não encontrada.');
        }

        // 3. Inserir o contato na primeira coluna do funil
        const { error: funilInsertError } = await supabase
            .from('contatos_no_funil')
            .insert({
                contato_id: contatoId,
                coluna_id: colunaData.id,
                corretor_id: corretorId || null,
                produto_id: empreendimentoInteresseId || null,
            });

        if (funilInsertError) {
            console.error("Supabase funil insert error:", funilInsertError);
            throw new Error(`Erro ao adicionar contato ao funil: ${funilInsertError.message}`);
        }
        
        revalidatePath('/crm');

    } catch (error) {
        console.error("Server Action Error:", error);
        return { message: `Falha no cadastro: ${error.message}` };
    }

    // Se tudo deu certo, redireciona para a página de obrigado
    redirect('/cadastro-cliente/obrigado');
}