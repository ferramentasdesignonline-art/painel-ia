"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users,
  RefreshCw,
  Calendar,
  Trophy,
  Filter,
  LayoutDashboard,
  AlertCircle,
  UserCheck,
  CheckCircle2,
  TrendingUp,
  Share2
} from "lucide-react"
import { cn } from "@/lib/utils"

type DateRange = '7d' | '30d' | 'total' | 'custom'

interface CanalItem {
  nome: string
  count: number
  pct: number
}

interface ClientKpis {
  totalLeads: number
  emAtendimento: number
  atendimentoHumano: number
  oportunidades: number
  visitasAgendadas: number
  visitasRealizadas: number
  simulacoesAprovadas: number
  perdidos: number
}

interface ClientData {
  id: string
  nome: string
  kpis: ClientKpis
  canais: CanalItem[]
}

interface GlobalData extends ClientKpis {
  canais: CanalItem[]
}

function getDateRange(range: DateRange, customFrom?: string, customTo?: string) {
  if (range === 'total') {
    return { from: '', to: '' }
  }

  const now = new Date()

  if (range === '7d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    from.setHours(0, 0, 0, 0)
    const to = new Date(now)
    to.setHours(23, 59, 59, 999)
    return { from: from.toISOString(), to: to.toISOString() }
  }

  if (range === '30d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    from.setHours(0, 0, 0, 0)
    const to = new Date(now)
    to.setHours(23, 59, 59, 999)
    return { from: from.toISOString(), to: to.toISOString() }
  }

  let fromStr = ''
  let toStr = ''
  if (customFrom) {
    const [sY, sM, sD] = customFrom.split('-').map(Number)
    fromStr = new Date(sY, sM - 1, sD, 0, 0, 0, 0).toISOString()
  }
  if (customTo) {
    const [eY, eM, eD] = customTo.split('-').map(Number)
    toStr = new Date(eY, eM - 1, eD, 23, 59, 59, 999).toISOString()
  }
  return { from: fromStr, to: toStr }
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  textColor = "text-white"
}: {
  title: string
  value: string | number
  subtitle: string
  icon: any
  color: string
  textColor?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </h3>
          <p className="text-[11px] font-medium text-gray-400 line-clamp-1" title={subtitle}>
            {subtitle}
          </p>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs", color, textColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function KpiGrid({ kpis }: { kpis: ClientKpis }) {
  if (!kpis) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      {/* 1. Total de Leads */}
      <KpiCard
        title="Total de Leads"
        value={kpis.totalLeads}
        subtitle="Captados no período"
        icon={Users}
        color="bg-purple-600"
      />

      {/* 2. Em Atendimento */}
      <KpiCard
        title="Em Atendimento"
        value={kpis.emAtendimento}
        subtitle="Ativos na IA / Loja"
        icon={RefreshCw}
        color="bg-blue-600"
      />

      {/* 3. Atendimento Humano */}
      <KpiCard
        title="Atendimento Humano"
        value={kpis.atendimentoHumano}
        subtitle="Telefones bloqueados"
        icon={UserCheck}
        color="bg-indigo-600"
      />

      {/* 4. Oportunidades */}
      <KpiCard
        title="Oportunidades"
        value={kpis.oportunidades}
        subtitle="Ficha | Troca | Entrada"
        icon={Trophy}
        color="bg-amber-500"
      />

      {/* 5. Visitas Agendadas */}
      <KpiCard
        title="Visitas Agendadas"
        value={kpis.visitasAgendadas}
        subtitle="Agendamentos confirmados"
        icon={Calendar}
        color="bg-cyan-600"
      />

      {/* 6. Visitas Realizadas */}
      <KpiCard
        title="Visitas Realizadas"
        value={kpis.visitasRealizadas}
        subtitle="Compareceram na loja"
        icon={CheckCircle2}
        color="bg-teal-600"
      />

      {/* 7. Simulações Aprovadas */}
      <KpiCard
        title="Simulações Aprovadas"
        value={kpis.simulacoesAprovadas}
        subtitle="Pré ou Aprovadas"
        icon={Trophy}
        color="bg-emerald-600"
      />

      {/* 8. Perdidos */}
      <KpiCard
        title="Perdidos"
        value={kpis.perdidos}
        subtitle="Desqualificados / Desistiu"
        icon={AlertCircle}
        color="bg-rose-500"
      />
    </div>
  )
}

