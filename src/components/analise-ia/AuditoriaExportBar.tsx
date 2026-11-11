"use client"

import { useState } from "react"
import {
  FileText,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Camera,
  PackageX,
  UserCheck,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Info,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AuditoriaRelatorioProps {
  clienteNome?: string
  onOpenLead?: (lead: any) => void
}

function formatarDataHora(dataStr?: string | null) {
  if (!dataStr) return null
  try {
    let s = String(dataStr).trim()
    if (!s) return null
    if (!s.includes('T') && s.includes(' ')) {
      s = s.replace(' ', 'T')
    }
    if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-03') && !s.includes('-00')) {
      s += 'Z'
    }
    const d = new Date(s)
    if (isNaN(d.getTime())) return null
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return null
  }
}

export function AuditoriaExportModal({
  isOpen,
  onClose,
  dados,
  clienteNome,
  onOpenLead
}: {
  isOpen: boolean
  onClose: () => void
  dados: any
  clienteNome?: string
  onOpenLead?: (lead: any) => void
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<string>("todos")

  if (!isOpen || !dados) return null

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const headers = [
      "Nome",
      "Telefone",
      "Data Criacao Lead",
      "Veiculo Interesse",
      "Origem",
      "Mandou Fotos",
      "Data Fotos",
      "Disse Sem Estoque",
      "Data Sem Estoque",
      "Mal Entendido Estoque",
      "Sugestao Estoque",
      "Intervencao Humana",
      "Data Intervencao",
      "Coletou Ficha / Simulacao",
      "Data Ficha",
      "Deu Erro",
      "Data Erro",
      "Motivo do Erro / Ocorrencia",
      "Status Geral"
    ]

    const rows = (dados.leads || []).map((l: any) => [
      `"${l.nome || ""}"`,
      `"${l.telefone || ""}"`,
      `"${formatarDataHora(l.dataCriacao) || ""}"`,
      `"${l.veiculoInteresse || ""}"`,
      `"${l.origem || ""}"`,
      l.mandouFotos ? "Sim" : "Não",
      `"${formatarDataHora(l.dataFotos) || ""}"`,
      l.falouSemEstoque ? "Sim" : "Não",
      `"${formatarDataHora(l.dataSemEstoque) || ""}"`,
      l.possivelMalEntendido ? "Sim" : "Não",
      `"${l.sugestaoEstoque || ""}"`,
      l.intervenienteHumano ? "Sim" : "Não",
      `"${formatarDataHora(l.dataIntervencao) || ""}"`,
      l.coletouFicha ? "Sim" : "Não",
      `"${formatarDataHora(l.dataFicha) || ""}"`,
      l.deuErro ? "Sim" : "Não",
      `"${formatarDataHora(l.dataErro) || ""}"`,
      `"${(l.detalheErro || l.motivoSemEstoque || "").replace(/"/g, '""')}"`,
      l.statusGeral
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `auditoria_ia_${dados.cliente || "cliente"}_${dados.periodo?.de}_a_${dados.periodo?.ate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const r = dados.resumo || {}

  // Filtros de busca e status na tabela
  const leadsFiltrados = (dados.leads || []).filter((l: any) => {
    const matchesSearch = 
      !searchTerm ||
      (l.nome && l.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.telefone && l.telefone.includes(searchTerm)) ||
      (l.veiculoInteresse && l.veiculoInteresse.toLowerCase().includes(searchTerm.toLowerCase()))

    if (!matchesSearch) return false

    if (filtroStatus === "erros") return l.deuErro || l.possivelMalEntendido
    if (filtroStatus === "fotos") return l.mandouFotos
    if (filtroStatus === "sem_estoque") return l.falouSemEstoque
    if (filtroStatus === "humano") return l.intervenienteHumano
    if (filtroStatus === "ficha") return l.coletouFicha

    return true
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col font-poppins">
        {/* Header com botões de ação */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/70 sticky top-0 z-10 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                Relatório de Auditoria de IA & Conversas
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {dados.cliente} • Período: {dados.periodo?.de} até {dados.periodo?.ate} ({dados.periodo?.dias} dias)
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" /> Exportar Planilha (CSV)
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" /> Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Conteúdo do Relatório */}
        <div className="p-6 space-y-6">
          {/* Card Resumo com Score */}
          <div className="bg-linear-to-br from-indigo-900 via-indigo-800 to-indigo-700 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Score de Eficiência da IA</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-4xl font-black">{r.scoreEficiencia}%</h3>
                  <span className="text-xs text-indigo-200 font-medium">de assertividade</span>
                </div>
                <p className="text-[11px] text-indigo-200 mt-1">
                  {r.scoreEficiencia >= 85 ? "🟢 Alta fidelidade nas conversas" : "🟡 Atenção em alguns mal-entendidos"}
                </p>
              </div>

              <div className="border-t md:border-t-0 md:border-l border-indigo-500/40 md:pl-6 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Total de Leads</span>
                <p className="text-2xl font-black">{r.totalLeads}</p>
                <p className="text-[10px] text-indigo-200">{r.totalConversasComMensagens} com diálogo registrado</p>
              </div>

              <div className="border-t md:border-t-0 md:border-l border-indigo-500/40 md:pl-6 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Envio de Fotos</span>
                <p className="text-2xl font-black text-emerald-300">{r.totalFotos} ({r.pctFotos}%)</p>
                <p className="text-[10px] text-indigo-200">Leads que receberam fotos reais</p>
              </div>

              <div className="border-t md:border-t-0 md:border-l border-indigo-500/40 md:pl-6 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Intervenção Loja</span>
                <p className="text-2xl font-black text-amber-300">{r.totalIntervencoes} ({r.pctIntervencoes}%)</p>
                <p className="text-[10px] text-indigo-200">Vendedores assumiram o chat</p>
              </div>
            </div>
          </div>

          {/* 4 Indicadores Cruciais para o Lojista */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Envio de Fotos</span>
                <Camera className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-gray-900">{r.totalFotos}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{r.pctFotos}% dos leads receberam imagens</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="flex items-center justify-between text-indigo-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Ficha / Crédito</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-gray-900">{r.totalFichasOuSimulacoes}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{r.pctFichas}% avançaram para análise</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Fora de Estoque</span>
                <PackageX className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-gray-900">{r.totalSemEstoque}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{r.pctSemEstoque}% pediram carro sem estoque</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
              <div className="flex items-center justify-between text-rose-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Falhas / Erros</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-rose-600">{r.totalErros}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Ocorrências pontuais registradas</p>
            </div>
          </div>

          {/* Destaque: Casos de Mal-Entendido ou Estoque Recusado */}
          {dados.leads?.some((l: any) => l.possivelMalEntendido || l.falouSemEstoque) && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Auditoria de Estoque: Veículos Recusados ou Mal-Entendidos
                </h4>
              </div>
              <p className="text-xs text-amber-800">
                Abaixo estão conversas onde o cliente pediu um carro e a IA respondeu que não tinha disponível. Clique no lead para ver a conversa completa:
              </p>
              <div className="space-y-2">
                {dados.leads
                  .filter((l: any) => l.possivelMalEntendido || l.falouSemEstoque)
                  .slice(0, 6)
                  .map((l: any, i: number) => (
                    <div 
                      key={i} 
                      onClick={() => onOpenLead && onOpenLead(l.rawLead)}
                      className="p-3 bg-white rounded-xl border border-amber-200/60 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 cursor-pointer hover:border-indigo-400 hover:shadow-xs transition-all group"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{l.nome}</span>
                          <span className="text-gray-400 font-mono text-[11px]">({l.telefone})</span>
                          {l.dataSemEstoque && (
                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-gray-400" /> {formatarDataHora(l.dataSemEstoque)}
                            </span>
                          )}
                          <span className="text-gray-400">•</span>
                          <span className="font-semibold text-gray-600">Interesse: {l.veiculoInteresse}</span>
                        </div>
                        {l.motivoSemEstoque && (
                          <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-1">"{l.motivoSemEstoque}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.sugestaoEstoque && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black">
                            💡 {l.sugestaoEstoque}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-indigo-600 group-hover:underline flex items-center gap-0.5">
                          Ver conversa &rarr;
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Barra de Filtros da Tabela */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar lead, telefone ou veículo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "todos", label: "Todos" },
                { id: "erros", label: "Com Erros / Alertas" },
                { id: "fotos", label: "Enviou Fotos" },
                { id: "sem_estoque", label: "Sem Estoque" },
                { id: "humano", label: "Loja Assumiu" },
                { id: "ficha", label: "Ficha Coletada" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFiltroStatus(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                    filtroStatus === f.id
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela Completa Lead a Lead com Horários */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Auditoria Lead por Lead ({leadsFiltrados.length} de {dados.leads?.length || 0} leads)
              </h4>
              <span className="text-[11px] text-gray-400 font-medium">💡 Clique na linha do lead para abrir o chat completo</span>
            </div>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/90 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500 sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-2.5 px-3">Lead / Criado em</th>
                    <th className="py-2.5 px-3">Veículo de Interesse</th>
                    <th className="py-2.5 px-3 text-center">Fotos</th>
                    <th className="py-2.5 px-3 text-center">Estoque</th>
                    <th className="py-2.5 px-3 text-center">Intervenção Loja</th>
                    <th className="py-2.5 px-3 text-center">Ficha/Crédito</th>
                    <th className="py-2.5 px-3">Status & Ocorrência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leadsFiltrados.map((l: any, i: number) => (
                    <tr 
                      key={i} 
                      onClick={() => onOpenLead && onOpenLead(l.rawLead)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      title="Clique para abrir conversa completa deste lead"
                    >
                      {/* 1. Lead / Criado em */}
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                          <span>{l.nome}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity" />
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">{l.telefone}</p>
                        {l.dataCriacao && (
                          <p className="text-[9px] font-medium text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-gray-400" /> Criado: {formatarDataHora(l.dataCriacao)}
                          </p>
                        )}
                      </td>

                      {/* 2. Veículo */}
                      <td className="py-2.5 px-3 font-medium text-gray-700">
                        {l.veiculoInteresse}
                      </td>

                      {/* 3. Fotos com Data */}
                      <td className="py-2.5 px-3 text-center">
                        {l.mandouFotos ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-emerald-600 font-black">✓ Sim</span>
                            {l.dataFotos && (
                              <span className="text-[9px] text-gray-400 font-medium">
                                {formatarDataHora(l.dataFotos)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* 4. Estoque com Data */}
                      <td className="py-2.5 px-3 text-center">
                        {l.falouSemEstoque ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              l.possivelMalEntendido ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {l.possivelMalEntendido ? "Mal-Entendido" : "Não Tinha"}
                            </span>
                            {l.dataSemEstoque && (
                              <span className="text-[9px] text-gray-400 font-medium">
                                {formatarDataHora(l.dataSemEstoque)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Normal</span>
                        )}
                      </td>

                      {/* 5. Intervenção Loja com Data */}
                      <td className="py-2.5 px-3 text-center">
                        {l.intervenienteHumano ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                              Vendedor assumiu
                            </span>
                            {l.dataIntervencao && (
                              <span className="text-[9px] text-gray-400 font-medium">
                                {formatarDataHora(l.dataIntervencao)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">100% IA</span>
                        )}
                      </td>

                      {/* 6. Ficha com Data */}
                      <td className="py-2.5 px-3 text-center">
                        {l.coletouFicha ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-emerald-600 font-bold">✓ Coletou</span>
                            {l.dataFicha && (
                              <span className="text-[9px] text-gray-400 font-medium">
                                {formatarDataHora(l.dataFicha)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* 7. Status & Erro com Data */}
                      <td className="py-2.5 px-3">
                        {l.deuErro ? (
                          <div className="space-y-0.5 max-w-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black inline-flex items-center gap-1">
                                ⚠️ Erro
                              </span>
                              {l.dataErro && (
                                <span className="text-[9px] text-rose-500 font-medium">
                                  {formatarDataHora(l.dataErro)}
                                </span>
                              )}
                            </div>
                            {l.detalheErro && (
                              <p className="text-[10px] text-rose-700 font-medium leading-tight line-clamp-2" title={l.detalheErro}>
                                {l.detalheErro}
                              </p>
                            )}
                          </div>
                        ) : l.possivelMalEntendido ? (
                          <div className="space-y-0.5 max-w-xs">
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold inline-flex items-center gap-1">
                              🟡 Atenção
                            </span>
                            <p className="text-[10px] text-amber-800 font-medium leading-tight line-clamp-1" title={l.sugestaoEstoque}>
                              {l.sugestaoEstoque}
                            </p>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            ✓ Ok
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leadsFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400 text-xs">
                        Nenhum lead encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AuditoriaExportBar({ clienteNome, onOpenLead }: AuditoriaRelatorioProps) {
  const [periodo, setPeriodo] = useState<string>("7")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [dadosRelatorio, setDadosRelatorio] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleGerarRelatorio = async () => {
    setLoading(true)
    try {
      let url = `/api/analise-ia/relatorio?days=${periodo}`
      if (periodo === "custom" && customFrom && customTo) {
        url = `/api/analise-ia/relatorio?from=${customFrom}&to=${customTo}`
      }

      const res = await fetch(url)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDadosRelatorio(data)
      setModalOpen(true)
    } catch (err: any) {
      alert("Erro ao gerar relatório de auditoria: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-poppins">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span>Auditoria de Conversas & Relatório para o Cliente</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider">
                Novo
              </span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Prove com dados irrefutáveis se a IA enviou fotos, se faltou estoque, se deu erro ou se a loja assumiu.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
            {[
              { id: "7", label: "7 dias" },
              { id: "15", label: "15 dias" },
              { id: "30", label: "30 dias" },
              { id: "custom", label: "Personalizado" }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  periodo === p.id
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-gray-500 hover:text-gray-900 hover:bg-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodo === "custom" && (
            <div className="flex items-center gap-1.5 text-xs bg-gray-50 p-1.5 rounded-xl border border-gray-200 animate-in fade-in">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-transparent text-xs text-gray-700 outline-none"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-transparent text-xs text-gray-700 outline-none"
              />
            </div>
          )}

          <button
            onClick={handleGerarRelatorio}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            {loading ? "Auditando Conversas..." : "Gerar Relatório de Auditoria"}
          </button>
        </div>
      </div>

      <AuditoriaExportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        dados={dadosRelatorio}
        clienteNome={clienteNome}
        onOpenLead={onOpenLead}
      />
    </>
  )
}
