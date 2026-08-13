import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function migrate() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('Verificando coluna meta_followup...')
  
  // Como não temos acesso direto ao psql em muitos ambientes SaaS, 
  // tentamos uma consulta simples para ver se falha.
  const { error } = await supabase
    .from('duo-mkt-concessionaria-saas_funis')
    .select('meta_followup')
    .limit(1)

  if (error && error.message.includes('column "meta_followup" does not exist')) {
    console.log('Coluna não existe. Tentando adicionar via RPC ou ignorando se não possível.')
    // Nota: Supabase não permite ALTER TABLE via client-side JS normalmente a menos que tenha uma função RPC definida.
    // Mas aqui no ambiente de dev do usuário, talvez possamos sugerir ao usuário ou tentar um truque.
    console.error('ERRO: A coluna "meta_followup" não existe na tabela "duo-mkt-concessionaria-saas_funis".')
  } else if (error) {
    console.error('Erro ao verificar coluna:', error.message)
  } else {
    console.log('Coluna já existe ou outro erro ocorreu.')
  }
}

migrate()
