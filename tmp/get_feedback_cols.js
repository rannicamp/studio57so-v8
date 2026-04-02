require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.from('feedback').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log('No rows in feedback table');
  }
}
run();
