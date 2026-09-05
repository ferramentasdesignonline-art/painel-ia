"use client"

import { useState, useCallback } from "react"
import { Smartphone, RefreshCw, Clock } from "lucide-react"
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

  const handleRefreshAll = () => {
    setRefreshTrigger(prev => prev + 1)
    setLastUpdated(new Date())
  }

  const handleChildUpdated = useCallback(() => {
    // Optionally update the lastUpdated time whenever any child auto-updates
    setLastUpdated(new Date())
  }, [])

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

        <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm w-full sm:w-auto justify-center"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {clients?.map((client) => (
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
        
        {!clients?.length && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>
    </div>
  )
}
