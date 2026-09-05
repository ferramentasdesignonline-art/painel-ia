import { createClient } from "@supabase/supabase-js"
import { Smartphone } from "lucide-react"
import { WhatsAppStatusCard } from "@/components/admin/WhatsAppStatusCard"

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

  return (
    <div className="p-4 sm:p-8 font-poppins">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-indigo-600" />
            Monitor de WhatsApp
          </h1>
          <p className="text-gray-500 mt-2">Visão geral do status de conexão das IAs de todos os clientes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {clients?.map((client) => (
          <WhatsAppStatusCard 
            key={client.id}
            clientId={client.id}
            clientName={client.nome}
            clientSlug={client.slug}
            active={client.active}
          />
        ))}
        
        {!clients?.length && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>
    </div>
  )
}
