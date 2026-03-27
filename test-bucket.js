const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBucket() {
    const { data } = await supabase.storage.getBucket('funcionarios-documentos');
    if (data) {
        console.log("Bucket config:", data);
        console.log("É público?", data.public);
    } else {
        console.log("Could not load bucket info");
    }
}

checkBucket();
