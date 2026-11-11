import { createClient } from "@supabase/supabase-js"
import { ClientesManager } from "@/components/admin/ClientesManager"
import { getNocoDBClientes } from "@/lib/nocodb/sistema"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ClientesPage() {
  let clients: any[] = []

  // 1. Tenta carregar do NocoDB primeiro
  try {
    clients = await getNocoDBClientes()
  } catch (err) {
    console.warn("Erro ao buscar clientes no NocoDB, tentando fallback Supabase:", err)
  }

  // 2. Fallback para Supabase se NocoDB estiver vazio
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

    const { data: supabaseClients } = await supabase
      .from('sistema-dash-ia_clientes')
      .select('*')
      .order('nome', { ascending: true })

    clients = supabaseClients || []
  }

  return (
    <div className="p-4 sm:p-8 font-poppins max-w-7xl mx-auto">
      <ClientesManager initialClients={clients || []} />
    </div>
  )
}
