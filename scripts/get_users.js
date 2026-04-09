require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getUsers() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (users) {
      const u103 = users.users.find(u => u.id === 'e48b4e12-afa9-4672-b56b-45e5c9a8fd5a');
      const u104 = users.users.find(u => u.id === 'd7f4fa0d-419d-4950-adb3-ba2ebaa1527f');
      console.log('User 1:', u103?.raw_user_meta_data?.name || u103?.email);
      console.log('User 2:', u104?.raw_user_meta_data?.name || u104?.email);
  } else {
      console.error(error);
  }
}
getUsers();
