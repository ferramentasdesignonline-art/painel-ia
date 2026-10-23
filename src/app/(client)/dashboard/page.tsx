"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts"
import { Users, Bot, MessageSquare, Trophy, RefreshCw, Calendar, TrendingUp, ShieldBan, ExternalLink, Megaphone, Tag, Filter, UserCheck, Search } from "lucide-react"
import { LeadDrawer, LeadType } from "@/components/leads/LeadDrawer"
import { formatarVisitaDashboard, matchesVisitasDate } from "@/lib/agendamento-utils"
import { VisualFunnel, FunnelData } from "@/components/dashboard/VisualFunnel"
import { ChannelIcon } from "@/components/common/ChannelIcon"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type AnalyticsData = {
  kpis: {
    totalLeads: number
    emAtendimento: number
    atendimentoHumano: number
    oportunidades: number
    visitasAgendadas: number
    visitasRealizadas: number
    simulacoesAprovadas: number
    perdidosQualificados: number
    perdidosDesqualificados: number
    clientes: number
    qualifiedLeads?: number
    perdas?: number
    emAndamento?: number
    totalFollowups?: number
    aiMessages?: number
    humanMessages?: number
  }
  tipo_atendimento?: 'sem_ia' | 'com_ia'
  funnel?: FunnelData
  chartData: Array<{ day: string; mensagensIA: number; mensagensCliente: number; leads: number }>
  pieData: Array<{ name: string; value: number; color: string }>
}

