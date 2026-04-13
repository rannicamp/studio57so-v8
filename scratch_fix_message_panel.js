const fs = require('fs');
let content = fs.readFileSync('components/whatsapp/MessagePanel.js', 'utf8');

// Replace onSuccess for sendMessageMutation
content = content.replace(/onSuccess: \(\) => \{\s*setNewMessage\(''\);\s*queryClient\.invalidateQueries\(\{ queryKey: \['messages', organizacaoId, contact\?\.contato_id\] \}\);\s*\}/, `onSuccess: () => {
 setNewMessage('');
 queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
 queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
}`);

// Replace onSuccess for sendAttachmentMutation
content = content.replace(/onSuccess: \(\) => \{\s*queryClient\.invalidateQueries\(\{ queryKey: \['messages', organizacaoId, contact\?\.contato_id\] \}\);\s*\}/g, `onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
 queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
}`);

// Replace onSuccess for sendLocationMutation
content = content.replace(/onSuccess: \(\) => \{\s*toast\.success\("Localização enviada!"\);\s*queryClient\.invalidateQueries\(\{ queryKey: \['messages', organizacaoId, contact\?\.contato_id\] \}\);\s*\}/, `onSuccess: () => {
 toast.success("Localização enviada!");
 queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
 queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
}`);

// Replace onSuccess for sendTemplateMutation
content = content.replace(/onSuccess: \(\) => \{\s*toast\.success\('Template enviado com sucesso!'\);\s*setIsTemplateModalOpen\(false\);\s*queryClient\.invalidateQueries\(\{ queryKey: \['messages', organizacaoId, contact\?\.contato_id\] \}\);\s*\}/, `onSuccess: () => {
 toast.success('Template enviado com sucesso!');
 setIsTemplateModalOpen(false);
 queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
 queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
}`);

fs.writeFileSync('components/whatsapp/MessagePanel.js', content);
