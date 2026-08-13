import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function debug() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('--- DEBUG DATABASE ---')

  const { data: clients } = await supabase.from('duo-mkt-concessionaria-saas_clientes').select('*')
  console.log('Clientes:', clients?.map(c => ({ id: c.id, email: c.email })))

  const { data: funnels } = await supabase.from('duo-mkt-concessionaria-saas_funis').select('*')
  console.log('Funis:', funnels)

  const { data: stages } = await supabase.from('duo-mkt-concessionaria-saas_etapas_funil').select('*')
  console.log('Etapas (total no DB):', stages?.length || 0)
  
  if (funnels && funnels.length > 0) {
    const funnelId = funnels[0].id
    const { data: stagesOfFunnel } = await supabase
      .from('duo-mkt-concessionaria-saas_etapas_funil')
      .select('*')
      .eq('funil_id', funnelId)
    console.log(`Etapas do Funil ${funnelId}:`, stagesOfFunnel?.length || 0)
  }
}

debug()
