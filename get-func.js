require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

supabase.rpc('query', { query_text: "SELECT pg_get_functiondef('fn_vincular_lancamento_fatura'::regproc)" })
    .then(r => console.log(r.data ? r.data[0].pg_get_functiondef : r.error));
