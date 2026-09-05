"use client"

import { useState, useEffect } from "react"
import { Bot, RefreshCw, ShieldBan, ShieldCheck, Phone, Clock, AlertTriangle } from "lucide-react"

function formatarTelefone(numero: string): string {
  if (!numero) return '-'
  // Remove @s.whatsapp.net e outros sufixos
  let limpo = numero.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '')
  if (!limpo) return numero.split('@')[0]
  if (limpo.startsWith('55')) limpo = limpo.slice(2)
  if (limpo.length === 11) return `+55 (${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`
  if (limpo.length === 10) return `+55 (${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`
  return `+55 ${limpo}`
}

export default function BloqueiosPage() {
  const [bloqueios, setBloqueios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const fetchBloqueios = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bloqueios')
      const json = await res.json()
      if (json.data) {
        const ativos = json.data.filter((b: any) => b.bloqueio_existe !== false)
        setBloqueios(ativos)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBloqueios()
  }, [])

  const handleUnblock = async (numero_cliente: string) => {
    setActing(numero_cliente)
    try {
      const res = await fetch('/api/bloqueios', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero_cliente })
      })
      if (res.ok) {
        // Remove da lista localmente para feedback imediato
        setBloqueios(prev => prev.filter(b => b.numero_cliente !== numero_cliente))
        setSuccessMsg('IA reativada com sucesso!')
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-poppins pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bloqueios (IA Pausada)</h1>
          <p className="text-gray-500 mt-1">Números onde a IA foi pausada para atendimento humano.</p>
        </div>
        <button
          onClick={fetchBloqueios}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 hover:border-indigo-200 rounded-xl text-sm font-bold text-gray-500 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Toast de sucesso */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 font-semibold text-sm animate-in fade-in duration-300">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-2xl" />
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bloqueios Ativos</p>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <ShieldBan className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900">{bloqueios.length}</div>
          <p className="text-xs text-gray-400 mt-1 font-medium">IAs pausadas agora</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 rounded-l-2xl" />
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Atendimento Humano</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Phone className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900">{bloqueios.length}</div>
          <p className="text-xs text-gray-400 mt-1 font-medium">Sua equipe está atendendo</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 shadow-lg shadow-indigo-100 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-white/80" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Dica</span>
          </div>
          <p className="text-white/90 text-xs font-medium leading-relaxed">
            Ao clicar em <strong className="text-white">Reativar IA</strong>, a IA voltará a responder automaticamente esse número.
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Header da tabela */}
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-700">Listagem de Bloqueios</h2>
          <p className="text-xs text-gray-400 mt-0.5">Números que não recebem mensagens automáticas</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm font-medium text-gray-400">Carregando bloqueios...</p>
          </div>
        ) : bloqueios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-700">Nenhum bloqueio ativo</p>
              <p className="text-sm text-gray-400 mt-1">A IA está atendendo a todos os contatos.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Cabeçalho */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-gray-50/70">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Número</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data do Bloqueio</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Ações</span>
              </div>

              {bloqueios.map((bloqueio) => {
                const numeroRaw = bloqueio.numero_cliente || ''
                const numeroFormatado = formatarTelefone(numeroRaw)
                const dataFormatada = bloqueio.created_at
                  ? new Date(bloqueio.created_at).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })
                  : '-'

                return (
                  <div
                    key={bloqueio.id || bloqueio.numero_cliente}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-gray-50/50 transition-colors group"
                  >
                    {/* Número */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{numeroFormatado}</p>
                        <p className="text-[10px] text-gray-400 font-medium">WhatsApp</p>
                      </div>
                    </div>

                    {/* Data */}
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-3.5 h-3.5 text-gray-300" />
                      <span className="text-sm font-medium">{dataFormatada}</span>
                    </div>

                    {/* Status */}
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-600 text-[10px] font-black uppercase tracking-wider">
                        <AlertTriangle className="w-3 h-3" />
                        IA Pausada
                      </span>
                    </div>

                    {/* Ação */}
                    <div className="flex justify-end">
                      <button
                        disabled={acting === bloqueio.numero_cliente}
                        onClick={() => handleUnblock(bloqueio.numero_cliente)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-indigo-100 hover:-translate-y-0.5 disabled:translate-y-0"
                      >
                        {acting === bloqueio.numero_cliente ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Reativando...
                          </>
                        ) : (
                          <>
                            <Bot className="w-3.5 h-3.5" />
                            Reativar IA
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