type DateRange = '7d' | '30d' | 'total' | 'custom'

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
  return {
    from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : '',
    to: customTo ? new Date(customTo + 'T23:59:59.999').toISOString() : ''
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

function formatarTempoResposta(segundos?: number | null): string | null {
  if (segundos === null || segundos === undefined || isNaN(segundos)) return null;
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  const segRestantes = segundos % 60;
  if (minutos < 60) {
    return segRestantes > 0 ? `${minutos}m ${segRestantes}s` : `${minutos}m`;
  }
  const horas = Math.floor(minutos / 60);
  const minRestantes = minutos % 60;
  return minRestantes > 0 ? `${horas}h ${minRestantes}m` : `${horas}h`;
}

function formatarHorarioMsg(timestamp?: string | null): string | null {
  if (!timestamp) return null;
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

const KpiCard = ({ title, value, subtitle, icon: Icon, color, trend, onClick }: any) => (
  <Card 
    onClick={onClick}
    className={cn(
      "relative overflow-hidden border-none soft-shadow transition-all duration-300 bg-white group select-none",
      onClick && "cursor-pointer hover:premium-shadow hover:-translate-y-1 hover:ring-2 hover:ring-indigo-500/20 active:scale-[0.99]"
    )}
  >
    <div className={`absolute top-0 left-0 w-1.5 h-full ${color}`} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">{title}</CardTitle>
      <div className="p-2 rounded-lg bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
        <Icon className="h-4 w-4" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
        {onClick && (
          <span className="text-[10px] font-bold text-indigo-600 group-hover:underline flex items-center gap-0.5">
            Ver leads &rarr;
          </span>
        )}
      </div>
    </CardContent>
  </Card>
)

export default function ClientDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [qualifiedLeadsList, setQualifiedLeadsList] = useState<any[]>([])
  const [canalFiltro, setCanalFiltro] = useState<string | null>(null)
  const [tagFiltro, setTagFiltro] = useState<string | null>(null)
  const [visitasDate, setVisitasDate] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadType | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [kpiModal, setKpiModal] = useState<{ key: string; title: string; color: string; subtitle?: string } | null>(null)
  const [kpiSearch, setKpiSearch] = useState('')
  
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
      data_agendamento_visita: lead.data_agendamento_visita || null,
      horario_agendamento_visita: lead.horario_agendamento_visita || null,
      dataAgendamentoVisita: lead.data_agendamento_visita || null,
      horarioAgendamentoVisita: lead.horario_agendamento_visita || null,
      observacaoLeadQualificado: lead.observacao_lead_qualificado || null,
      email: lead.email || null,
      cpfCnpj: lead.cpf_cnpj || null,
      dataNascimento: lead.data_nascimento || null,
      veiculoTroca: lead.veiculo_troca || null,
      endereco: lead.endereco || lead.endereço || null,
      possuiCnh: lead.possui_cnh,
      genero: lead.genero || null,
      tags: lead.tags || [],
      canal_origem: lead.canal_origem,
      canal_label_name: lead.canal_label_name,
      canal_color: lead.canal_color,
      anuncio_titulo: lead.anuncio_titulo,
      anuncio_id: lead.anuncio_id,
      anuncio_url: lead.anuncio_url,
      origem_detalhe: lead.origem_detalhe,
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
      if (canalFiltro) params.set('canal', canalFiltro)
      params.set('_t', Date.now().toString()) // Cache buster

      const [resAnalytics, resLeads] = await Promise.all([
        fetch(`/api/analytics?${params}`),
        fetch(`/api/leads?${params}`) // Filtra leads pelo mesmo período para sincronizar canais e anúncios
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
        setAllLeads(jsonLeads.data)
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
      } else {
        setAllLeads([])
      }
    } catch (e) {
      console.error(e)
      setData(null)
      setAllLeads([])
      setQualifiedLeadsList([])
    } finally {
      setLoading(false)
    }
  }, [range, customFrom, customTo, canalFiltro])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Métricas agrupadas por canal de atendimento
  const canaisMetrics = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; color?: string }>()
    let totalComCanal = 0

    for (const lead of allLeads) {
      const canalKey = lead.canal_origem || 'sem_origem'
      const canalNome = lead.canal_label_name || (
        canalKey === 'facebook_ads' ? 'Facebook Ads' :
        canalKey === 'instagram_ads' ? 'Instagram Ads' :
        canalKey === 'meta_ads' ? 'Meta Ads' :
        canalKey === 'facebook_marketplace' ? 'Marketplace' :
        canalKey === 'mercado_livre' || canalKey === 'mercadolivre' ? 'Mercado Livre' :
        canalKey === 'webmotors' ? 'WebMotors' :
        canalKey === 'olx' ? 'OLX' :
        canalKey === 'icarros' ? 'iCarros' :
        canalKey === 'desconhecido' ? 'Desconhecido' :
        canalKey === 'sem_origem' ? 'Sem Origem' :
        canalKey
      )

      if (!map.has(canalKey)) {
        map.set(canalKey, {
          nome: canalNome,
          count: 0,
          color: lead.canal_color || (canalKey === 'sem_origem' ? '#94a3b8' : canalKey === 'desconhecido' ? '#64748b' : undefined),
        })
      }
      map.get(canalKey)!.count += 1
      totalComCanal += 1
    }

    const list = Array.from(map.entries()).map(([key, data]) => ({
      key,
      nome: data.nome,
      count: data.count,
      color: data.color,
    })).sort((a, b) => b.count - a.count)

    return { list, total: totalComCanal }
  }, [allLeads])

  // Lista de tags únicas dos leads
  const tagsDisponiveis = useMemo(() => {
    const map = new Map<string, { nome: string; count: number }>()
    for (const lead of allLeads) {
      for (const t of (lead.tags || [])) {
        if (!map.has(t.nome)) {
          map.set(t.nome, { nome: t.nome, count: 0 })
        }
        map.get(t.nome)!.count += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [allLeads])

  // Métricas consolidadas e ranking de melhor performance dos Anúncios
  const adsMetrics = useMemo(() => {
    const map = new Map<string, {
      titulo: string;
      id?: string | null;
      url?: string | null;
      canal?: string | null;
      totalLeads: number;
      visitas: number;
      simulacoes: number;
      qualificados: number;
    }>()

    for (const lead of allLeads) {
      if (lead.anuncio_titulo || lead.anuncio_id) {
        const key = lead.anuncio_titulo || lead.anuncio_id || 'Anúncio Meta'
        if (!map.has(key)) {
          map.set(key, {
            titulo: lead.anuncio_titulo || 'Anúncio Meta',
            id: lead.anuncio_id,
            url: lead.anuncio_url,
            canal: lead.canal_label_name || lead.canal_origem,
            totalLeads: 0,
            visitas: 0,
            simulacoes: 0,
            qualificados: 0,
          })
        }
        const item = map.get(key)!
        item.totalLeads += 1
        if (lead.lead_visita_confirmada) item.visitas += 1
        if (lead.lead_simulacao_aprovada || lead.lead_simulacao_pre_aprovada) item.simulacoes += 1
        if (lead.lead_finalizado || lead.horario_lead_qualificado) item.qualificados += 1
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // Prioridade: visitas confirmadas > simulações > qualificados > total de leads
      if (b.visitas !== a.visitas) return b.visitas - a.visitas
      if (b.simulacoes !== a.simulacoes) return b.simulacoes - a.simulacoes
      if (b.qualificados !== a.qualificados) return b.qualificados - a.qualificados
      return b.totalLeads - a.totalLeads
    })
  }, [allLeads])

  // Leads filtrados pelo canal clicado e pela etiqueta opcional
  const leadsFiltradosPorCanal = useMemo(() => {
    if (!canalFiltro) return []
    return allLeads.filter(l => {
      const matchCanal = (l.canal_origem || 'desconhecido') === canalFiltro
      if (!matchCanal) return false
      if (tagFiltro && !(l.tags || []).some((t: any) => t.nome.toLowerCase() === tagFiltro.toLowerCase())) {
        return false
      }
      return true
    })
  }, [allLeads, canalFiltro, tagFiltro])

  // Leads filtrados pelo KPI card clicado
  const leadsFiltradosPorKpi = useMemo(() => {
    if (!kpiModal) return []
    let list = allLeads

    // Se houver canal selecionado nos cards de canais, o modal de KPI deve respeitar esse canal!
    if (canalFiltro && canalFiltro !== 'todos') {
      list = list.filter(l => (l.canal_origem || 'sem_origem') === canalFiltro)
    }

    if (kpiModal.key === 'todos') {
      // mantém a lista do canal
    } else if (kpiModal.key === 'em_atendimento') {
      list = list.filter(l => l.etapa === 'em_atendimento' || (!l.etapa && !l.lead_finalizado))
    } else if (kpiModal.key === 'oportunidades') {
      list = list.filter(l => l.etapa === 'oportunidade' || l.etapa === 'ia_qualificado' || l.etapa === 'simulacao_pre_aprovada')
    } else if (kpiModal.key === 'visitas_agendadas') {
      list = list.filter(l => l.etapa === 'visita_agendada' || l.etapa === 'visita_confirmada')
    } else if (kpiModal.key === 'visitas_realizadas') {
      list = list.filter(l => l.etapa === 'visita_realizada')
    } else if (kpiModal.key === 'simulacoes_aprovadas') {
      list = list.filter(l => l.etapa === 'simulacao_aprovada')
    } else if (kpiModal.key === 'perdidos_qualificados') {
      list = list.filter(l => l.etapa === 'perdido_qualificado')
    } else if (kpiModal.key === 'perdidos_desqualificados') {
      list = list.filter(l => l.etapa === 'perdido_desqualificado')
    } else if (kpiModal.key === 'clientes') {
      list = list.filter(l => l.etapa === 'cliente')
    }

    if (kpiSearch.trim()) {
      const q = kpiSearch.toLowerCase()
      list = list.filter(l =>
        (l.nome && l.nome.toLowerCase().includes(q)) ||
        (l.telefone && l.telefone.includes(q)) ||
        (l.veiculo_interessado && l.veiculo_interessado.toLowerCase().includes(q)) ||
        (l.tags && l.tags.some((t: any) => t.nome && t.nome.toLowerCase().includes(q)))
      )
    }

    return list
  }, [kpiModal, allLeads, canalFiltro, kpiSearch])

  const isSemIA = data?.tipo_atendimento === 'sem_ia'

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-poppins pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-poppins">Visão Geral</h1>
          <p className="text-gray-500 mt-1">
            {isSemIA ? 'Bem-vindo de volta! Aqui está o resumo de performance do seu atendimento.' : 'Bem-vindo de volta! Aqui está o resumo de performance da sua IA.'}
          </p>
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
            {(['7d', '30d', 'total'] as DateRange[]).map(r => (
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
                {r === '7d' ? 'Últimos 7 dias' : r === '30d' ? 'Últimos 30 dias' : 'Período Total'}
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
          <div className="grid gap-3.5 grid-cols-2 md:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse soft-shadow" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid gap-3.5 grid-cols-2 md:grid-cols-4 font-poppins">
              <KpiCard
                title="Total de Leads"
                value={data.kpis.totalLeads.toLocaleString('pt-BR')}
                subtitle={isSemIA ? "Novos contatos" : "Captados pela IA"}
                icon={Users}
                color="bg-purple-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'todos', title: 'Total de Leads', color: 'bg-purple-500', subtitle: 'Todos os leads do período selecionado' })
                }}
              />
              <KpiCard
                title="Em Atendimento"
                value={(data.kpis.emAtendimento ?? data.kpis.atendimentoHumano ?? 0).toLocaleString('pt-BR')}
                subtitle="Atendimento da Loja"
                icon={RefreshCw}
                color="bg-blue-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'em_atendimento', title: 'Em Atendimento', color: 'bg-blue-500', subtitle: 'Leads em atendimento ativo pela loja' })
                }}
              />
              <KpiCard
                title="Oportunidades"
                value={(data.kpis.oportunidades ?? 0).toLocaleString('pt-BR')}
                subtitle="Ficha | Troca | Entrada"
                icon={Trophy}
                color="bg-amber-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'oportunidades', title: 'Oportunidades', color: 'bg-amber-500', subtitle: 'Ficha aprovada, troca ou entrada' })
                }}
              />
              <KpiCard
                title="Visitas Agendadas"
                value={data.kpis.visitasAgendadas.toLocaleString('pt-BR')}
                subtitle="Agendamentos feitos"
                icon={Calendar}
                color="bg-cyan-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'visitas_agendadas', title: 'Visitas Agendadas', color: 'bg-cyan-500', subtitle: 'Visitas agendadas na loja' })
                }}
              />
              <KpiCard
                title="Visitas Realizadas"
                value={(data.kpis.visitasRealizadas ?? 0).toLocaleString('pt-BR')}
                subtitle="Presencial na loja"
                icon={UserCheck}
                color="bg-teal-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'visitas_realizadas', title: 'Visitas Realizadas', color: 'bg-teal-500', subtitle: 'Clientes que compareceram à loja' })
                }}
              />
              <KpiCard
                title="Simulações Aprovadas"
                value={(data.kpis.simulacoesAprovadas ?? 0).toLocaleString('pt-BR')}
                subtitle="Crédito aprovado"
                icon={Trophy}
                color="bg-green-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'simulacoes_aprovadas', title: 'Simulações Aprovadas', color: 'bg-green-500', subtitle: 'Leads com simulação de crédito aprovada' })
                }}
              />
              <KpiCard
                title="Perdidos Qualificados"
                value={(data.kpis.perdidosQualificados ?? 0).toLocaleString('pt-BR')}
                subtitle="Desistiram / Adiaram"
                icon={ShieldBan}
                color="bg-orange-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'perdidos_qualificados', title: 'Perdidos Qualificados', color: 'bg-orange-500', subtitle: 'Etiqueta: Perdido | Qualificado' })
                }}
              />
              <KpiCard
                title="Perdidos Desqualificados"
                value={(data.kpis.perdidosDesqualificados ?? 0).toLocaleString('pt-BR')}
                subtitle="Sem perfil / Sem resposta"
                icon={MessageSquare}
                color="bg-red-500"
                onClick={() => {
                  setKpiSearch('')
                  setKpiModal({ key: 'perdidos_desqualificados', title: 'Perdidos Desqualificados', color: 'bg-red-500', subtitle: 'Etiqueta: Perdido | Desqualificado | Sem resposta' })
                }}
              />
            </div>

            {/* Novo Funil Comercial Cônico por Etapas */}
            <VisualFunnel funnel={data.funnel} loading={loading} />
          </div>
        ) : null}
      </div>

      {!loading && data && (
        <div className="grid gap-6 lg:grid-cols-3 font-poppins">
          <Card className="lg:col-span-2 border-none soft-shadow p-6 rounded-3xl bg-white overflow-hidden">
             <div className="flex items-center justify-between mb-8">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 font-poppins">Captação de Leads</CardTitle>
                <CardDescription className="text-sm font-medium font-poppins">
                  {isSemIA ? "Novos leads ao longo do tempo" : "Novos leads identificados pela IA ao longo do tempo"}
                </CardDescription>
              </div>
            </div>
            <div className="h-[300px] w-full">
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

        </div>
      )}

      {/* Seção Desempenho por Canal de Atendimento */}
      {!loading && canaisMetrics.list.length > 0 && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 font-poppins flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-600" />
                Canais de Atendimento & Anúncios
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Volume de captação por canal. Clique em qualquer canal para ver e filtrar os leads correspondentes.
              </p>
            </div>
            {canalFiltro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCanalFiltro(null); setTagFiltro(null); }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                Limpar seleção &times;
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {canaisMetrics.list.map(c => {
              const isSelected = canalFiltro === c.key
              const perc = canaisMetrics.total > 0 ? Math.round((c.count / canaisMetrics.total) * 100) : 0
              return (
                <Card
                  key={c.key}
                  onClick={() => setCanalFiltro(isSelected ? null : c.key)}
                  className={cn(
                    "relative overflow-hidden cursor-pointer transition-all duration-200 p-4 border select-none group",
                    isSelected
                      ? "ring-2 ring-indigo-500 bg-indigo-50/70 border-indigo-200 shadow-md"
                      : "bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm"
                  )}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: c.color || '#6366f1' }}
                  />
                  <div className="flex flex-col justify-between h-full space-y-2">
                    <div className="flex items-center gap-2">
                      <ChannelIcon canal={c.key} label={c.nome} className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold text-gray-700 truncate line-clamp-1">{c.nome}</span>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-gray-900 tracking-tight">{c.count}</div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mt-0.5">
                        <span>{perc}% do total</span>
                        <span className="text-indigo-600 group-hover:underline">Ver leads →</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Barra de Filtro Rápido por Etiquetas / Estágios do WhatsApp & CRM */}
          {tagsDisponiveis.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  Filtrar Leads por Etiqueta / Estágio:
                </span>
                {tagFiltro && (
                  <button
                    onClick={() => setTagFiltro(null)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Mostrar todas &times;
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => setTagFiltro(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                    !tagFiltro
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  )}
                >
                  Todas ({tagsDisponiveis.reduce((acc, t) => acc + t.count, 0)})
                </button>
                {tagsDisponiveis.map(t => {
                  const active = tagFiltro?.toLowerCase() === t.nome.toLowerCase()
                  return (
                    <button
                      key={t.nome}
                      onClick={() => setTagFiltro(active ? null : t.nome)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5",
                        active
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                      )}
                    >
                      <span>{t.nome}</span>
                      <span className={cn(
                        "px-1.5 py-0.2 text-[10px] rounded-full font-black",
                        active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                      )}>
                        {t.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Ranking de Performance dos Melhores Anúncios */}
          {adsMetrics.length > 0 && (
            <Card className="border border-indigo-100/80 bg-linear-to-br from-white via-indigo-50/20 to-purple-50/20 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    🏆
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      Ranking dos Melhores Anúncios (Campanhas Meta / Origem)
                    </h3>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Ordenado pelos que mais geraram visitas confirmadas, simulações aprovadas e leads qualificados.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                  {adsMetrics.length} anúncio{adsMetrics.length !== 1 ? 's' : ''} rastreado{adsMetrics.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {adsMetrics.map((ad, idx) => {
                  const isTop = idx === 0
                  return (
                    <div
                      key={ad.titulo + idx}
                      className={cn(
                        "p-3.5 rounded-xl border bg-white transition-all space-y-2.5 relative overflow-hidden",
                        isTop ? "border-amber-300 ring-2 ring-amber-200/60 shadow-xs" : "border-gray-100 shadow-2xs"
                      )}
                    >
                      {isTop && (
                        <span className="absolute top-0 right-0 bg-amber-400 text-amber-950 font-black text-[9px] uppercase px-2 py-0.5 rounded-bl-lg">
                          ★ #1 Mais Conversões
                        </span>
                      )}

                      <div className="space-y-1 pr-16">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          #{idx + 1} • {ad.canal || 'Meta Ads'}
                        </span>
                        <h4 className="text-xs font-bold text-gray-900 line-clamp-1 title" title={ad.titulo}>
                          {ad.titulo}
                        </h4>
                        {ad.id && (
                          <span className="text-[10px] font-mono text-gray-400 block truncate">
                            ID: {ad.id}
                          </span>
                        )}
                      </div>

                      {/* Badges de conversões do anúncio */}
                      <div className="grid grid-cols-4 gap-1 pt-1 border-t border-gray-50 text-center">
                        <div className="bg-gray-50 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-gray-400 block uppercase">Leads</span>
                          <span className="text-xs font-black text-gray-900">{ad.totalLeads}</span>
                        </div>
                        <div className="bg-cyan-50 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-cyan-600 block uppercase">Visitas</span>
                          <span className="text-xs font-black text-cyan-700">{ad.visitas}</span>
                        </div>
                        <div className="bg-green-50 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-green-600 block uppercase">Simulações</span>
                          <span className="text-xs font-black text-green-700">{ad.simulacoes}</span>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-indigo-600 block uppercase">Qualificados</span>
                          <span className="text-xs font-black text-indigo-700">{ad.qualificados}</span>
                        </div>
                      </div>

                      {ad.url && (
                        <a
                          href={ad.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline pt-0.5"
                        >
                          Abrir anúncio no Meta <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Painel expandido dos Leads do canal selecionado */}
          {canalFiltro && (
            <Card className="border border-indigo-100 bg-white rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    Leads do Canal: <span className="text-indigo-600">{canaisMetrics.list.find(c => c.key === canalFiltro)?.nome}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {leadsFiltradosPorCanal.length} lead{leadsFiltradosPorCanal.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Filtro secundário por Etiqueta / Tag dentro do canal */}
                {tagsDisponiveis.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={tagFiltro || ''}
                      onChange={e => setTagFiltro(e.target.value || null)}
                      className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">Todas as etiquetas</option>
                      {tagsDisponiveis.map(t => (
                        <option key={t.nome} value={t.nome}>
                          {t.nome} ({t.count})
                        </option>
                      ))}
                    </select>
                    {tagFiltro && (
                      <button
                        onClick={() => setTagFiltro(null)}
                        className="text-xs text-gray-400 hover:text-red-500 font-bold"
                        title="Limpar etiqueta"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              {leadsFiltradosPorCanal.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-6 text-center">Nenhum lead com os filtros selecionados.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {leadsFiltradosPorCanal.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => handleCardClick(lead)}
                      className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {lead.nome || 'Cliente sem nome'}
                          </span>
                          <span className="text-[11px] font-medium text-gray-400">
                            {formatarTelefone(lead.telefone)}
                          </span>
                        </div>
                        {lead.lead_finalizado ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-800 shrink-0">
                            Qualificado
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 shrink-0">
                            Em Andamento
                          </span>
                        )}
                      </div>

                      {/* Anúncio identificado */}
                      {(lead.anuncio_titulo || lead.anuncio_id) && (
                        <div className="bg-white rounded-lg p-2 border border-gray-100 text-[11px] space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Anúncio</span>
                          <p className="font-semibold text-gray-800 line-clamp-1">{lead.anuncio_titulo || 'Anúncio Meta'}</p>
                          {lead.anuncio_url && (
                            <a
                              href={lead.anuncio_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline pt-0.5"
                            >
                              Ver anúncio <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Tags / Etiquetas */}
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {lead.tags.map((tag: any) => {
                            const isHex = tag.cor?.startsWith('#')
                            return (
                              <span
                                key={tag.id}
                                className={cn("px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border", !isHex && tag.cor)}
                                style={isHex ? { backgroundColor: `${tag.cor}18`, borderColor: `${tag.cor}55`, color: tag.cor } : undefined}
                              >
                                {tag.nome}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
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
                {qualifiedLeadsList.filter(l => matchesVisitasDate(l, visitasDate)).length} Qualificado{qualifiedLeadsList.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {qualifiedLeadsList
              .filter(l => matchesVisitasDate(l, visitasDate))
              .sort((a, b) => {
                const aTime = a.data_agendamento ? new Date(a.data_agendamento).getTime() : 0;
                const bTime = b.data_agendamento ? new Date(b.data_agendamento).getTime() : 0;
                return bTime - aTime;
              })
              .map((lead: any) => {
                const visitaInfo = formatarVisitaDashboard(lead);
                return (
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
                        {visitaInfo.hasAgendamento ? (
                          <div className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-100 whitespace-nowrap flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {visitaInfo.badgeText}
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
                      
                      {visitaInfo.hasAgendamento && (
                        <div className="pt-2 flex items-center gap-2 text-xs font-bold text-gray-500">
                           {visitaInfo.dataTexto}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Modal Interativo ao Clicar em Qualquer Card de KPI */}
      <Dialog open={!!kpiModal} onOpenChange={(open) => { if (!open) setKpiModal(null) }}>
        <DialogContent className="max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden font-poppins rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-8 rounded-full ${kpiModal?.color || 'bg-indigo-600'}`} />
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900">
                    {kpiModal?.title}
                  </DialogTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {kpiModal?.subtitle}
                    {canalFiltro && (
                      <span className="ml-1 font-semibold text-indigo-600">
                        (Filtrado por: {canaisMetrics.list.find(c => c.key === canalFiltro)?.nome || canalFiltro})
                      </span>
                    )} &bull; {leadsFiltradosPorKpi.length} {leadsFiltradosPorKpi.length === 1 ? 'lead' : 'leads'} encontrados
                  </p>
                </div>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, telefone, veículo ou etiqueta..."
                value={kpiSearch}
                onChange={(e) => setKpiSearch(e.target.value)}
                className="pl-9 h-10 text-sm bg-white rounded-xl border-gray-200"
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
            {leadsFiltradosPorKpi.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Nenhum lead encontrado nesta categoria no período selecionado.
              </div>
            ) : (
              leadsFiltradosPorKpi.map((lead: any) => (
                <div
                  key={lead.id}
                  onClick={() => handleCardClick(lead)}
                  className="p-4 sm:p-5 rounded-2xl border border-gray-100 bg-white hover:border-indigo-300 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 group"
                >
                  {/* Linha Superior: Avatar, Nome, Telefone, Canal, Data e Ação */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                        {(lead.nome || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                            {lead.nome || 'Cliente sem nome'}
                          </span>
                          <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                            {formatarTelefone(lead.telefone)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                          {lead.canal_label_name && (
                            <span 
                              className="px-2 py-0.5 rounded-md font-bold text-[11px] uppercase tracking-wider border shrink-0"
                              style={{
                                backgroundColor: lead.canal_color ? `${lead.canal_color}15` : '#eef2ff',
                                color: lead.canal_color || '#4f46e5',
                                borderColor: lead.canal_color ? `${lead.canal_color}30` : '#e0e7ff',
                              }}
                            >
                              📢 {lead.canal_label_name}
                            </span>
                          )}
                          {lead.created_at && (
                            <span className="text-[11px] text-gray-400">
                              Criado em {formatarHorarioMsg(lead.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <span>Abrir ficha</span>
                        <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                      </button>
                    </div>
                  </div>

                  {/* Badges de Informações do Lead (Veículo de Interesse, CPF, Nascimento, Entrada, Troca, CNH) */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {/* Veículo de interesse: sempre exibido conforme solicitado (se não tiver, 'null') */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 font-medium">
                      <span>🚗 Veículo de interesse:</span>
                      <strong className={lead.veiculo_interessado ? "text-slate-900 font-bold" : "text-gray-400 font-mono font-normal"}>
                        {lead.veiculo_interessado || 'null'}
                      </strong>
                    </div>

                    {lead.cpf_cnpj && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 font-medium">
                        🪪 CPF: <strong className="font-mono">{lead.cpf_cnpj}</strong>
                      </span>
                    )}

                    {lead.data_nascimento && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800 font-medium">
                        🎂 Nasc: <strong>{lead.data_nascimento}</strong>
                      </span>
                    )}

                    {lead.possui_cnh !== null && lead.possui_cnh !== undefined && (
                      <span className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border",
                        lead.possui_cnh ? "bg-amber-50 border-amber-200/70 text-amber-800" : "bg-gray-50 border-gray-200 text-gray-500"
                      )}>
                        💳 {lead.possui_cnh ? 'Possui CNH' : 'Sem CNH'}
                      </span>
                    )}

                    {lead.valor_entrada && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 border border-green-100 text-xs text-green-800 font-medium">
                        💰 Entrada: <strong>{lead.valor_entrada.startsWith('R$') ? lead.valor_entrada : `R$ ${lead.valor_entrada}`}</strong>
                      </span>
                    )}

                    {lead.veiculo_troca && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-800 font-medium" title={lead.veiculo_troca}>
                        🔄 Troca: <strong className="truncate max-w-[200px]">{lead.veiculo_troca}</strong>
                      </span>
                    )}
                  </div>

                  {/* Bloco de Atendimento: Última Mensagem, Horário, Remetente e Média de Tempo de Resposta */}
                  <div className="bg-gray-50/70 hover:bg-gray-50 transition-colors rounded-xl p-3 border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {lead.ultimo_remetente === 'vendedor' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Vendedor (Loja)
                          </span>
                        ) : lead.ultimo_remetente === 'cliente' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            Cliente (Eles)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-600">
                            Última Mensagem
                          </span>
                        )}

                        {lead.ultimo_timestamp && (
                          <span className="text-[11px] text-gray-400 font-medium">
                            {formatarHorarioMsg(lead.ultimo_timestamp)}
                          </span>
                        )}
                      </div>

                      {/* Média de tempo de resposta */}
                      <div className="flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                        <span>⏱️ Média de resposta:</span>
                        <strong className="text-gray-900 font-bold">
                          {formatarTempoResposta(lead.tempo_medio_resposta_segundos) || 'Sem cálculo'}
                        </strong>
                      </div>
                    </div>

                    {lead.ultima_mensagem ? (
                      <p className="text-xs text-gray-600 italic line-clamp-2 bg-white/60 p-2 rounded-lg border border-gray-100/80">
                        &ldquo;{lead.ultima_mensagem}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Nenhuma mensagem recente registrada.
                      </p>
                    )}
                  </div>

                  {/* Tags do WhatsApp e CRM */}
                  {lead.tags && lead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {lead.tags.map((t: any, i: number) => (
                        <span
                          key={i}
                          style={{ backgroundColor: `${t.cor}15`, color: t.cor || '#4f46e5' }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-black/5"
                        >
                          {t.nome}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LeadDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          fetchData()
        }}
        isSemIA={isSemIA}
        onLeadUpdated={(leadId, updates) => {
          setAllLeads(prev => prev.map(l => (l.id === leadId || String(l.original_id) === String(leadId)) ? { ...l, ...updates } : l))
          if (selectedLead && (selectedLead.id === leadId || String(selectedLead.original_id) === String(leadId))) {
            setSelectedLead(prev => prev ? { ...prev, ...updates } : null)
          }
        }}
      />
    </div>
  )
}
