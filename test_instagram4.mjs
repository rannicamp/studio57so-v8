
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: integracao } = await supabase.from("integracoes_meta").select("instagram_business_account_id, page_access_token").eq("organizacao_id", 2).single();
    
    // Fetch conversations WITH messages
    const urlMsgs = `https://graph.instagram.com/v21.0/${integracao.instagram_business_account_id}/conversations?platform=instagram&fields=id,messages.limit(2){id,message,from,created_time},participants,updated_time&access_token=${integracao.page_access_token}`;
    const resMsgs = await fetch(urlMsgs);
    const dataMsgs = await resMsgs.json();
    console.log("Thread API direct from IG ID:", JSON.stringify(dataMsgs.data[0], null, 2));
}

run();
