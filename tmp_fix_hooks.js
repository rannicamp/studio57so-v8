const fs = require('fs');

let file = fs.readFileSync('components/chat/ChatHooks.js', 'utf8');

const replace = `export function useMarkAsRead() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
      const { error } = await supabase.rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_conversations_list'] });
    }
  });
}`;

const regex = /export function useMarkAsRead\(\) \{[\s\S]*?mutationFn: async \(\{ conversationId, userId \}\) => \{[\s\S]*?\}\r?\n\s*\}\);\r?\n\}/;
if (regex.test(file)) {
    fs.writeFileSync('components/chat/ChatHooks.js', file.replace(regex, replace));
    console.log('Fixed through regex!');
} else {
    console.error('Failed completely');
}
