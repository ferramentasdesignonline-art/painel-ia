import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { Plus } from "lucide-react"
import { ClientActions } from "@/components/admin/ClientActions"
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
      .order('created_at', { ascending: false })

    clients = supabaseClients || []
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-2">Gerencie todas as concessionárias do sistema.</p>
        </div>
        <Link 
          href="/admin/clientes/novo" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium flex items-center transition-colors w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cliente
        </Link>
      </div>

      <div className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Empresa</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tabelas DB</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {clients && clients.map((client) => (
              <tr key={client.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div className="font-medium text-gray-900">{client.nome}</div>
                  <div className="text-gray-500">/{client.slug}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{client.email}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${client.active ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-red-50 text-red-700 ring-red-600/10"}`}>
                    {client.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {client.tipo_atendimento === 'sem_ia' ? (
                    <div>
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 mb-1">
                        👤 Sem IA (Humano)
                      </span>
                      <div className="text-xs text-gray-600 font-mono">
                        Instância: <strong>{client.nome_instancia || 'Padrão'}</strong>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 mb-1">
                        🤖 Com IA
                      </span>
                      <div className="text-xs text-gray-500">Leads: <code className="bg-gray-100 px-1 rounded">{client.tabela_leads || '-'}</code></div>
                      <div className="text-xs mt-0.5 text-gray-500">Bloqueios: <code className="bg-gray-100 px-1 rounded">{client.tabela_bloqueios || '-'}</code></div>
                    </div>
                  )}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <ClientActions client={{ id: client.id, active: client.active }} />
                </td>
              </tr>
            ))}
            {!clients?.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                  Nenhum cliente cadastrado. Clique no botão acima para adicionar um novo cliente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
