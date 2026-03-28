
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: conv } = await supabase.from("instagram_conversations").select("*").eq("id", 27).single();
    const { data: integracao } = await supabase.from("integracoes_meta").select("page_access_token").eq("organizacao_id", 2).single();
    
    // 1. Fetch conversations
    const urlConvs = `https://graph.instagram.com/v21.0/${conv.instagram_account_id}/conversations?platform=instagram&fields=id,participants,snippet,unread_count,updated_time&access_token=${integracao.page_access_token}`;
    const resConvs = await fetch(urlConvs);
    const dataConvs = await resConvs.json();
    console.log("Conversations API snippet:", dataConvs.data[0]);

    // 2. Fetch messages
    const urlMsgs = `https://graph.instagram.com/v21.0/${conv.instagram_conversation_id}/messages?fields=id,message,from,created_time&access_token=${integracao.page_access_token}`;
    const resMsgs = await fetch(urlMsgs);
    const dataMsgs = await resMsgs.json();
    console.log("Messages API snippet:", JSON.stringify(dataMsgs, null, 2));
}

run();
