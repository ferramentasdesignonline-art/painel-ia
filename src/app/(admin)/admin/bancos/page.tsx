import { createClient } from "@supabase/supabase-js"
import { AdminBancosManager } from "@/components/admin/AdminBancosManager"
import { getNocoDBClientes } from "@/lib/nocodb/sistema"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminBancosPage() {
  let clients: any[] = []

  // 1. Carrega clientes do NocoDB primeiro
  try {
    clients = await getNocoDBClientes()
  } catch (err) {
    console.warn("Erro ao buscar clientes no NocoDB, tentando fallback Supabase:", err)
  }

  // 2. Fallback para Supabase se NocoDB falhar
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

  // Filtra apenas concessionárias com módulo de bancos habilitado
  const bankClients = (clients || []).filter((c) => Boolean(c.modulo_bancos_habilitado))

  return (
    <div className="p-4 sm:p-8 font-poppins max-w-7xl mx-auto">
      <AdminBancosManager clients={bankClients} />
    </div>
  )
}
