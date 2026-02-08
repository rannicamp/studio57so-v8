import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import Papa from 'papaparse';

// Função para converter os dados do nosso sistema para o formato do Google
const formatDataForGoogle = (contacts) => {
    return contacts.map(contact => {
        const googleContact = {
            'Name': contact.personalidade_juridica === 'Pessoa Jurídica' ? contact.razao_social : contact.nome,
            'Given Name': '',
            'Additional Name': '',
            'Family Name': '',
            'Yomi Name': '',
            'Given Name Yomi': '',
            'Additional Name Yomi': '',
            'Family Name Yomi': '',
            'Name Prefix': '',
            'Name Suffix': '',
            'Initials': '',
            'Nickname': '',
            'Short Name': '',
            'Maiden Name': '',
            'Birthday': contact.birth_date,
            'Gender': '',
            'Location': '',
            'Billing Information': '',
            'Directory Server': '',
            'Mileage': '',
            'Occupation': contact.cargo,
            'Hobby': '',
            'Sensitivity': '',
            'Priority': '',
            'Subject': '',
            'Notes': contact.observations,
            'Language': '',
            'Photo': '',
            'Group Membership': `* myContacts ::: ${contact.tipo_contato || ''}`,
            'E-mail 1 - Type': 'Work',
            'E-mail 1 - Value': contact.emails?.[0]?.email || '',
            'Phone 1 - Type': 'Mobile',
            'Phone 1 - Value': contact.telefones?.[0]?.telefone || '',
            'Phone 2 - Type': 'Work',
            'Phone 2 - Value': contact.telefones?.[1]?.telefone || '',
            'Address 1 - Type': 'Work',
            'Address 1 - Formatted': `${contact.address_street || ''}, ${contact.address_number || ''} - ${contact.neighborhood || ''}, ${contact.city || ''} - ${contact.state || ''}, ${contact.cep || ''}`,
            'Address 1 - Street': contact.address_street,
            'Address 1 - City': contact.city,
            'Address 1 - PO Box': '',
            'Address 1 - Region': contact.state,
            'Address 1 - Postal Code': contact.cep,
            'Address 1 - Country': '',
            'Address 1 - Extended Address': contact.address_complement,
            'Organization 1 - Type': 'Work',
            'Organization 1 - Name': contact.personalidade_juridica === 'Pessoa Jurídica' ? contact.razao_social : '',
            'Organization 1 - Yomi Name': '',
            'Organization 1 - Title': contact.cargo,
            'Organization 1 - Department': '',
            'Organization 1 - Symbol': '',
            'Organization 1 - Location': '',
            'Organization 1 - Job Description': '',
        };

        // Divide o nome em "Nome" e "Sobrenome" se for Pessoa Física
        if (contact.personalidade_juridica === 'Pessoa Física' && contact.nome) {
            const nameParts = contact.nome.split(' ');
            googleContact['Given Name'] = nameParts[0];
            googleContact['Family Name'] = nameParts.slice(1).join(' ');
        }
        
        return googleContact;
    });
};

export async function GET() {
    try {
        const supabase = await createClient();

        // 1. Busca todos os contatos e seus telefones/emails associados
        const { data: contacts, error } = await supabase
            .from('contatos')
            .select('*, telefones(telefone), emails(email)');

        if (error) {
            throw new Error(`Erro ao buscar contatos: ${error.message}`);
        }

        // 2. Formata os dados para o padrão do Google
        const formattedData = formatDataForGoogle(contacts);

        // 3. Converte os dados formatados para uma string CSV
        const csv = Papa.unparse(formattedData, {
            header: true,
        });

        // 4. Retorna o arquivo CSV para download
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="contatos_google.csv"',
            },
        });

    } catch (error) {
        console.error('Erro na API de exportação:', error);
        return new NextResponse(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}