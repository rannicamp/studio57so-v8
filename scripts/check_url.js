require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUrl() {
    const { data } = await supabase
        .from('empresa_anexos')
        .select('*')
        .eq('id', 25)
        .single();
        
    const url = supabase.storage.from('empresa-anexos').getPublicUrl(data.caminho_arquivo).data.publicUrl;
    console.log("Public URL:", url);
    
    // Test fetch
    const fetch = require('node-fetch');
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get('content-type'));
    console.log("Content-Disposition:", res.headers.get('content-disposition'));
}

checkUrl();
