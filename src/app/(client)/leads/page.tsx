"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Eye, Plus, ArrowUpDown, Filter, ShieldBan, Megaphone, Tag, MessageSquare, ExternalLink, Calendar, Check } from "lucide-react"
import { LeadDrawer, LeadType } from "@/components/leads/LeadDrawer"
import { AddLeadModal } from "@/components/leads/AddLeadModal"
import { calcularEtapaIA } from "@/lib/funil/calcular-etapa"
import { cn } from "@/lib/utils"
import { formatarVisitaDashboard } from "@/lib/agendamento-utils"
import { ChannelIcon } from "@/components/common/ChannelIcon"

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'ia_sem_contato', label: 'Sem contato' },
  { value: 'ia_em_andamento', label: 'Em andamento' },
  { value: 'ia_followup', label: 'Follow-up' },
  { value: 'ia_qualificado', label: 'Qualificado' },
  { value: 'ia_perda', label: 'Perda' },
]

const STATUS_STYLE: Record<string, string> = {
  ia_sem_contato:  'bg-gray-50 text-gray-500 border-gray-200',
  ia_em_andamento: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  ia_followup:     'bg-orange-50 text-orange-600 border-orange-100',
  ia_qualificado:  'bg-emerald-50 text-emerald-600 border-emerald-100',
  ia_perda:        'bg-red-50 text-red-500 border-red-100',
}

