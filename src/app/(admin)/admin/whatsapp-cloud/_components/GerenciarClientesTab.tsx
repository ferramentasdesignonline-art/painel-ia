"use client"

import { useState, useEffect } from "react"
import { Plus, Loader2, QrCode, RefreshCcw, Wifi, WifiOff, Download } from "lucide-react"

export function GerenciarClientesTab() {
  const [instances, setInstances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState("")
  const [syncing, setSyncing] = useState<Record<string, string>>({})
  const [qrCodeData, setQrCodeData] = useState<{ id: string, base64: string, name: string } | null>(null)

  const fetchInstances = async () => {
    try {
      const res = await fetch("/api/wacloud/instances")
      const data = await res.json()
      if (data.instances) {
        setInstances(data.instances)
      }
    } catch (error) {
      console.error("Erro ao buscar instancias:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstances()
  }, [])

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newInstanceName.trim() || newInstanceName.includes(' ')) {
      alert("O nome da instância não pode conter espaços ou estar vazio.")
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch("/api/wacloud/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_instancia: newInstanceName.trim() })
      })
      const data = await res.json()
      
      if (res.ok) {
        setNewInstanceName("")
        await fetchInstances()
        // Após criar, já tenta conectar e pegar o QR
        // Precisamos achar a id da instancia recem criada
        const newRes = await fetch("/api/wacloud/instances")
        const newData = await newRes.json()
        const createdInstance = newData.instances?.find((i: any) => i.nome_instancia === data.instance.name)
        if (createdInstance) {
          await handleConnect(createdInstance.id, createdInstance.nome_instancia)
        }
      } else {
        alert(data.error || "Erro ao criar instância")
      }
    } catch (error) {
      alert("Erro de rede ao criar instância")
    } finally {
      setIsCreating(false)
    }
  }

  const handleConnect = async (id: string, name: string) => {
    try {
      // alert loading?
      const res = await fetch(`/api/wacloud/instances/${id}/connect`, { method: "POST" })
      const data = await res.json()
      if (res.ok && data.base64) {
        setQrCodeData({ id, base64: data.base64, name })
      } else if (res.ok && data.instance?.qrcode) {
         setQrCodeData({ id, base64: data.instance.qrcode, name })
      } else {
        alert("Erro. Resposta: " + JSON.stringify(data))
      }
    } catch (error) {
      alert("Erro de rede ao conectar")
    }
  }

  const handleCheckStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/wacloud/instances/${id}/status`)
      const data = await res.json()
      if (res.ok) {
        alert(`Status retornado: ${JSON.stringify(data.status || data.state || data)}`)
      }
    } catch (error) {
      alert("Erro ao verificar status")
    }
  }

  const handleSyncChats = async (id: string) => {
    setSyncing((s) => ({ ...s, [id]: "Iniciando..." }))
    try {
      let offset: number | null = 0
      let imported = 0
      let total = 0
      while (offset !== null) {
        const res: Response = await fetch(`/api/wacloud/instances/${id}/sync-chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        })
        const data: any = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao sincronizar")
        imported += data.processed || 0
        total = data.total || total
        setSyncing((s) => ({ ...s, [id]: `${imported}/${total} conversas...` }))
        offset = data.next_offset
      }
      alert(`Importação concluída: ${imported} conversas.`)
    } catch (e: any) {
      alert("Erro ao importar conversas: " + e.message)
    } finally {
      setSyncing((s) => {
        const copy = { ...s }
        delete copy[id]
        return copy
      })
    }
  }

  return (
    <div className="space-y-8">
      {/* Formulário de Criação */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Adicionar Novo Cliente (Instância)</h3>
        <form onSubmit={handleCreateInstance} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome da Instância (Sem espaços)</label>
            <input
              type="text"
              value={newInstanceName}
              onChange={(e) => setNewInstanceName(e.target.value.replace(/\s/g, ''))}
              placeholder="ex: AutoDesign"
              className="w-full h-11 px-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all font-medium"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isCreating || !newInstanceName.trim()}
            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Criar Instância
          </button>
        </form>
      </div>

      {/* Lista de Instâncias */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          Clientes Cadastrados
          <button onClick={fetchInstances} className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors">
            <RefreshCcw className="w-4 h-4" />
          </button>
        </h3>
        
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
        ) : instances.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-xl border border-gray-200 border-dashed text-gray-500 font-medium">
            Nenhuma instância cadastrada ainda.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instances.map((instance) => (
              <div key={instance.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-gray-900 text-lg truncate pr-4">{instance.nome_instancia}</h4>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-gray-100 text-gray-500">
                    {instance.status}
                  </span>
                </div>
                
                <p className="text-xs text-gray-400 mb-6 font-medium flex items-center gap-1">
                  Criado em: {new Date(instance.created_at).toLocaleDateString()}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnect(instance.id, instance.nome_instancia)}
                    className="flex-1 py-2 px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-4 h-4" /> QR Code
                  </button>
                  <button
                    onClick={() => handleCheckStatus(instance.id)}
                    className="flex-1 py-2 px-3 bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 border border-gray-200"
                  >
                    <RefreshCcw className="w-4 h-4" /> Status
                  </button>
                </div>
                <button
                  onClick={() => handleSyncChats(instance.id)}
                  disabled={syncing[instance.id] !== undefined}
                  className="mt-2 w-full py-2 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 border border-emerald-100 disabled:opacity-60"
                >
                  {syncing[instance.id] !== undefined ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {syncing[instance.id] || "Sincronizando..."}</>
                  ) : (
                    <><Download className="w-4 h-4" /> Importar conversas</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal QR Code */}
      {qrCodeData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-900 mb-1">Conectar {qrCodeData.name}</h3>
              <p className="text-sm text-gray-500 font-medium">Leia o QR Code abaixo com o WhatsApp</p>
            </div>
            
            <div className="p-8 flex justify-center bg-gray-50">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <img src={qrCodeData.base64} alt="QR Code" className="w-64 h-64 object-contain" />
              </div>
            </div>

            <div className="p-6 bg-white flex justify-between items-center">
              <button
                onClick={() => handleConnect(qrCodeData.id, qrCodeData.name)}
                className="text-indigo-600 font-bold text-sm hover:text-indigo-800 transition-colors"
              >
                Atualizar QR
              </button>
              <button
                onClick={() => {
                  setQrCodeData(null)
                  fetchInstances()
                }}
                className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg transition-colors text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