function getChannelColor(canalNome: string) {
  const norm = canalNome.toLowerCase()
  if (norm.includes('meta') || norm.includes('facebook') || norm.includes('instagram')) {
    return { bg: 'bg-indigo-500', bar: 'bg-indigo-500', text: 'text-indigo-700', badge: 'bg-indigo-50' }
  }
  if (norm.includes('marketplace')) {
    return { bg: 'bg-sky-500', bar: 'bg-sky-500', text: 'text-sky-700', badge: 'bg-sky-50' }
  }
  if (norm.includes('google')) {
    return { bg: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50' }
  }
  if (norm.includes('olx')) {
    return { bg: 'bg-purple-500', bar: 'bg-purple-500', text: 'text-purple-700', badge: 'bg-purple-50' }
  }
  if (norm.includes('webmotors')) {
    return { bg: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-50' }
  }
  if (norm.includes('mercado livre')) {
    return { bg: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50' }
  }
  return { bg: 'bg-slate-400', bar: 'bg-slate-400', text: 'text-slate-700', badge: 'bg-slate-50' }
}

function CanaisDistribution({ canais, total }: { canais: CanalItem[]; total: number }) {
  if (!canais || canais.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 text-sm text-gray-400 text-center">
        Nenhum canal com leads registrado no período.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Origem dos Leads</h4>
            <p className="text-[11px] text-gray-400">Distribuição por canal de captação</p>
          </div>
        </div>
        <span className="text-xs font-bold text-gray-500">
          {total.toLocaleString('pt-BR')} leads mapeados
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
        {canais.map((c) => {
          const colors = getChannelColor(c.nome)
          return (
            <div key={c.nome} className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-bold", colors.badge, colors.text)}>
                  {c.nome}
                </span>
                <span className="text-xs font-black text-gray-900">
                  {c.count.toLocaleString('pt-BR')} <span className="text-gray-400 font-medium">({c.pct}%)</span>
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200/80 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
                  style={{ width: `${Math.min(100, Math.max(c.pct, 2))}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AdminAnalyticsDashboard({ clients }: { clients: any[] }) {
  const [selectedClient, setSelectedClient] = useState("all")
  const [range, setRange] = useState<DateRange>('30d')
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [globalData, setGlobalData] = useState<GlobalData | null>(null)
  const [clientsData, setClientsData] = useState<ClientData[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = getDateRange(range, customFrom, customTo)
      let url = `/api/admin/analytics?t=${Date.now()}`
      if (from) url += `&from=${encodeURIComponent(from)}`
      if (to) url += `&to=${encodeURIComponent(to)}`

      const res = await fetch(url)
      const json = await res.json()
      if (json.global) {
        setGlobalData(json.global)
        setClientsData(json.clients || [])
      }
    } catch (err) {
      console.error("Erro ao carregar dados analíticos do Admin:", err)
    } finally {
      setLoading(false)
    }
  }, [range, customFrom, customTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-8 font-poppins">
      {/* Barra de Filtros e Atalhos de Período */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
        
        {/* Atalhos de Período */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {(['7d', '30d', 'total'] as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer",
                range === r
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/60"
              )}
            >
              {r === '7d' ? 'Últimos 7 dias' : r === '30d' ? 'Últimos 30 dias' : 'Período Total'}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setRange('custom')}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer",
              range === 'custom'
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/60"
            )}
          >
            Personalizado
          </button>

          {range === 'custom' && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Início</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-6 text-xs font-medium text-gray-700 bg-transparent focus:outline-none"
                />
              </div>
              <span className="text-gray-300 font-bold text-xs">→</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Fim</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-6 text-xs font-medium text-gray-700 bg-transparent focus:outline-none"
                />
              </div>
              {(customFrom || customTo) && (
                <button
                  type="button"
                  onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                  className="text-xs text-gray-400 hover:text-rose-500 font-bold px-1"
                  title="Limpar datas personalizadas"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filtro por Cliente & Atualizar */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 shadow-2xs w-full sm:w-64">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="w-px h-5 bg-gray-200" />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full text-xs font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer py-1"
            >
              <option value="all">Todos os Clientes</option>
              {clients.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-2xs shrink-0 cursor-pointer disabled:opacity-60"
            title="Recarregar dados"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-indigo-600")} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-8">
          <div className="h-6 w-44 bg-gray-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      ) : globalData ? (
        <div className="space-y-12">
          {/* Seção Resumo Global (quando Todos os Clientes estiver selecionado) */}
          {selectedClient === "all" && (
            <section className="space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-gray-900">Resumo Global Consolidado</h3>
                  <p className="text-xs text-gray-400">Total somado de todas as concessionárias e clientes ativos</p>
                </div>
              </div>

              {/* 8 KPIs Globais */}
              <KpiGrid kpis={globalData} />

              {/* Distribuição Global de Canais */}
              <CanaisDistribution canais={globalData.canais || []} total={globalData.totalLeads} />
            </section>
          )}

          {/* Seção Por Cliente */}
          <div className="space-y-10">
            {clientsData
              .filter((c) => selectedClient === "all" || c.id === selectedClient)
              .map((client) => (
                <section key={client.id} className="space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100/80">
                  <div className="flex items-center justify-between border-b border-gray-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-600" />
                      <h3 className="text-lg font-bold tracking-tight text-gray-900">{client.nome}</h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-[10px] font-bold text-gray-600 uppercase tracking-wider shadow-2xs">
                      {client.kpis.totalLeads.toLocaleString('pt-BR')} leads captados
                    </span>
                  </div>

                  {/* 8 KPIs do Cliente */}
                  <KpiGrid kpis={client.kpis} />

                  {/* Distribuição de Canais do Cliente */}
                  {client.canais && client.canais.length > 0 && (
                    <CanaisDistribution canais={client.canais} total={client.kpis.totalLeads} />
                  )}
                </section>
              ))}

            {clientsData.filter((c) => selectedClient === "all" || c.id === selectedClient).length === 0 && (
              <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
                Nenhum dado encontrado para o cliente selecionado no período.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          Nenhum dado analítico encontrado.
        </div>
      )}
    </div>
  )
}