const STATUS_LABEL: Record<string, string> = {
  ia_sem_contato:  'Sem contato',
  ia_em_andamento: 'Em andamento',
  ia_followup:     'Follow-up',
  ia_qualificado:  'Qualificado',
  ia_perda:        'Perda',
}

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<LeadType | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCanais, setFilterCanais] = useState<string[]>([])
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'ultima_mensagem' | 'created_at'>('ultima_mensagem')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')
  const [tipoAtendimento, setTipoAtendimento] = useState<'com_ia' | 'sem_ia'>('com_ia')

  useEffect(() => { fetchLeads() }, [])

  // Toggle multi-select canal
  const toggleCanal = (canalKey: string) => {
    setFilterCanais(prev =>
      prev.includes(canalKey) ? prev.filter(k => k !== canalKey) : [...prev, canalKey]
    );
  };

  // Toggle multi-select tag
  const toggleTag = (tagNome: string) => {
    const lower = tagNome.toLowerCase();
    setFilterTags(prev =>
      prev.some(t => t.toLowerCase() === lower)
        ? prev.filter(t => t.toLowerCase() !== lower)
        : [...prev, tagNome]
    );
  };

  const formatarTelefone = (tel?: string | null) => {
    if (!tel) return '-';
    let limpo = tel.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    if (!limpo) return tel.split('@')[0];
    if (limpo.startsWith('55')) limpo = limpo.slice(2);
    if (limpo.length === 11) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    if (limpo.length === 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return limpo;
  };

  const formatTs = (ts?: string | null, opts?: Intl.DateTimeFormatOptions) => {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', opts || { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getStageKey = (lead: any): string => {
    if (lead.origem === 'manual') {
      if (lead.etapa_manual_nome?.toLowerCase() === 'qualificado') return 'qualificado';
      return 'manual';
    }
    return calcularEtapaIA(lead);
  };

  const getStageName = (lead: any) => {
    if (lead.origem === 'manual') return lead.etapa_manual_nome || 'Lead Manual';
    return STATUS_LABEL[getStageKey(lead)] || 'Em andamento';
  };

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads')
      const json = await res.json()
      if (json.data) setLeads(json.data)
      if (json.tipo_atendimento) setTipoAtendimento(json.tipo_atendimento)
    } catch (err) {
      console.error("Failed to fetch leads", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (lead: any) => {
    const formattedLead: LeadType = {
      id: lead.id?.toString() || "",
      nome: lead.nome || "Cliente",
      telefone: lead.telefone || lead.phone || "",
      veiculo: lead.veiculo_interessado || lead.veiculo || lead.carro || "",
      vendedor: lead.vendedor_lead || "IA",
      status: getStageName(lead),
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
      endereco: lead.endereço || null,
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

  const toggleSort = (col: 'ultima_mensagem' | 'created_at') => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  // Extrai lista única de canais disponíveis
  const canaisDisponiveis = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const l of leads) {
      const key = l.canal_origem || 'desconhecido';
      const label = l.canal_label_name || (
        key === 'facebook_ads' ? 'Facebook Ads' :
        key === 'instagram_ads' ? 'Instagram Ads' :
        key === 'meta_ads' ? 'Meta Ads' :
        key === 'facebook_marketplace' ? 'Marketplace' :
        key === 'mercado_livre' ? 'Mercado Livre' :
        key === 'webmotors' ? 'WebMotors' :
        key === 'olx' ? 'OLX' :
        key === 'icarros' ? 'iCarros' :
        'Direto / Desconhecido'
      );
      if (!map.has(key)) {
        map.set(key, { key, label, count: 0 });
      }
      map.get(key)!.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [leads]);

  // Extrai lista única de tags disponíveis
  const tagsDisponiveis = useMemo(() => {
    const map = new Map<string, { nome: string; count: number }>();
    for (const l of leads) {
      for (const t of (l.tags || [])) {
        if (!map.has(t.nome)) {
          map.set(t.nome, { nome: t.nome, count: 0 });
        }
        map.get(t.nome)!.count += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads.filter(l => {
      const matchSearch =
        (l.nome || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.telefone || '').includes(search);

      const matchStatus = !filterStatus || getStageKey(l) === filterStatus;

      // Multi-seleção de canais
      const matchCanal = filterCanais.length === 0 || filterCanais.includes(l.canal_origem || 'desconhecido');

      // Multi-seleção de tags
      const matchTag = filterTags.length === 0 || (l.tags || []).some((t: any) =>
        filterTags.some(ft => ft.toLowerCase() === t.nome.toLowerCase())
      );

      const matchData = (() => {
        const rawDate = sortBy === 'ultima_mensagem' ? (l.updated_at || l.created_at) : l.created_at;
        if (!rawDate) return true;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return true;
        const iso = d.toISOString();
        if (filterDataInicio && iso < filterDataInicio) return false;
        if (filterDataFim && iso > filterDataFim + 'T23:59:59.999Z') return false;
        return true;
      })();

      return matchSearch && matchStatus && matchCanal && matchTag && matchData;
    });

    result.sort((a, b) => {
      const getTimestamp = (lead: any) => {
        const raw = sortBy === 'ultima_mensagem' ? (lead.updated_at || lead.created_at) : lead.created_at;
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return isNaN(t) ? 0 : t;
      };
      const aVal = getTimestamp(a);
      const bVal = getTimestamp(b);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [leads, search, filterStatus, filterCanais, filterTags, filterDataInicio, filterDataFim, sortBy, sortDir]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 font-poppins pb-10">
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchLeads}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gestão de Leads</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {tipoAtendimento === 'sem_ia' ? 'Acompanhe todos os contatos e oportunidades em tempo real.' : 'Acompanhe as oportunidades captadas pela IA em tempo real.'}
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Lead manual
        </Button>
      </div>

      {/* Filtros */}
      {/* Barra de Seleção Rápida por Canal de Atendimento (Multi-Seleção com Checkbox) */}
      {canaisDisponiveis.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-indigo-500" />
              Filtrar por Canal de Entrada
              {filterCanais.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                  {filterCanais.length} selecionado{filterCanais.length > 1 ? 's' : ''}
                </span>
              )}
            </span>
            {filterCanais.length > 0 && (
              <button
                onClick={() => setFilterCanais([])}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                Limpar canais &times;
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              onClick={() => setFilterCanais([])}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0",
                filterCanais.length === 0
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-gray-50/70 border-gray-100 text-gray-600 hover:bg-gray-100/70"
              )}
            >
              <span>Todos os Canais</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                filterCanais.length === 0 ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
              )}>
                {leads.length}
              </span>
            </button>
            {canaisDisponiveis.map(c => {
              const isChecked = filterCanais.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => toggleCanal(c.key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 select-none",
                    isChecked
                      ? "ring-2 ring-indigo-500 bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm"
                      : "bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50/50"
                  )}
                >
                  {/* Checkbox visual */}
                  <span
                    className={cn(
                      "w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0",
                      isChecked
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>

                  <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
                  <span className="truncate max-w-[140px]">{c.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    isChecked ? "bg-indigo-200/60 text-indigo-900" : "bg-gray-100 text-gray-600"
                  )}>
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de Seleção Rápida por Etiquetas / Estágios (Multi-Seleção com Checkbox) */}
      {tagsDisponiveis.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              Filtrar por Etiquetas do WhatsApp & Estágios
              {filterTags.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                  {filterTags.length} selecionada{filterTags.length > 1 ? 's' : ''}
                </span>
              )}
            </span>
            {filterTags.length > 0 && (
              <button
                onClick={() => setFilterTags([])}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                Limpar etiquetas &times;
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              onClick={() => setFilterTags([])}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0",
                filterTags.length === 0
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-gray-50/70 border-gray-100 text-gray-600 hover:bg-gray-100/70"
              )}
            >
              <span>Todas as Etiquetas</span>
            </button>
            {tagsDisponiveis.map(t => {
              const isChecked = filterTags.some(ft => ft.toLowerCase() === t.nome.toLowerCase());
              return (
                <button
                  key={t.nome}
                  onClick={() => toggleTag(t.nome)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 select-none",
                    isChecked
                      ? "ring-2 ring-indigo-500 bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm"
                      : "bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50/50"
                  )}
                >
                  {/* Checkbox visual */}
                  <span
                    className={cn(
                      "w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0",
                      isChecked
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>

                  <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
                  <span className="truncate max-w-[170px]">{t.nome}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    isChecked ? "bg-indigo-200/60 text-indigo-900" : "bg-gray-100 text-gray-600"
                  )}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros de Busca e Ordenação */}
      <Card className="border border-gray-100 shadow-sm bg-white rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Busca */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, telefone ou carro..."
                className="pl-9 h-10 bg-white border-gray-100 rounded-xl text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-10 px-3 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Filtro por data */}
            <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl p-1 shadow-xs h-10">
              <Filter className="h-3.5 w-3.5 text-gray-400 ml-2" />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-gray-400 uppercase leading-none ml-1">Início</span>
                <input
                  type="date"
                  value={filterDataInicio}
                  onChange={e => setFilterDataInicio(e.target.value)}
                  className="h-5 px-1 text-xs text-gray-600 focus:outline-none bg-transparent"
                />
              </div>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-gray-400 uppercase leading-none ml-1">Fim</span>
                <input
                  type="date"
                  value={filterDataFim}
                  onChange={e => setFilterDataFim(e.target.value)}
                  className="h-5 px-1 text-xs text-gray-600 focus:outline-none bg-transparent"
                />
              </div>
              {(filterDataInicio || filterDataFim) && (
                <button 
                  onClick={() => { setFilterDataInicio(''); setFilterDataFim(''); }} 
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors mr-2 font-bold"
                  title="Limpar datas"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSort('ultima_mensagem')}
              className={cn("flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold border transition-all",
                sortBy === 'ultima_mensagem' ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-white text-gray-500 border-gray-100 hover:border-gray-200"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Últ. mensagem {sortBy === 'ultima_mensagem' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button
              onClick={() => toggleSort('created_at')}
              className={cn("flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold border transition-all",
                sortBy === 'created_at' ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-white text-gray-500 border-gray-100 hover:border-gray-200"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Criação {sortBy === 'created_at' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
          </div>
        </div>

        {/* Tabela de Leads com Rolagem Horizontal Suave */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1050px]">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] min-w-[240px]">Cliente & Canal</th>
                <th className="px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] min-w-[200px]">Etiquetas (WhatsApp)</th>
                <th className="px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] min-w-[180px]">Origem / Anúncio</th>
                <th className="px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] min-w-[160px]">Interesse</th>
                <th className="px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] min-w-[200px]">Última Atividade</th>
                <th className="px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] min-w-[150px]">Status & Agendamento</th>
                <th className="px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] text-center min-w-[100px]">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400 font-medium animate-pulse">
                    Carregando leads...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400 font-medium italic">
                    Nenhum lead encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const stageKey = getStageKey(lead);
                  return (
                    <tr
                      key={lead.id}
                      className="group hover:bg-indigo-50/20 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(lead)}
                    >
                      {/* Cliente & Canal */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{lead.nome || 'Cliente S/ Nome'}</span>
                          <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">{formatarTelefone(lead.telefone || lead.phone)}</span>
                          
                          {lead.canal_origem && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                style={lead.canal_color ? {
                                  backgroundColor: `${lead.canal_color}15`,
                                  borderColor: `${lead.canal_color}40`,
                                  color: lead.canal_color,
                                } : {
                                  backgroundColor: '#eef2ff',
                                  borderColor: '#c7d2fe',
                                  color: '#4f46e5',
                                }}
                              >
                                <ChannelIcon canal={lead.canal_origem} label={lead.canal_label_name} className="w-3 h-3 shrink-0" />
                                {lead.canal_label_name || lead.canal_origem}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Etiquetas (WhatsApp & CRM) */}
                      <td className="px-5 py-3.5">
                        {lead.tags && lead.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {lead.tags.map((tag: any) => {
                              const isHex = tag.cor?.startsWith('#');
                              return (
                                <span
                                  key={tag.id}
                                  className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border", !isHex && tag.cor)}
                                  style={isHex ? { backgroundColor: `${tag.cor}18`, borderColor: `${tag.cor}55`, color: tag.cor } : undefined}
                                >
                                  {tag.nome}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">-</span>
                        )}
                      </td>

                      {/* Origem / Anúncio */}
                      <td className="px-5 py-3.5">
                        {lead.anuncio_titulo || lead.anuncio_id ? (
                          <div className="flex flex-col gap-0.5 text-xs max-w-[200px]">
                            <span className="font-bold text-gray-800 line-clamp-1">{lead.anuncio_titulo || 'Anúncio Meta'}</span>
                            {lead.anuncio_id && (
                              <span className="text-[10px] text-gray-400 font-mono">ID: {lead.anuncio_id}</span>
                            )}
                            {lead.anuncio_url && (
                              <a
                                href={lead.anuncio_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline pt-0.5"
                              >
                                Anúncio original <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Entrada direta</span>
                        )}
                      </td>

                      {/* Veículo de Interesse */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-gray-700 line-clamp-2 max-w-[180px]">{lead.veiculo_interessado || '-'}</span>
                      </td>

                      {/* Última Atividade */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          {(lead.ultima_mensagem && !lead.ultima_mensagem.startsWith('202')) || lead.notas ? (
                            <span className="text-xs text-gray-600 line-clamp-1 max-w-[240px]">
                              {lead.ultima_mensagem && !lead.ultima_mensagem.startsWith('202') 
                                ? `"${lead.ultima_mensagem.substring(0, 40)}..."` 
                                : lead.notas}
                            </span>
                          ) : null}
                          <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">
                            Criado: {formatTs(lead.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • 
                            Últ: {formatTs(lead.updated_at || lead.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Status & Agendamento */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs",
                              STATUS_STYLE[stageKey] || 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            )}>
                              {getStageName(lead)}
                            </span>
                            {(lead.quantidade_followup || 0) > 0 && !lead.is_blocked && (
                              <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-100">
                                {lead.quantidade_followup}× FU
                              </span>
                            )}
                            {lead.is_blocked && (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 uppercase tracking-wider">
                                <ShieldBan className="w-3 h-3" /> Humano
                              </span>
                            )}
                          </div>
                          {(() => {
                            const vi = formatarVisitaDashboard(lead);
                            if (!vi.hasAgendamento) return null;
                            const badge = vi.badgeText ? `${vi.dataFormatada ? vi.dataFormatada.slice(0, 5) + ' • ' : ''}${vi.badgeText}` : vi.dataFormatada;
                            return (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-amber-600" />
                                {badge}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Ação */}
                      <td className="px-5 py-3.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold transition-all text-xs h-8 px-3"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <LeadDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        isSemIA={tipoAtendimento === 'sem_ia'}
        onLeadUpdated={(leadId, updates) => {
          setLeads(prev => prev.map(l => (l.id === leadId || String(l.original_id) === String(leadId)) ? { ...l, ...updates } : l))
          if (selectedLead && (selectedLead.id === leadId || String(selectedLead.original_id) === String(leadId))) {
            setSelectedLead(prev => prev ? { ...prev, ...updates } : null)
          }
        }}
      />
    </div>
  )
}
