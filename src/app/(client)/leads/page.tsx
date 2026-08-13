"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Eye, Plus, ArrowUpDown, Filter } from "lucide-react"
import { LeadDrawer, LeadType } from "@/components/leads/LeadDrawer"
import { AddLeadModal } from "@/components/leads/AddLeadModal"
import { calcularEtapaIA } from "@/lib/funil/calcular-etapa"
import { cn } from "@/lib/utils"

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
  const [sortBy, setSortBy] = useState<'ultima_mensagem' | 'created_at'>('ultima_mensagem')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [filterData, setFilterData] = useState('')

  useEffect(() => { fetchLeads() }, [])

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

  const toggleSort = (col: 'ultima_mensagem' | 'created_at') => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const filtered = useMemo(() => {
    let result = leads.filter(l => {
      const matchSearch =
        (l.nome || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.telefone || '').includes(search);

      const matchStatus = !filterStatus || getStageKey(l) === filterStatus;

      const matchData = !filterData || (() => {
        const d = new Date(sortBy === 'ultima_mensagem' ? (l.ultima_mensagem || l.created_at) : l.created_at);
        return d.toISOString().startsWith(filterData);
      })();

      return matchSearch && matchStatus && matchData;
    });

    result.sort((a, b) => {
      const aVal = sortBy === 'ultima_mensagem'
        ? new Date(a.ultima_mensagem || a.created_at || 0).getTime()
        : new Date(a.created_at || 0).getTime();
      const bVal = sortBy === 'ultima_mensagem'
        ? new Date(b.ultima_mensagem || b.created_at || 0).getTime()
        : new Date(b.created_at || 0).getTime();
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [leads, search, filterStatus, filterData, sortBy, sortDir]);

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
          <p className="text-gray-500 mt-1 text-sm">Acompanhe as oportunidades captadas pela IA em tempo real.</p>
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
      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex flex-wrap gap-3 items-center">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9 h-9 bg-white border-gray-100 rounded-lg text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Filtro por data */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={filterData}
              onChange={e => setFilterData(e.target.value)}
              className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {filterData && (
              <button onClick={() => setFilterData('')} className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
            )}
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => toggleSort('ultima_mensagem')}
              className={cn("flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold border transition-all",
                sortBy === 'ultima_mensagem' ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-white text-gray-500 border-gray-200"
              )}
            >
              <ArrowUpDown className="h-3 w-3" />
              Últ. mensagem {sortBy === 'ultima_mensagem' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button
              onClick={() => toggleSort('created_at')}
              className={cn("flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold border transition-all",
                sortBy === 'created_at' ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-white text-gray-500 border-gray-200"
              )}
            >
              <ArrowUpDown className="h-3 w-3" />
              Criação {sortBy === 'created_at' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Interesse</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Última Atividade</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Observação</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-medium animate-pulse">
                    Carregando leads...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-medium italic">
                    Nenhum lead encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const stageKey = getStageKey(lead);
                  return (
                    <tr
                      key={lead.id}
                      className="group hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(lead)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{lead.nome || 'Cliente S/ Nome'}</span>
                          <span className="text-xs font-medium text-gray-400 mt-0.5 whitespace-nowrap">{formatarTelefone(lead.telefone || lead.phone)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-600">{lead.veiculo_interessado || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          {(lead.ultima_mensagem && !lead.ultima_mensagem.startsWith('202')) || lead.notas ? (
                            <span className="text-sm text-gray-500 line-clamp-1 max-w-[250px]">
                              {lead.ultima_mensagem && !lead.ultima_mensagem.startsWith('202') 
                                ? `"${lead.ultima_mensagem.substring(0, 45)}..."` 
                                : lead.notas}
                            </span>
                          ) : null}
                          <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">
                            Criado: {formatTs(lead.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • 
                            Últ. Msg: {formatTs(lead.ultima_mensagem || lead.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 line-clamp-2 max-w-[200px]" title={lead.observacao_lead_qualificado || ''}>
                            {lead.observacao_lead_qualificado || '-'}
                          </span>
                          {lead.data_agendamento && (
                            <span className="text-[10px] font-bold text-amber-600 mt-1 uppercase">
                              📅 {formatTs(lead.data_agendamento, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm",
                            STATUS_STYLE[stageKey] || 'bg-indigo-50 text-indigo-600 border-indigo-100'
                          )}>
                            {getStageName(lead)}
                          </span>
                          {(lead.quantidade_followup || 0) > 0 && (
                            <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                              {lead.quantidade_followup}× FU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg font-bold transition-all"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
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
      />
    </div>
  )
}
