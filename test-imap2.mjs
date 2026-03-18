import { createClient } from '@supabase/supabase-js';
import imapSimple from 'imap-simple';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // get user configs
    const { data: configs } = await supabase.from('email_configuracoes').select('*');
    if (!configs || configs.length === 0) return console.log("No config");
    
    const config = configs.find(c => c.email.includes('rannierecampos'));
    if (!config) return console.log("Account not found");
    
    console.log("Checking config:", config.email);
    const imapConfig = {
        imap: {
            user: config.imap_user || config.email,
            password: config.senha_app,
            host: config.imap_host,
            port: config.imap_port || 993,
            tls: true,
            authTimeout: 20000,
            tlsOptions: { rejectUnauthorized: false }
        },
    };
    try {
        const connection = await imapSimple.connect(imapConfig);
        const boxes = await connection.getBoxes();
        
        let trashFolder = null;
        const findTrash = (boxList, prefix = '') => {
            for (let [key, value] of Object.entries(boxList)) {
                const path = prefix ? prefix + (value.delimiter || '/') + key : key;
                if (path.toUpperCase().includes('TRASH') || path.toUpperCase().includes('LIXEIRA') || path.toUpperCase().includes('DELETED')) {
                    trashFolder = path;
                }
                if (value.children) findTrash(value.children, path);
            }
        };
        findTrash(boxes);
        
        if (!trashFolder) {
            console.log("No trash folder for this account");
            connection.end();
            return;
        }
        console.log("Opening Trash:", trashFolder);
        await connection.openBox(trashFolder, { readOnly: false });
        const messages = await connection.search(['ALL'], { bodies: ['HEADER.FIELDS (MESSAGE-ID)'], markSeen: false });
        console.log("Messages in trash before:", messages.length);
        
        if (messages.length > 0) {
            const uids = messages.map(m => m.attributes.uid);
            console.log("Adding Deleted flag to uids length:", uids.length);
            
            // Chunking UIDs if needed
            await connection.addFlags(uids, '\\Deleted');
            console.log("Flags added. Expunging...");
            
            await new Promise((resolve, reject) => {
                if (connection.imap.serverSupports('UIDPLUS')) {
                    console.log("Using UID EXPUNGE");
                    connection.imap.expunge(uids, (err) => {
                        if (err) reject(err); else resolve();
                    });
                } else {
                    console.log("Using standard EXPUNGE");
                    connection.imap.expunge((err) => {
                        if (err) reject(err); else resolve();
                    });
                }
            });
            console.log("Expunged successfully.");
            
            const remaining = await connection.search(['ALL'], { bodies: ['HEADER.FIELDS (MESSAGE-ID)'], markSeen: false });
            console.log("Messages MUST BE REMOVED NOW. Remaining in trash after expunge:", remaining.length);
        }
        
        connection.end();
    } catch(e) {
        console.log("Error:", e);
    }
}
run();
