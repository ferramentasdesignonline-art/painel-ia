"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts"
import { Users, Bot, MessageSquare, Trophy, RefreshCw, Calendar, TrendingUp } from "lucide-react"
import { LeadDrawer, LeadType } from "@/components/leads/LeadDrawer"

type AnalyticsData = {
  kpis: {
    aiMessages: number
    humanMessages: number
    totalFollowups: number
    qualifiedLeads: number
    totalLeads: number
    visitasAgendadas: number
    simulacoesAprovadas: number
    simulacoesPreAprovadas: number
    perdas: number
  }
  chartData: Array<{ day: string; mensagensIA: number; mensagensCliente: number; leads: number }>
  pieData: Array<{ name: string; value: number; color: string }>
}

type DateRange = '7d' | '30d' | 'custom'

function getDateRange(range: DateRange, customFrom?: string, customTo?: string) {
  const now = new Date()
  const to = now.toISOString()

  if (range === '7d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    return { from: from.toISOString(), to }
  }
  if (range === '30d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    return { from: from.toISOString(), to }
  }
  return {
    from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : '',
    to: customTo ? new Date(customTo + 'T23:59:59').toISOString() : to
  }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl soft-shadow border border-gray-100 font-poppins">
        <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-tighter">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm font-semibold text-gray-700">{entry.name}:</span>
              <span className="text-sm font-bold text-gray-900 ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

const KpiCard = ({ title, value, subtitle, icon: Icon, color, trend }: any) => (
  <Card className="relative overflow-hidden border-none soft-shadow transition-all duration-300 hover:premium-shadow hover:-translate-y-1 bg-white group select-none">
    <div className={`absolute top-0 left-0 w-1.5 h-full ${color}`} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">{title}</CardTitle>
      <div className="p-2 rounded-lg bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
        <Icon className="h-4 w-4" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
      <div className="flex items-center gap-2 mt-1.5">
        <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
        {trend && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-bold">
            +{trend}%
          </span>
        )}
      </div>
    </CardContent>
  </Card>
)

