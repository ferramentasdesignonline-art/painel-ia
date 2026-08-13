import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function check() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await supabase
    .from('duo-mkt-concessionaria-saas_funis')
    .select('id, meta_followup')
    .limit(1)

  if (error) {
    console.log('API_ERROR_MESSAGE:', error.message)
    console.log('API_ERROR_CODE:', error.code)
  } else {
    console.log('SUCCESS: Column exists')
  }
}

check()
