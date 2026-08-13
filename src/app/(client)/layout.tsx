import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { AdminBar } from "@/components/layout/AdminBar"
import { getActiveClientConfig, getUserRole } from "@/lib/auth/helpers"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const supabase = createServerClient(
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

  const { role } = await getUserRole(supabase)
  const isImpersonating = role === 'master_admin' && !!cookieStore.get("impersonating_client_id")?.value
  const clientConfig = await getActiveClientConfig(supabase)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {isImpersonating && clientConfig && <AdminBar clientName={clientConfig.nome} />}
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 w-full overflow-hidden">
          <Header clientName={clientConfig?.nome} clientEmail={clientConfig?.email} />
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
