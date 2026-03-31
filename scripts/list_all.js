require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles() {
    const { data: root, error } = await supabase.storage.from('empresa-anexos').list('', { limit: 100 });
    console.log("Root objects/folders:", root);
    
    const { data: q, error: e } = await supabase.storage.from('empresa-anexos').list('4/', { limit: 100 });
    console.log("4/ objects:", q);
}

listFiles();
