import { createClient } from "@supabase/supabase-js"
import Link from "next/link"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
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

  // Query all clients
  const { data: clients, error } = await supabase
    .from('sistema-dash-ia_clientes')
    .select('*')
    .order('created_at', { ascending: false })

  const totalClients = clients?.length || 0
  const activeClients = clients?.filter(c => c.active).length || 0

  return (
    <div className="flex h-full flex-col sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Visão Geral</h1>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full mb-8">
        <div className="rounded-xl border bg-white text-gray-900 shadow-sm p-6 border-l-4 border-l-indigo-600">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-gray-500">Total de Clientes (SaaS)</h3>
          </div>
          <div className="text-3xl font-bold">{totalClients}</div>
        </div>
        <div className="rounded-xl border bg-white text-gray-900 shadow-sm p-6 border-l-4 border-l-emerald-500">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-gray-500">Clientes Ativos</h3>
          </div>
          <div className="text-3xl font-bold">{activeClients}</div>
        </div>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Clientes Recentes</h3>
          <Link href="/admin/clientes" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            Ver todos &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cadastrado em
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients && clients.slice(0, 5).map((client) => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {client.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${client.active ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-red-50 text-red-700 ring-red-600/10"}`}>
                      {client.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(client.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {!clients?.length && (
                 <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                    Nenhum cliente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
