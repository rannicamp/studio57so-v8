require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findFiles() {
    const { data: d1 } = await supabase.storage.from('empresas').list('4/', { limit: 100 });
    console.log("empresas 4/:", d1);
}

findFiles();
