
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: conv } = await supabase.from("instagram_conversations").select("*").eq("id", 27).single();
    const { data: integracao } = await supabase.from("integracoes_meta").select("instagram_business_account_id, page_access_token").eq("organizacao_id", 2).single();
    
    // Fetch specific conversation
    const urlMsgs = `https://graph.instagram.com/v21.0/${integracao.instagram_business_account_id}/conversations?platform=instagram&user_id=${conv.participant_id}&fields=id,messages.limit(10){id,message,from,created_time},participants,updated_time&access_token=${integracao.page_access_token}`;
    const resMsgs = await fetch(urlMsgs);
    const dataMsgs = await resMsgs.json();
    console.log("Thread API direct by user_id:", JSON.stringify(dataMsgs, null, 2));
}

run();
