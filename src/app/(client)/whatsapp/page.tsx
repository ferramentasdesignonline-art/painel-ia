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
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 font-poppins flex items-center gap-3">
          <Smartphone className="h-8 w-8 text-indigo-600" />
          Conexão WhatsApp
        </h1>
        <p className="text-gray-500 text-sm">Gerencie a conexão do seu número de WhatsApp com a inteligência artificial.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 max-w-2xl shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-rose-700 bg-rose-50 p-4 rounded-xl mb-4 border border-rose-200 text-sm font-medium">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all ${
              isConnected 
                ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950' 
                : isConnecting 
                ? 'bg-amber-50/70 border-amber-200/80 text-amber-950' 
                : 'bg-rose-50/70 border-rose-200/80 text-rose-950'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl shadow-2xs ${
                  isConnected 
                    ? 'bg-emerald-500 text-white' 
                    : isConnecting 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-rose-500 text-white'
                }`}>
                  {isConnected ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Status da Conexão</h3>
                  <p className={`text-xs font-semibold mt-0.5 ${
                    isConnected ? 'text-emerald-700' : isConnecting ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                    {isConnected ? "Conectado e operando normalmente" : isConnecting ? "Em processo de conexão..." : "Desconectado do WhatsApp"}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchStatus}
                className="p-2 hover:bg-white/80 rounded-xl transition-colors text-gray-400 hover:text-gray-700 self-end sm:self-auto cursor-pointer border border-transparent hover:border-gray-200 shadow-2xs"
                title="Atualizar status"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>

            {!isConnected && !isConnecting && (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-6">
                {!qrCode ? (
                  <>
                    <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-xs">
                      <Smartphone className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-2">Conecte seu WhatsApp</h4>
                      <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                        Para que a IA possa responder aos seus leads, você precisa conectar o seu número lendo um QR Code, igual ao WhatsApp Web.
                      </p>
                    </div>
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                    >
                      {connecting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando QR Code...</>
                      ) : (
                        "Conectar WhatsApp"
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-6">
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Escaneie o QR Code</h4>
                    <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto">
                      Abra o WhatsApp no seu celular, vá em <strong>Aparelhos Conectados</strong> e aponte a câmera para o código abaixo:
                    </p>
                    <div className="bg-white p-4 rounded-2xl border-2 border-indigo-100 shadow-md inline-block">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded-lg" />
                    </div>
                    <div>
                      <button
                        onClick={async () => {
                          setConnecting(true);
                          await fetchStatus();
                          setConnecting(false);
                        }}
                        disabled={connecting}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors cursor-pointer"
                      >
                        {connecting ? "Atualizando..." : "Gerar novo QR Code"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {isConnected && (
              <div className="py-6 text-center bg-gray-50/60 rounded-xl border border-gray-100">
                <p className="text-emerald-700 font-bold text-sm">Tudo certo! Seu WhatsApp está conectado.</p>
                <p className="text-gray-500 text-xs mt-1">A inteligência artificial já pode responder aos seus clientes em tempo real.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
