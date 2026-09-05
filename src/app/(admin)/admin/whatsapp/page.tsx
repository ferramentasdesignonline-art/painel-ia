import { createClient } from "@supabase/supabase-js"
import { WhatsAppMonitor } from "@/components/admin/WhatsAppMonitor"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminWhatsAppPage() {
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

  const { data: clients } = await supabase
    .from('sistema-dash-ia_clientes')
    .select('id, nome, slug, active')
    .order('active', { ascending: false })
    .order('created_at', { ascending: false })

  return <WhatsAppMonitor clients={clients || []} />
}
