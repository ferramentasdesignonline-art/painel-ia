"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Plus, Search, ArrowUpDown, Building2, CheckCircle2, XCircle, Bot, UserCheck, X } from "lucide-react"
import { ClientActions } from "@/components/admin/ClientActions"
import { cn } from "@/lib/utils"

interface ClientesManagerProps {
  initialClients: any[]
}

type OrderType = "az" | "za" | "recentes" | "antigos"
type StatusFilter = "todos" | "ativos" | "inativos" | "com_ia" | "sem_ia"

export function ClientesManager({ initialClients }: ClientesManagerProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [ordem, setOrdem] = useState<OrderType>("az")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos")

  // Filtragem e Ordenação
  const filteredAndSortedClients = useMemo(() => {
    let list = [...(initialClients || [])]

    // 1. Filtro de Busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      list = list.filter((c) => {
        const nome = String(c.nome || "").toLowerCase()
        const slug = String(c.slug || "").toLowerCase()
        const email = String(c.email || "").toLowerCase()
        const instancia = String(c.nome_instancia || "").toLowerCase()
        const tabelaLeads = String(c.tabela_leads || "").toLowerCase()
        return (
          nome.includes(term) ||
          slug.includes(term) ||
          email.includes(term) ||
          instancia.includes(term) ||
          tabelaLeads.includes(term)
        )
      })
    }

    // 2. Filtro de Status / Tipo
    if (statusFilter === "ativos") {
      list = list.filter((c) => Boolean(c.active))
    } else if (statusFilter === "inativos") {
      list = list.filter((c) => !Boolean(c.active))
    } else if (statusFilter === "com_ia") {
      list = list.filter((c) => c.tipo_atendimento !== "sem_ia")
    } else if (statusFilter === "sem_ia") {
      list = list.filter((c) => c.tipo_atendimento === "sem_ia")
    }

    // 3. Ordenação (Padrão: A-Z)
    list.sort((a, b) => {
      if (ordem === "az") {
        return (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
      }
      if (ordem === "za") {
        return (b.nome || "").localeCompare(a.nome || "", "pt-BR", { sensitivity: "base" })
      }
      if (ordem === "recentes") {
        const tA = new Date(a.created_at || a.CreatedAt || 0).getTime()
        const tB = new Date(b.created_at || b.CreatedAt || 0).getTime()
        return tB - tA
      }
      if (ordem === "antigos") {
        const tA = new Date(a.created_at || a.CreatedAt || 0).getTime()
        const tB = new Date(b.created_at || b.CreatedAt || 0).getTime()
        return tA - tB
      }
      return 0
    })

    return list
  }, [initialClients, searchTerm, ordem, statusFilter])

  // Contadores para as pílulas
  const totalGeral = initialClients?.length || 0
  const totalAtivos = useMemo(() => (initialClients || []).filter((c) => Boolean(c.active)).length, [initialClients])
  const totalInativos = totalGeral - totalAtivos

  return (
    <div className="space-y-6">
      {/* Topo: Título + Botão Novo Cliente */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2.5 font-poppins">
            <Building2 className="w-8 h-8 text-indigo-600" />
            Clientes
            <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">
              {totalGeral}
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie todas as concessionárias e clientes cadastrados no sistema.
          </p>
        </div>

        <Link
          href="/admin/clientes/novo"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center transition-all shadow-sm hover:shadow w-full sm:w-auto justify-center cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Link>
      </div>

      {/* Barra de Filtros: Campo de Pesquisa + Seletor de Ordenação + Filtros Rápidos */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Input de Busca em tempo real */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome da concessionária, slug ou email..."
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" /> Ordem:
            </span>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrderType)}
              className="py-2.5 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="az">A-Z (Alfabética)</option>
              <option value="za">Z-A</option>
              <option value="recentes">Mais recentes</option>
              <option value="antigos">Mais antigos</option>
            </select>
          </div>
        </div>

        {/* Pílulas de Filtro de Status */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setStatusFilter("todos")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap",
              statusFilter === "todos"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            )}
          >
            Todos ({totalGeral})
          </button>

          <button
            onClick={() => setStatusFilter("ativos")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "ativos"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60"
            )}
          >
            <CheckCircle2 className="w-3 h-3" />
            Ativos ({totalAtivos})
          </button>

          <button
            onClick={() => setStatusFilter("inativos")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "inativos"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60"
            )}
          >
            <XCircle className="w-3 h-3" />
            Inativos ({totalInativos})
          </button>

          <button
            onClick={() => setStatusFilter("com_ia")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "com_ia"
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/60"
            )}
          >
            <Bot className="w-3 h-3" />
            Com IA
          </button>

          <button
            onClick={() => setStatusFilter("sem_ia")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "sem_ia"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60"
            )}
          >
            <UserCheck className="w-3 h-3" />
            Sem IA (Cloud)
          </button>

          <span className="ml-auto text-xs text-gray-400 font-medium pl-2 hidden sm:inline">
            Mostrando {filteredAndSortedClients.length} de {totalGeral} clientes
          </span>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white shadow-sm ring-1 ring-black/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left sm:pl-6">
                  Empresa / Concessionária
                </th>
                <th scope="col" className="px-3 py-3.5 text-left">
                  Email
                </th>
                <th scope="col" className="px-3 py-3.5 text-left">
                  Status
                </th>
                <th scope="col" className="px-3 py-3.5 text-left">
                  Tipo & Tabelas DB
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-sm">
              {filteredAndSortedClients.map((client) => (
                <tr key={client.id} className="hover:bg-indigo-50/30 transition-colors">
                  {/* Empresa e Slug */}
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                    <div className="font-bold text-gray-900 hover:text-indigo-600 transition-colors">
                      {client.nome}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">/{client.slug}</div>
                  </td>

                  {/* Email */}
                  <td className="whitespace-nowrap px-3 py-4 text-gray-600 text-xs">
                    {client.email || "-"}
                  </td>

                  {/* Status Ativo / Inativo */}
                  <td className="whitespace-nowrap px-3 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                        client.active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", client.active ? "bg-emerald-500" : "bg-rose-500")} />
                      {client.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>

                  {/* Tipo & Tabelas */}
                  <td className="whitespace-nowrap px-3 py-4 text-xs">
                    {client.tipo_atendimento === "sem_ia" ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          👤 Sem IA (Humano)
                        </span>
                        <div className="text-[11px] text-gray-500 font-mono">
                          Instância: <strong>{client.nome_instancia || "Padrão"}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          🤖 Com IA
                        </span>
                        <div className="text-[11px] text-gray-500 font-mono">
                          Leads: <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">{client.tabela_leads || "-"}</code>
                        </div>
                        {client.tabela_bloqueios && (
                          <div className="text-[11px] text-gray-400 font-mono">
                            Bloqueios: <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">{client.tabela_bloqueios}</code>
                          </div>
                        )}
                      </div>
                    )}
                    {Boolean(client.modulo_bancos_habilitado) && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🏦 Bancos Credere: {client.credere_store_id ? `#${client.credere_store_id}` : "Sem loja vinculada"}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Ações: Copiar Login / Acessar Conta / Menu */}
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right sm:pr-6">
                    <ClientActions client={client} />
                  </td>
                </tr>
              ))}

              {filteredAndSortedClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-gray-400">
                    {searchTerm ? (
                      <div className="space-y-2">
                        <p className="font-semibold text-gray-600">Nenhum cliente encontrado para "{searchTerm}"</p>
                        <button
                          onClick={() => setSearchTerm("")}
                          className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                        >
                          Limpar pesquisa
                        </button>
                      </div>
                    ) : (
                      "Nenhum cliente cadastrado nesta categoria."
                    )}
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
