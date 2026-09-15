"use client"

import { useState, useEffect } from "react"
import { Users, Clock, Calendar, MessageSquare, Trophy, AlertCircle, TrendingUp, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

function KpiCard({ title, value, subtitle, icon: Icon, color, trend }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-5 soft-shadow transition-all hover:-translate-y-1 hover:shadow-lg font-poppins">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-inner", color)}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-500">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h3>
          </div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

export function AdminAnalyticsDashboard({ clients }: { clients: any[] }) {
  const [selectedClient, setSelectedClient] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let url = `/api/admin/analytics?clientId=${selectedClient}`
        if (startDate) {
          const s = new Date(startDate)
          url += `&from=${s.toISOString()}`
        }
        if (endDate) {
          const e = new Date(endDate)
          e.setHours(23, 59, 59, 999)
          url += `&to=${e.toISOString()}`
        }

        const res = await fetch(url)
        const json = await res.json()
        if (json.kpis) {
          setData(json)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedClient, startDate, endDate])

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-600">Filtros:</span>
        </div>
        
        <div className="flex-1 min-w-[200px]">
          <select 
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
          >
            <option value="all">Todos os Clientes</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none ml-2 mt-1">Início</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-7 px-2 text-xs font-medium text-gray-700 bg-transparent focus:outline-none"
            />
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none ml-2 mt-1">Fim</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-7 px-2 text-xs font-medium text-gray-700 bg-transparent focus:outline-none"
            />
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }} 
              className="text-xs text-gray-400 hover:text-red-500 transition-colors mr-2 p-1"
              title="Limpar datas"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Grid de KPIs */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse soft-shadow" />
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            title="Total de Leads"
            value={data.kpis.totalLeads.toLocaleString('pt-BR')}
            subtitle="Captação Geral"
            icon={Users}
            color="bg-indigo-500"
          />
          <KpiCard
            title="Visitas Agendadas"
            value={data.kpis.visitasAgendadas.toLocaleString('pt-BR')}
            subtitle="Agendamentos Realizados"
            icon={Calendar}
            color="bg-blue-500"
          />
          <KpiCard
            title="Em Andamento"
            value={data.kpis.emAndamento.toLocaleString('pt-BR')}
            subtitle="Leads Ativos"
            icon={Clock}
            color="bg-amber-500"
          />
          <KpiCard
            title="Simulações"
            value={data.kpis.simulacoesAprovadas.toLocaleString('pt-BR')}
            subtitle="Pré / Aprovadas"
            icon={Trophy}
            color="bg-emerald-500"
          />
          <KpiCard
            title="Perdidos"
            value={data.kpis.perdas.toLocaleString('pt-BR')}
            subtitle="Follow-up esgotado"
            icon={MessageSquare}
            color="bg-red-500"
          />
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
          Nenhum dado encontrado para o período.
        </div>
      )}
    </div>
  )
}
