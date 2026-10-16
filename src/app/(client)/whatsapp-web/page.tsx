import { getActiveClientConfig } from "@/lib/auth/helpers"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getWacloudSupabaseAdmin } from "@/lib/wacloud/supabase"
import { ChatInstancia } from "@/app/(admin)/admin/whatsapp-cloud/_components/ConversasTab"
import { MessageSquare, AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

function normalize(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
}

export default async function WhatsAppWebPage() {
  const cookieStore = cookies()
  const supabaseSession = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const clientConfig = await getActiveClientConfig(supabaseSession)

  if (!clientConfig) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-gray-800">Cliente não identificado</h2>
        <p className="text-sm text-gray-500 mt-1">Faça login com sua conta para acessar o WhatsApp Web.</p>
      </div>
    )
  }

  // Buscar instâncias da Uazapi/Wacloud cadastradas
  const supabaseAdmin = getWacloudSupabaseAdmin()
  const { data: instances } = await supabaseAdmin
    .from("wacloud_instancias")
    .select("id, nome_instancia, status, token, cliente_id")

  const clientNameNormalized = normalize(clientConfig.nome || "")
  const clientSlugNormalized = normalize(clientConfig.slug || "")
  const clientInstanciaNormalized = normalize(clientConfig.whatsapp_instancia || "")

  const instance = instances?.find((inst: any) => {
    // 1. Vínculo direto por cliente_id se existir
    if (inst.cliente_id && (inst.cliente_id === clientConfig.id || inst.cliente_id === clientConfig.auth_user_id)) {
      return true
    }

    const instNormalized = normalize(inst.nome_instancia || "")

    // 2. Por nome da instância configurada
    if (clientInstanciaNormalized && instNormalized === clientInstanciaNormalized) {
      return true
    }

    // 3. Por nome do cliente
    if (clientNameNormalized && (instNormalized === clientNameNormalized || instNormalized.includes(clientNameNormalized) || clientNameNormalized.includes(instNormalized))) {
      return true
    }

    // 4. Por slug
    if (clientSlugNormalized && (instNormalized === clientSlugNormalized || instNormalized.includes(clientSlugNormalized))) {
      return true
    }

    return false
  })

  if (!instance) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm mt-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
          <MessageSquare className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-gray-900 tracking-tight">Instância do WhatsApp não encontrada</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Não localizamos uma conexão ativa do WhatsApp associada a <strong>{clientConfig.nome}</strong>. Entre em contato com o administrador para configurar sua instância.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-[620px] h-[calc(100vh-125px)] pb-2">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">WhatsApp Web</h1>
          <p className="text-xs text-gray-500">
            Gerencie conversas em tempo real, responda clientes, visualize e aplique etiquetas.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-200/90 shadow-sm p-3 sm:p-4 overflow-hidden flex flex-col">
        <ChatInstancia instancia={instance} />
      </div>
    </div>
  )
}
