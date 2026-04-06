const fs = require('fs');
let code = fs.readFileSync('components/configuracoes/GerenciadorMateriais.js', 'utf8');

// Replace RPC call
code = code.replace(
  /await supabase\.rpc\('unificar_materiais', \{ old_material_id: oldId, new_material_id: selectedTarget\.id \}\);/g,
  "await supabase.rpc('unificar_materiais_final', { p_material_antigo_id: oldId, p_material_novo_id: selectedTarget.id });"
);

// Replace Toast RLS/Supabase string
code = code.replace(
  /toast\.error\('Falha RLS\/Supabase: ' \+ error\.message\);/g,
  "toast.error('Falha de RPC Supabase: ' + (error?.message || JSON.stringify(error)));\n      console.error(error);"
);

fs.writeFileSync('components/configuracoes/GerenciadorMateriais.js', code);
console.log('patched');
