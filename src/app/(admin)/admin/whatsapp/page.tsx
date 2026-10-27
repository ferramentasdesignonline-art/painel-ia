import { createClient } from "@supabase/supabase-js"
import { WhatsAppMonitor } from "@/components/admin/WhatsAppMonitor"
import { getNocoDBClientes } from "@/lib/nocodb/sistema"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminWhatsAppPage() {
  let clients: any[] = []

  // 1. Tenta buscar no NocoDB
  try {
    clients = await getNocoDBClientes()
  } catch (err) {
    console.warn("Erro ao buscar clientes no NocoDB para monitor WhatsApp:", err)
  }

  // 2. Fallback Supabase
  if (!clients || clients.length === 0) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: sbClients } = await supabase
      .from('sistema-dash-ia_clientes')
      .select('id, nome, slug, active')
      .order('active', { ascending: false })
      .order('created_at', { ascending: false })

    clients = sbClients || []
  }

  return <WhatsAppMonitor clients={clients || []} />
}
