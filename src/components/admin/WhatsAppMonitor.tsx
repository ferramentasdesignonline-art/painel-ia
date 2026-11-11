"use client"

import { useState, useCallback, useMemo } from "react"
import { Smartphone, RefreshCw, Clock, Search, X } from "lucide-react"
import { WhatsAppStatusCard } from "@/components/admin/WhatsAppStatusCard"

type ClientData = {
  id: string
  nome: string
  slug: string
  active: boolean
}

export function WhatsAppMonitor({ clients }: { clients: ClientData[] }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [searchTerm, setSearchTerm] = useState("")

  const handleRefreshAll = () => {
    setRefreshTrigger(prev => prev + 1)
    setLastUpdated(new Date())
  }

  const handleChildUpdated = useCallback(() => {
    setLastUpdated(new Date())
  }, [])

  // Ordenação alfabética padrão (A-Z) e filtro de busca
  const clientesFiltrados = useMemo(() => {
    let list = [...(clients || [])]
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      list = list.filter(c => (c.nome || "").toLowerCase().includes(term) || (c.slug || "").toLowerCase().includes(term))
    }
    return list.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }))
  }, [clients, searchTerm])

  return (
    <div className="p-4 sm:p-8 font-poppins max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-indigo-600" />
            Monitor de WhatsApp
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Visão geral do status de conexão das IAs de todos os clientes.</p>
        </div>

        <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm w-full sm:w-auto justify-center cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Todos
          </button>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            Última att: {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa de Cliente */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Pesquisar cliente no monitor por nome ou slug..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {clientesFiltrados.map((client) => (
          <WhatsAppStatusCard 
            key={client.id}
            clientId={client.id}
            clientName={client.nome}
            clientSlug={client.slug}
            active={client.active}
            refreshTrigger={refreshTrigger}
            onUpdated={handleChildUpdated}
          />
        ))}
        
        {clientesFiltrados.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            {searchTerm ? `Nenhum cliente encontrado para "${searchTerm}".` : "Nenhum cliente encontrado."}
          </div>
        )}
      </div>
    </div>
  )
}
