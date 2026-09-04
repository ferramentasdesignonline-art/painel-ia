"use client"

import { useState, useEffect } from "react"
import { Smartphone, RefreshCcw, Wifi, WifiOff, Loader2 } from "lucide-react"

export default function WhatsappPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp")
      const data = await res.json()
      if (res.ok) {
        setStatus(data)
        if (data.status?.connected) {
          setQrCode(null)
        } else if (data.instance?.qrcode) {
          setQrCode(data.instance.qrcode)
        }
      } else {
        setError(data.error || "Erro ao buscar status")
      }
    } catch (err) {
      setError("Erro de rede")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    
    // Se estiver aguardando o QR Code (conectando), atualiza a cada 10 segundos. 
    // Se já estiver conectado ou desconectado, a cada 5 minutos.
    const isConnecting = status?.instance?.status === 'connecting' || qrCode !== null;
    const intervalTime = isConnecting ? 10 * 1000 : 5 * 60 * 1000;
    
    const interval = setInterval(fetchStatus, intervalTime)
    return () => clearInterval(interval)
  }, [status?.instance?.status, qrCode])

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch("/api/whatsapp", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        if (data.base64) {
          setQrCode(data.base64)
        } else if (data.instance?.qrcode) {
          setQrCode(data.instance.qrcode)
        } else {
          // Mesmo que não venha direto, vamos forçar uma atualização de status
          await fetchStatus()
        }
      } else {
        setError(data.error || "Erro ao conectar")
      }
    } catch (err) {
      setError("Erro de rede")
    } finally {
      setConnecting(false)
    }
  }

  const isConnected = status?.status?.connected
  const isConnecting = status?.response === "Connecting"

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 font-poppins flex items-center gap-3">
          <Smartphone className="h-8 w-8 text-indigo-400" />
          Conexão WhatsApp
        </h1>
        <p className="text-gray-400">Gerencie a conexão do seu número de WhatsApp com a inteligência artificial.</p>
      </div>

      <div className="bg-[#0a0a0b] border border-[#1e1e20] rounded-2xl p-8 max-w-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-red-400 bg-red-400/10 p-4 rounded-xl mb-4 border border-red-400/20">
            {error}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between p-6 bg-white/[0.02] rounded-xl border border-white/[0.05]">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {isConnected ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Status da Conexão</h3>
                  <p className="text-sm text-gray-400">
                    {isConnected ? "Conectado e operando" : isConnecting ? "Em processo de conexão..." : "Desconectado do WhatsApp"}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchStatus}
                className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Atualizar status"
              >
                <RefreshCcw className="h-5 w-5" />
              </button>
            </div>

            {!isConnected && !isConnecting && (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
                {!qrCode ? (
                  <>
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center">
                      <Smartphone className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-medium text-white mb-2">Conecte seu WhatsApp</h4>
                      <p className="text-gray-400 max-w-md mx-auto mb-6">
                        Para que a IA possa responder aos seus leads, você precisa conectar o seu número lendo um QR Code, igual ao WhatsApp Web.
                      </p>
                    </div>
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {connecting ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> Gerando QR Code...</>
                      ) : (
                        "Conectar WhatsApp"
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-6">
                    <h4 className="text-xl font-medium text-white mb-2">Escaneie o QR Code</h4>
                    <p className="text-gray-400">Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie a imagem abaixo.</p>
                    <div className="bg-white p-4 rounded-xl inline-block">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                    </div>
                    <div>
                      <button
                        onClick={async () => {
                          setConnecting(true);
                          await fetchStatus();
                          setConnecting(false);
                        }}
                        disabled={connecting}
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                      >
                        {connecting ? "Atualizando..." : "Gerar novo QR Code"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {isConnected && (
              <div className="py-8 text-center">
                <p className="text-green-400 font-medium">Tudo certo! Seu WhatsApp está conectado.</p>
                <p className="text-gray-400 text-sm mt-2">A inteligência artificial já pode responder aos seus clientes.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
