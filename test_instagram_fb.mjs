
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: conv } = await supabase.from("instagram_conversations").select("*").eq("id", 27).single();
    const { data: integracao } = await supabase.from("integracoes_meta").select("page_access_token").eq("organizacao_id", 2).single();
    
    const urlMsgs = `https://graph.facebook.com/v21.0/${conv.instagram_conversation_id}?fields=messages{id,message,from,created_time}&access_token=${integracao.page_access_token}`;
    const resMsgs = await fetch(urlMsgs);
    const dataMsgs = await resMsgs.json();
    console.log("Thread API direct from FB URL:", JSON.stringify(dataMsgs, null, 2));

    const urlMsgs2 = `https://graph.facebook.com/v21.0/${conv.instagram_conversation_id}/messages?fields=id,message,from,created_time&access_token=${integracao.page_access_token}`;
    const resMsgs2 = await fetch(urlMsgs2);
    const dataMsgs2 = await resMsgs2.json();
    console.log("Messages Edge FB URL:", JSON.stringify(dataMsgs2.data?.slice(0, 1), null, 2));
}

run();
