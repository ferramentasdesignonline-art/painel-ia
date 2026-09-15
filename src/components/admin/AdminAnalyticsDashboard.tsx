"use client"

import { useState, useEffect } from "react"
import { Users, Clock, Calendar, MessageSquare, Trophy, Filter, LayoutDashboard, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

function KpiCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-5 soft-shadow transition-all hover:-translate-y-1 hover:shadow-lg font-poppins">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-inner", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-gray-500">{title}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">{value}</h3>
          </div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5 line-clamp-1" title={subtitle}>{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function KpiGrid({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="grid gap-4 w-full">
      {/* 3 cards top */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Total de Leads"
          value={data.totalLeads.toLocaleString('pt-BR')}
          subtitle="Captação Geral"
          icon={Users}
          color="bg-indigo-500"
        />
        <KpiCard
          title="Visitas Agendadas"
          value={data.visitasAgendadas.toLocaleString('pt-BR')}
          subtitle="Agendamentos Realizados"
          icon={Calendar}
          color="bg-blue-500"
        />
        <KpiCard
          title="Em Andamento"
          value={data.emAndamento.toLocaleString('pt-BR')}
          subtitle="Leads Ativos no Funil"
          icon={Clock}
          color="bg-amber-500"
        />
      </div>
      {/* 3 cards bottom */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Simulações Aprovadas"
          value={data.simulacoesAprovadas.toLocaleString('pt-BR')}
          subtitle="Pré ou Aprovadas"
          icon={Trophy}
          color="bg-emerald-500"
        />
        <KpiCard
          title="Simulações Reprovadas"
          value={(data.simulacoesReprovadas || 0).toLocaleString('pt-BR')}
          subtitle="Análise negada"
          icon={AlertCircle}
          color="bg-orange-500"
        />
        <KpiCard
          title="Perdidos"
          value={data.perdas.toLocaleString('pt-BR')}
          subtitle="Follow-up esgotado"
          icon={MessageSquare}
          color="bg-red-500"
        />
      </div>
    </div>
  )
}

export function AdminAnalyticsDashboard({ clients }: { clients: any[] }) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [globalData, setGlobalData] = useState<any>(null)
  const [clientsData, setClientsData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let url = `/api/admin/analytics?t=${Date.now()}` // bypass cache just in case
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
        if (json.global) {
          setGlobalData(json.global)
          setClientsData(json.clients || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [startDate, endDate])

  return (
    <div className="space-y-10">
      {/* Header com Filtros Globais */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Dashboard Master</h2>
            <p className="text-xs text-gray-500 font-medium">Visão global e por cliente</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-sm">
          <Filter className="w-4 h-4 text-gray-400 ml-2" />
          <div className="w-px h-6 bg-gray-200 ml-1" />
          <div className="flex flex-col ml-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none mt-1">Início</span>
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

      {loading ? (
        <div className="space-y-10">
          <div className="space-y-4">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => <div key={`sk-1-${i}`} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => <div key={`sk-2-${i}`} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          </div>
        </div>
      ) : globalData ? (
        <div className="space-y-12">
          {/* Total Global */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">Resumo Global</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Todos</span>
            </div>
            <KpiGrid data={globalData} />
          </section>

          {/* Por Cliente */}
          {clientsData.map((client) => (
            <section key={client.id} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <h3 className="text-lg font-bold tracking-tight text-gray-800">{client.nome}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Cliente</span>
              </div>
              <KpiGrid data={client.kpis} />
            </section>
          ))}
          
          {clientsData.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
              Nenhum cliente com dados encontrados.
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
          Nenhum dado encontrado.
        </div>
      )}
    </div>
  )
}
