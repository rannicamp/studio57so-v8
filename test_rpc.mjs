import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function getRPC() {
    const { data, error } = await supabase.rpc('exec_sql', {
        query: "SELECT prosrc FROM pg_proc WHERE proname = 'get_ai_context_data';"
    })
    
    if (error) {
        console.error("Error executing query:", error)
    } else {
        console.log(data)
    }
}

getRPC()
