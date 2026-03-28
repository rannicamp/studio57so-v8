
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: conv } = await supabase.from("instagram_conversations").select("*").eq("id", 27).single();
    const { data: integracao } = await supabase.from("integracoes_meta").select("page_access_token").eq("organizacao_id", 2).single();
    
    const urlMsgs = `https://graph.instagram.com/v21.0/${conv.instagram_conversation_id}?fields=messages{id,message,from,created_time},snippet,unread_count&access_token=${integracao.page_access_token}`;
    const resMsgs = await fetch(urlMsgs);
    const dataMsgs = await resMsgs.json();
    console.log("Thread API:", JSON.stringify(dataMsgs, null, 2));
}

run();