export default function ClientDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [qualifiedLeadsList, setQualifiedLeadsList] = useState<any[]>([])
  const [visitasDate, setVisitasDate] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadType | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const formatarTelefone = (tel?: string | null) => {
    if (!tel) return '-';
    let limpo = tel.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    if (!limpo) return tel.split('@')[0];
    if (limpo.startsWith('55')) limpo = limpo.slice(2);
    if (limpo.length === 11) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    if (limpo.length === 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return limpo;
  };

  const handleCardClick = (lead: any) => {
    const formattedLead: LeadType = {
      id: lead.id?.toString() || "",
      nome: lead.nome || "Cliente",
      telefone: lead.telefone || lead.phone || "",
      veiculo: lead.veiculo_interessado || lead.veiculo || lead.carro || "",
      vendedor: lead.vendedor_lead || "IA",
      status: lead.lead_finalizado ? "QUALIFICADO" : "EM ANDAMENTO",
      origem: lead.origem || "ia",
      ultimaMensagem: lead.ultima_mensagem || lead.updated_at || "-",
      createdAt: lead.created_at,
      ultimaMensagemTs: lead.ultima_mensagem,
      quantidadeFollowup: lead.quantidade_followup,
      leadFinalizado: lead.lead_finalizado === true,
      vendedorLead: lead.vendedor_lead || null,
      horarioLeadQualificado: lead.horario_lead_qualificado || null,
      veiculoInteressado: lead.veiculo_interessado || null,
      dataAgendamento: lead.data_agendamento || null,
      observacaoLeadQualificado: lead.observacao_lead_qualificado || null,
      email: lead.email || null,
      cpfCnpj: lead.cpf_cnpj || null,
      dataNascimento: lead.data_nascimento || null,
      veiculoTroca: lead.veiculo_troca || null,
      endereco: lead.endereço || null,
      possuiCnh: lead.possui_cnh,
      genero: lead.genero || null,
    }
    setSelectedLead(formattedLead)
    setIsDrawerOpen(true)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = getDateRange(range, customFrom, customTo)
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('_t', Date.now().toString()) // Cache buster

      const [resAnalytics, resLeads] = await Promise.all([
        fetch(`/api/analytics?${params}`),
        fetch(`/api/leads`) // Busca todos os leads para filtrar os qualificados
      ])

      const json = await resAnalytics.json()
      if (json.error || !json.kpis) {
        console.error("API error or missing KPIs:", json)
        setData(null)
      } else {
        setData(json)
      }

      const jsonLeads = await resLeads.json()
      if (jsonLeads.data) {
        // Filtrar leads qualificados (lead_finalizado, horario_lead_qualificado ou novas etapas ativas)
        const qualificados = jsonLeads.data.filter((l: any) => 
          l.lead_finalizado === true || 
          l.horario_lead_qualificado || 
          l.lead_visita_confirmada === true ||
          l.lead_simulacao_pre_aprovada === true ||
          l.lead_simulacao_aprovada === true ||
          l.lead_simulacao_reprovada === true
        )
        setQualifiedLeadsList(qualificados)
      }
    } catch (e) {
      console.error(e)
      setData(null)
      setQualifiedLeadsList([])
    } finally {
      setLoading(false)
    }
  }, [range, customFrom, customTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-poppins pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-poppins">Visão Geral</h1>
          <p className="text-gray-500 mt-1">Bem-vindo de volta! Aqui está o resumo de performance da sua IA.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData} 
            disabled={loading} 
            className="bg-white soft-shadow border-gray-100 hover:bg-gray-50 h-10 px-4 rounded-xl font-semibold"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar dados
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="p-2 bg-white/50 border-gray-100 soft-shadow backdrop-blur-sm rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {(['7d', '30d'] as DateRange[]).map(r => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-xl px-6 h-10 font-bold transition-all duration-300",
                  range === r 
                    ? "bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 text-white" 
                    : "text-gray-500 hover:bg-white hover:text-indigo-600"
                )}
              >
                {r === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
              </Button>
            ))}
            <Button
              variant={range === 'custom' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRange('custom')}
              className={cn(
                "rounded-xl px-6 h-10 font-bold transition-all duration-300",
                range === 'custom' 
                  ? "bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 text-white" 
                  : "text-gray-500 hover:bg-white hover:text-indigo-600"
              )}
            >
              Personalizado
            </Button>
            
            {range === 'custom' && (
              <div className="flex items-center gap-3 ml-2 animate-in fade-in zoom-in-95 duration-300">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="text-sm border border-gray-100 bg-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 soft-shadow font-medium font-poppins"
                />
                <span className="text-gray-300 font-bold">→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="text-sm border border-gray-100 bg-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 soft-shadow font-medium font-poppins"
                />
                <Button size="sm" onClick={fetchData} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 h-10 px-5 font-bold">
                  Filtrar
                </Button>
              </div>
            )}
          </div>
        </Card>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse soft-shadow" />
            ))}
          </div>
        ) : data ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 font-poppins">
            <KpiCard
              title="Msgs Enviadas p/ IA"
              value={data.kpis.aiMessages.toLocaleString('pt-BR')}
              subtitle="Respostas automáticas"
              icon={Bot}
              color="bg-indigo-500"
              trend={12}
            />
            <KpiCard
              title="Msgs dos Clientes"
              value={data.kpis.humanMessages.toLocaleString('pt-BR')}
              subtitle="Perguntas recebidas"
              icon={MessageSquare}
              color="bg-blue-500"
              trend={8}
            />
            <KpiCard
              title="Novos Leads"
              value={data.kpis.totalLeads.toLocaleString('pt-BR')}
              subtitle="Captados pela IA"
              icon={Users}
              color="bg-purple-500"
            />
            <KpiCard
              title="Follow-ups Feitos"
              value={data.kpis.totalFollowups.toLocaleString('pt-BR')}
              subtitle="Reativações pela IA"
              icon={TrendingUp}
              color="bg-amber-500"
            />
            <KpiCard
              title="Leads Qualificados"
              value={data.kpis.qualifiedLeads.toLocaleString('pt-BR')}
              subtitle={`De ${data.kpis.totalLeads} no total`}
              icon={Trophy}
              color="bg-emerald-500"
              trend={5}
            />
            <KpiCard
              title="Visitas Agendadas"
              value={data.kpis.visitasAgendadas.toLocaleString('pt-BR')}
              subtitle="Agendamentos feitos"
              icon={Calendar}
              color="bg-cyan-500"
            />
            <KpiCard
              title="Simulações Aprovadas"
              value={(data.kpis.simulacoesAprovadas + data.kpis.simulacoesPreAprovadas).toLocaleString('pt-BR')}
              subtitle="Pré ou Aprovadas"
              icon={Trophy}
              color="bg-green-500"
            />
            <KpiCard
              title="Leads Perdidos"
              value={data.kpis.perdas.toLocaleString('pt-BR')}
              subtitle="Finalizados sem sucesso"
              icon={MessageSquare}
              color="bg-red-500"
            />
          </div>
        ) : null}
      </div>

      {!loading && data && (
        <div className="grid gap-6 lg:grid-cols-3 font-poppins">
          <Card className="lg:col-span-2 border-none soft-shadow p-6 rounded-3xl bg-white overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 font-poppins">Atividade de Conversas</CardTitle>
                <CardDescription className="text-sm font-medium font-poppins">Volume diário de interações</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  IA
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                  Cliente
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartData}>
                  <defs>
                    <linearGradient id="colorIA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorHuman" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af', fontFamily: 'Poppins' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af', fontFamily: 'Poppins' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="mensagensIA" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorIA)" 
                    name="IA"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="mensagensCliente" 
                    stroke="#60a5fa" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorHuman)" 
                    name="Cliente"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="border-none soft-shadow p-6 rounded-3xl bg-white flex flex-col items-center justify-center">
            <div className="w-full text-center mb-4">
              <CardTitle className="text-base font-bold text-gray-900 font-poppins">Conversão de Leads</CardTitle>
              <CardDescription className="text-xs font-medium font-poppins">Qualificados vs Em Andamento</CardDescription>
            </div>
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900 font-poppins">{Math.round((data.kpis.qualifiedLeads / data.kpis.totalLeads) * 100 || 0)}%</span>
                <span className="text-[10px] font-bold text-gray-400 font-poppins">QUALIF.</span>
              </div>
            </div>
            <div className="flex flex-col w-full gap-2 mt-4">
              {data.pieData.map(d => (
                <div key={d.name} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{d.name}</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{d.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-3 border-none soft-shadow p-6 rounded-3xl bg-white overflow-hidden">
             <div className="flex items-center justify-between mb-8">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 font-poppins">Captação de Leads</CardTitle>
                <CardDescription className="text-sm font-medium font-poppins">Novos leads identificados pela IA ao longo do tempo</CardDescription>
              </div>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af', fontFamily: 'Poppins' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af', fontFamily: 'Poppins' }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="leads" 
                    fill="#8b5cf6" 
                    radius={[10, 10, 0, 0]} 
                    barSize={32}
                    name="Novos Leads" 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Seção Visitas / Leads Qualificados */}
      {!loading && qualifiedLeadsList && qualifiedLeadsList.length > 0 && (
        <div className="space-y-6 mt-12 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-poppins">Visitas / Leads Qualificados</h2>
              <p className="text-gray-500 mt-1">Gerencie os agendamentos e leads prontos para negociação.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase">Filtrar Visitas:</span>
                <input
                  type="date"
                  value={visitasDate}
                  onChange={e => setVisitasDate(e.target.value)}
                  className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-[140px]"
                />
                {visitasDate && (
                  <button onClick={() => setVisitasDate('')} className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
                )}
              </div>
              <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold border border-indigo-100 whitespace-nowrap">
                {qualifiedLeadsList.filter(l => !visitasDate || (l.data_agendamento && new Date(l.data_agendamento).toISOString().startsWith(visitasDate))).length} Qualificado{qualifiedLeadsList.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {qualifiedLeadsList
              .filter(l => !visitasDate || (l.data_agendamento && new Date(l.data_agendamento).toISOString().startsWith(visitasDate)))
              .sort((a, b) => {
                const aTime = a.data_agendamento ? new Date(a.data_agendamento).getTime() : 0;
                const bTime = b.data_agendamento ? new Date(b.data_agendamento).getTime() : 0;
                return bTime - aTime;
              })
              .map((lead: any) => (
              <Card 
                key={lead.id} 
                onClick={() => handleCardClick(lead)}
                className="relative overflow-hidden border-none premium-shadow bg-white hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900 line-clamp-1">{lead.nome || 'Cliente não informado'}</span>
                      <span className="text-xs font-semibold text-gray-400 mt-0.5 whitespace-nowrap">{formatarTelefone(lead.telefone)}</span>
                    </div>
                    {lead.data_agendamento ? (
                      <div className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-100 whitespace-nowrap flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(lead.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : (
                      <div className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-100 whitespace-nowrap">
                        Qualificado
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-2 border border-gray-100">
                    <div className="flex gap-2">
                      <span className="text-gray-400 font-medium whitespace-nowrap w-20 text-xs text-right">Interesse:</span>
                      <span className="text-gray-900 font-semibold line-clamp-1 flex-1">{lead.veiculo_interessado || '-'}</span>
                    </div>
                    {lead.observacao_lead_qualificado && (
                      <div className="flex gap-2">
                         <span className="text-gray-400 font-medium whitespace-nowrap w-20 text-xs text-right">Obs:</span>
                         <span className="text-gray-600 font-medium line-clamp-2 text-xs flex-1">{lead.observacao_lead_qualificado}</span>
                      </div>
                    )}
                  </div>
                  
                  {lead.data_agendamento && (
                    <div className="pt-2 flex items-center gap-2 text-xs font-bold text-gray-500">
                       Data da visita: {new Date(lead.data_agendamento).toLocaleDateString('pt-BR')} às {new Date(lead.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <LeadDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  )
}
