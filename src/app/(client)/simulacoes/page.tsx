"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Calculator,
  Search,
  RefreshCw,
  Clock,
  User,
  Car,
  Landmark,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  X,
  Phone,
  FileText,
  BadgeCheck,
  Building2,
  DollarSign,
  Calendar,
  MessageCircle,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CredereSimulation,
  CredereSimulationsPaging,
  CredereSimulationCondition,
} from "@/lib/credere/types"

export default function SimulacoesPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [storePendente, setStorePendente] = useState(false)
  const [clienteNome, setClienteNome] = useState("")

  // Dados da listagem
  const [simulations, setSimulations] = useState<CredereSimulation[]>([])
  const [paging, setPaging] = useState<CredereSimulationsPaging | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Filtros
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<string>("created_at_desc")
  const [statusFilter, setStatusFilter] = useState<"todos" | "aprovadas" | "reprovadas">("todos")
  const [dataInicio, setDataInicio] = useState<string>("")
  const [dataFim, setDataFim] = useState<string>("")
  const [periodPreset, setPeriodPreset] = useState<string>("total")

  // Modal de Detalhes
  const [selectedSim, setSelectedSim] = useState<CredereSimulation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Formatação de valores monetários (centavos para R$)
  const formatCurrency = (cents?: number | null) => {
    if (cents === null || cents === undefined) return "R$ 0,00"
    const val = cents / 100
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  // Formatação de data/hora
  const formatDateTime = (isoDate?: string | null) => {
    if (!isoDate) return "-"
    try {
      const d = new Date(isoDate)
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "-"
    }
  }

  // Formatar Telefone para link WhatsApp
  const cleanPhone = (phone?: string | null) => {
    if (!phone) return null
    const cleaned = phone.replace(/\D/g, "")
    return cleaned.length >= 10 ? cleaned : null
  }

  // Buscar Simulações
  const fetchSimulations = useCallback(
    async (pageToLoad = 1, isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const params = new URLSearchParams()
        params.set("page", String(pageToLoad))
        params.set("per_page", "12")
        params.set("sort", sortOrder)
        if (appliedSearch.trim()) {
          params.set("customer", appliedSearch.trim())
        }
        if (statusFilter !== "todos") {
          params.set("status", statusFilter)
        }
        if (dataInicio) {
          params.set("after", dataInicio)
        }
        if (dataFim) {
          params.set("before", dataFim)
        }

        const res = await fetch(`/api/simulacoes?${params.toString()}`, { cache: "no-store" })
        const data = await res.json()

        if (res.status === 403) {
          setEnabled(false)
          return
        }

        if (data.pendente) {
          setEnabled(true)
          setStorePendente(true)
          setClienteNome(data.cliente_nome || "")
          return
        }

        if (!res.ok) {
          throw new Error(data.error || "Erro ao consultar simulações")
        }

        setEnabled(true)
        setStorePendente(false)
        setSimulations(data.simulations || [])
        setPaging(data.paging || null)
        setTotal(data.total || 0)
        setCurrentPage(pageToLoad)
        setClienteNome(data.cliente_nome || "")
      } catch (err: any) {
        console.error("Erro ao carregar simulações:", err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [appliedSearch, sortOrder, statusFilter, dataInicio, dataFim]
  )

  useEffect(() => {
    fetchSimulations(currentPage)
  }, [currentPage, appliedSearch, sortOrder, statusFilter, dataInicio, dataFim, fetchSimulations])

  const handlePresetChange = (preset: string) => {
    setPeriodPreset(preset)
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split("T")[0]

    if (preset === "total") {
      setDataInicio("")
      setDataFim("")
    } else if (preset === "hoje") {
      const todayStr = formatDate(today)
      setDataInicio(todayStr)
      setDataFim(todayStr)
    } else if (preset === "7dias") {
      const past = new Date()
      past.setDate(today.getDate() - 7)
      setDataInicio(formatDate(past))
      setDataFim(formatDate(today))
    } else if (preset === "30dias") {
      const past = new Date()
      past.setDate(today.getDate() - 30)
      setDataInicio(formatDate(past))
      setDataFim(formatDate(today))
    } else if (preset === "mes") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      setDataInicio(formatDate(firstDay))
      setDataFim(formatDate(today))
    }
    setCurrentPage(1)
  }

  const handleCustomDateChange = (type: "inicio" | "fim", value: string) => {
    setPeriodPreset("custom")
    if (type === "inicio") setDataInicio(value)
    else setDataFim(value)
    setCurrentPage(1)
  }

  const handleClearDates = () => {
    setPeriodPreset("total")
    setDataInicio("")
    setDataFim("")
    setCurrentPage(1)
  }

  // Submissão do filtro de busca
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearch(searchInput)
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput("")
    setAppliedSearch("")
    setCurrentPage(1)
  }

  // Abrir Modal
  const handleOpenDetails = (sim: CredereSimulation) => {
    setSelectedSim(sim)
    setModalOpen(true)
  }

  // Condições agrupadas por banco para o modal
  const conditionsByBank = useMemo(() => {
    if (!selectedSim?.conditions) return {}
    const map: Record<string, CredereSimulationCondition[]> = {}

    selectedSim.conditions.forEach((c) => {
      const bankName = c.bank?.nickname || c.bank?.name || `Banco ${c.bank?.febraban_code || "Desconhecido"}`
      if (!map[bankName]) map[bankName] = []
      map[bankName].push(c)
    })

    return map
  }, [selectedSim])

  // Se o módulo estiver desabilitado
  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-xs max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <Calculator className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Módulo de Simulações Não Habilitado</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          O módulo de Bancos e Simulações não está ativado para esta loja no Painel Master.
        </p>
      </div>
    )
  }

  // Se a loja na esteira bancária estiver pendente
  if (storePendente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-xs max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Vínculo Bancário Pendente</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          A integração está habilitada para <strong>{clienteNome || "sua conta"}</strong>, mas o ID da sua concessionária na esteira bancária ainda não foi vinculado pelo administrador.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-poppins flex items-center gap-2.5">
              <Calculator className="w-8 h-8 text-indigo-600" />
              Simulações
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Simulações Integradas
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Consulte todas as simulações de financiamento e propostas de crédito calculadas para a sua loja.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => fetchSimulations(currentPage, true)}
            disabled={loading || refreshing}
            className="rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700 font-medium shadow-xs w-full sm:w-auto cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3.5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nome do cliente, CPF ou CNPJ..."
              className="w-full pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value)
                setCurrentPage(1)
              }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="created_at_desc">Mais recentes primeiro</option>
              <option value="created_at_asc">Mais antigas primeiro</option>
            </select>

            <Button
              type="submit"
              size="sm"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs px-4 py-2 cursor-pointer"
            >
              Filtrar
            </Button>
          </div>
        </form>

        {/* Pílulas de Status de Aprovação */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-gray-400 font-semibold mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Status:
          </span>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("todos")
              setCurrentPage(1)
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "todos"
                ? "bg-gray-900 text-white shadow-2xs"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Todas
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("aprovadas")
              setCurrentPage(1)
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "aprovadas"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Aprovadas
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("reprovadas")
              setCurrentPage(1)
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "reprovadas"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Sem Aprovação
          </button>
        </div>

        {/* Filtro por Período / Datas */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-400 font-semibold mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Período:
            </span>

            <button
              type="button"
              onClick={() => handlePresetChange("total")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                periodPreset === "total"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("hoje")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                periodPreset === "hoje"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("7dias")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                periodPreset === "7dias"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("30dias")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                periodPreset === "30dias"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              Últimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("mes")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                periodPreset === "mes"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              Este Mês
            </button>
          </div>

          {/* Inputs de Data De/Até */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold uppercase text-gray-400">De:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => handleCustomDateChange("inicio", e.target.value)}
                className="bg-transparent text-xs text-gray-700 font-medium focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold uppercase text-gray-400">Até:</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => handleCustomDateChange("fim", e.target.value)}
                className="bg-transparent text-xs text-gray-700 font-medium focus:outline-none cursor-pointer"
              />
            </div>

            {(dataInicio || dataFim) && (
              <button
                type="button"
                onClick={handleClearDates}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold p-1 hover:underline cursor-pointer"
                title="Limpar datas"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
          <span>
            {total > 0
              ? `Total de ${total} simulação(ões) exibida(s)`
              : "Nenhuma simulação encontrada"}
          </span>
          <div className="flex items-center gap-2">
            {statusFilter !== "todos" && (
              <span className="text-indigo-600 font-medium">
                Status: {statusFilter === "aprovadas" ? "Apenas Aprovadas" : "Reprovadas"}
              </span>
            )}
            {(dataInicio || dataFim) && (
              <span className="text-gray-500 font-medium">
                Período: {dataInicio || "Início"} até {dataFim || "Hoje"}
              </span>
            )}
            {appliedSearch && (
              <span className="text-indigo-600 font-medium">
                Filtro ativo: "{appliedSearch}"{" "}
                <button
                  onClick={handleClearSearch}
                  className="underline ml-1 cursor-pointer font-bold"
                >
                  (limpar)
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Simulações */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Consultando simulações bancárias...</p>
        </div>
      ) : simulations.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
          <Calculator className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-base font-semibold text-gray-700">Nenhuma simulação encontrada</p>
          <p className="text-xs text-gray-400 mt-1">
            {appliedSearch
              ? `Nenhum resultado corresponde à busca "${appliedSearch}".`
              : "Esta loja ainda não possui simulações registradas."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {simulations.map((sim) => {
            const vehicle = sim.vehicle
            const model = vehicle?.vehicle_model
            const lead = sim.lead
            const conditions = sim.conditions || []

            // Conta condições com sucesso/disponíveis
            const availableConditions = conditions.filter((c) => c.available || (c.success && !c.reason))
            const banksSet = new Set<string>()
            conditions.forEach((c) => {
              const name = c.bank?.nickname || c.bank?.name
              if (name) banksSet.add(name)
            })
            const banksList = Array.from(banksSet)

            // Menor parcela disponível (quando houver)
            const parcels = conditions
              .map((c) => c.first_installment_value)
              .filter((v): v is number => typeof v === "number" && v > 0)
            const minParcel = parcels.length > 0 ? Math.min(...parcels) : null

            return (
              <div
                key={sim.uuid}
                className="bg-white rounded-2xl border border-gray-200/80 hover:border-indigo-300 p-5 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Topo do Card: Data e Status */}
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(sim.created_at)}
                    </span>

                    {availableConditions.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {availableConditions.length} proposta(s) aprovada(s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200" title="15 cenários de prazos testados com os bancos, porém sem crédito aprovado">
                        Sem aprovação ({conditions.length} cenários)
                      </span>
                    )}
                  </div>

                  {/* Informações do Cliente */}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm truncate font-poppins">
                          {lead?.name || "Cliente não informado"}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-mono">
                          {lead?.cpf_cnpj || "CPF não informado"}
                        </p>
                      </div>
                    </div>

                    {lead?.phone_number && (
                      <div className="mt-2 pl-9">
                        <a
                          href={`https://wa.me/${cleanPhone(lead.phone_number)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                        >
                          <MessageCircle className="w-3 h-3" />
                          {lead.phone_number}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Informações do Veículo */}
                  <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 truncate">
                        {model?.brand} {model?.model_name || "Veículo"}
                      </span>
                      <span className="font-bold text-gray-900 font-poppins">
                        {formatCurrency(vehicle?.asset_value || sim.assets_value)}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-500 truncate">
                      {model?.version || "Versão padrão"}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-0.5">
                      <span>Ano: {vehicle?.model_year || "-"}</span>
                      {vehicle?.licensing_uf && <span>• UF: {vehicle.licensing_uf}</span>}
                    </div>
                  </div>

                  {minParcel && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/60 text-xs flex items-center justify-between">
                      <span className="text-emerald-800 font-medium text-[11px]">Parcela a partir de:</span>
                      <span className="text-emerald-700 font-bold font-poppins text-xs">
                        {formatCurrency(minParcel)}
                      </span>
                    </div>
                  )}

                  {/* Bancos Participantes */}
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">
                      Bancos Consultados ({banksList.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {banksList.slice(0, 5).map((b) => (
                        <span
                          key={b}
                          className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-semibold text-gray-700"
                        >
                          {b}
                        </span>
                      ))}
                      {banksList.length > 5 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-500">
                          +{banksList.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rodapé com Botão */}
                <div className="pt-4 mt-3 border-t border-gray-100">
                  <Button
                    size="sm"
                    onClick={() => handleOpenDetails(sim)}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>
                      {availableConditions.length > 0
                        ? `Ver Propostas (${availableConditions.length} aprovadas)`
                        : `Ver Detalhes e Motivos (${conditions.length})`}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {paging && paging.pages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSimulations(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="rounded-xl border-gray-200 text-gray-700 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          <span className="text-gray-500 font-medium">
            Página <strong>{currentPage}</strong> de <strong>{paging.pages}</strong> ({total} registros)
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSimulations(currentPage + 1)}
            disabled={currentPage >= paging.pages || loading}
            className="rounded-xl border-gray-200 text-gray-700 cursor-pointer"
          >
            Próxima
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Modal de Detalhes da Simulação */}
      {modalOpen && selectedSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Topo do Modal */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight font-poppins">
                    Simulação: {selectedSim.lead?.name || "Cliente"}
                  </h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    Gerada em {formatDateTime(selectedSim.created_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Resumo do Lead e Veículo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lead */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wider">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Dados do Cliente</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <p>
                      <strong className="text-gray-500">Nome:</strong>{" "}
                      <span className="font-semibold text-gray-900">{selectedSim.lead?.name || "-"}</span>
                    </p>
                    <p>
                      <strong className="text-gray-500">CPF/CNPJ:</strong>{" "}
                      <span className="font-mono">{selectedSim.lead?.cpf_cnpj || "-"}</span>
                    </p>
                    <p>
                      <strong className="text-gray-500">Telefone:</strong>{" "}
                      <span>{selectedSim.lead?.phone_number || "-"}</span>
                    </p>
                    {selectedSim.lead?.email && (
                      <p>
                        <strong className="text-gray-500">E-mail:</strong>{" "}
                        <span>{selectedSim.lead.email}</span>
                      </p>
                    )}
                    {selectedSim.lead?.address && (
                      <p>
                        <strong className="text-gray-500">Local:</strong>{" "}
                        <span>
                          {selectedSim.lead.address.city} - {selectedSim.lead.address.state}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Veículo */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wider">
                    <Car className="w-4 h-4 text-indigo-600" />
                    <span>Dados do Veículo</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <p>
                      <strong className="text-gray-500">Modelo:</strong>{" "}
                      <span className="font-semibold text-gray-900">
                        {selectedSim.vehicle?.vehicle_model?.brand}{" "}
                        {selectedSim.vehicle?.vehicle_model?.model_name}
                      </span>
                    </p>
                    <p>
                      <strong className="text-gray-500">Versão:</strong>{" "}
                      <span>{selectedSim.vehicle?.vehicle_model?.version || "-"}</span>
                    </p>
                    <p>
                      <strong className="text-gray-500">Ano:</strong>{" "}
                      <span>
                        {selectedSim.vehicle?.manufacture_year || "-"}/
                        {selectedSim.vehicle?.model_year || "-"}
                      </span>
                    </p>
                    <p>
                      <strong className="text-gray-500">Valor Avaliado:</strong>{" "}
                      <span className="font-bold text-emerald-700">
                        {formatCurrency(selectedSim.vehicle?.asset_value || selectedSim.assets_value)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de Condições Agrupadas por Banco */}
              <div className="space-y-4">
                <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider font-poppins flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-indigo-600" />
                  <span>Propostas e Condições Bancárias</span>
                </h4>

                {Object.keys(conditionsByBank).length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma condição bancária retornada.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(conditionsByBank).map(([bankName, condList]) => (
                      <div
                        key={bankName}
                        className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs"
                      >
                        {/* Cabeçalho do Banco */}
                        <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-xs font-poppins">{bankName}</span>
                          <span className="text-[10px] font-semibold text-gray-500">
                            {condList.length} condição(ões)
                          </span>
                        </div>

                        {/* Tabela de Condições */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-100 text-xs">
                            <thead className="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Prazo</th>
                                <th className="px-3 py-2 text-left">Entrada</th>
                                <th className="px-3 py-2 text-left">Financiado</th>
                                <th className="px-3 py-2 text-left">Parcela</th>
                                <th className="px-3 py-2 text-left">Situação / Motivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {condList.map((c) => {
                                const isAvailable = c.available || (c.success && !c.reason)
                                return (
                                  <tr key={c.id || Math.random()} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">
                                      {c.installments ? `${c.installments}x` : "-"}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                      {formatCurrency(c.down_payment)}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                      {formatCurrency(c.financed_amount)}
                                    </td>
                                    <td className="px-3 py-2.5 font-bold whitespace-nowrap">
                                      {c.first_installment_value ? (
                                        <span className="text-emerald-700">
                                          {formatCurrency(c.first_installment_value)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {isAvailable ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                          Oferta Disponível
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-gray-500 line-clamp-2">
                                          {c.reason || "Condição não ofertada"}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-end bg-gray-50/70">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border-gray-200 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
