// app/api/contatos/duplicates.js

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

  try {
    // Consulta para encontrar duplicatas por CPF, CNPJ ou Nome
    const { data, error } = await supabase.rpc('get_duplicate_contatos');

    if (error) {
      throw error;
    }

    // Estruturar os dados agrupados
    const duplicates = data.reduce((acc, curr) => {
      const key = curr.duplicate_key;
      if (!acc[key]) {
        acc[key] = {
          type: curr.duplicate_type,
          value: key,
          contatos: [],
        };
      }
      acc[key].contatos.push(curr.contato_details);
      return acc;
    }, {});

    return new Response(JSON.stringify(Object.values(duplicates)), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}