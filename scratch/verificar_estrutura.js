const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Erro: Variáveis do Supabase não encontradas no process.env!");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Verificar colunas da tabela funcionarios
  console.log("Buscando primeira linha de 'funcionarios'...");
  const { data: func, error: errFunc } = await supabase.from('funcionarios').select('*').limit(1);
  if (errFunc) {
    console.error("Erro funcionarios:", errFunc);
  } else {
    console.log("Funcionarios colunas:", Object.keys(func[0] || {}));
    console.log("Exemplo funcionario:", func[0]);
  }

  // 2. Verificar colunas da tabela contatos
  console.log("\nBuscando primeira linha de 'contatos'...");
  const { data: cont, error: errCont } = await supabase.from('contatos').select('*').limit(1);
  if (errCont) {
    console.error("Erro contatos:", errCont);
  } else {
    console.log("Contatos colunas:", Object.keys(cont[0] || {}));
    console.log("Exemplo contato:", cont[0]);
  }

  // 3. Verificar se existe a tabela clientes
  console.log("\nBuscando primeira linha de 'clientes'...");
  const { data: cli, error: errCli } = await supabase.from('clientes').select('*').limit(1);
  if (errCli) {
    console.log("Clientes não é uma tabela direta ou deu erro:", errCli.message);
  } else {
    console.log("Clientes colunas:", Object.keys(cli[0] || {}));
  }
}

main().catch(console.error);
