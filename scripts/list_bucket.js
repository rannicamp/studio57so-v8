require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles() {
    const { data, error } = await supabase.storage.from('empresa-anexos').list('4/', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
    });
    
    if (error) {
        console.error("Error listing bucket:", error);
    } else {
        console.log("Bucket objects:", data.map(d => d.name));
    }
}

listFiles();
