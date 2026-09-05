"use client"

import { useState, useEffect, useCallback } from "react"
import { Wifi, WifiOff, Loader2, RefreshCcw, Smartphone, AlertCircle } from "lucide-react"

type Props = {
  clientId: string
  clientName: string
  clientSlug: string
  active: boolean
}

export function WhatsAppStatusCard({ clientId, clientName, clientSlug, active }: Props) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!active) {
      setLoading(false)
      setError("Cliente Inativo")
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/whatsapp-status?clientId=${clientId}`)
      const data = await res.json()
      
      if (res.ok) {
        setStatus(data)
      } else {
        if (data.error === "No token") {
          setError("Sem Token")
        } else {
          setError(data.error || "Erro")
        }
      }
    } catch (err) {
      setError("Erro de Rede")
    } finally {
      setLoading(false)
    }
  }, [clientId, active])

  useEffect(() => {
    fetchStatus()
    
    // Atualiza a cada 5 minutos
    if (active) {
      const interval = setInterval(fetchStatus, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [fetchStatus, active])

  const isConnected = status?.status?.connected || status?.instance?.state === 'open'
  const isConnecting = status?.response === "Connecting" || status?.instance?.state === 'connecting'

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col h-full">
      <div className={`absolute top-0 left-0 w-1 h-full ${
        !active ? 'bg-gray-300' :
        error ? 'bg-red-400' :
        isConnected ? 'bg-green-500' : 
        isConnecting ? 'bg-amber-400' : 
        'bg-red-500'
      }`} />
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-gray-900 truncate max-w-[200px]" title={clientName}>{clientName}</h3>
          <p className="text-xs text-gray-500">/{clientSlug}</p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading || !active}
          className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
          title="Atualizar status"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
        </button>
      </div>

      <div className="mt-auto pt-4 flex items-center gap-3">
        {loading && !status ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verificando...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : (
          <div className={`flex items-center gap-2 text-sm font-bold ${
            isConnected ? 'text-green-600' : 
            isConnecting ? 'text-amber-500' : 
            'text-red-500'
          }`}>
            {isConnected ? (
              <><Wifi className="w-4 h-4" /> Conectado</>
            ) : isConnecting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Conectando</>
            ) : (
              <><WifiOff className="w-4 h-4" /> Desconectado</>
            )}
          </div>
        )}
      </div>
      
      {!loading && !error && status && (
        <div className="mt-3 bg-gray-50 rounded-lg p-2 text-[10px] text-gray-500 font-mono break-all line-clamp-1" title={status?.instance?.instanceName || '-'}>
          <Smartphone className="w-3 h-3 inline mr-1" />
          {status?.instance?.instanceName || 'Instância desconhecida'}
        </div>
      )}
    </div>
  )
}
