"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
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
  Store,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CredereSimulation,
  CredereSimulationsPaging,
  CredereSimulationCondition,
} from "@/lib/credere/types"

interface AdminSimulacoesManagerProps {
  clients: any[]
}

type StatusFilterType = "todos" | "aprovadas" | "reprovadas"

export function AdminSimulacoesManager({ clients }: AdminSimulacoesManagerProps) {
  // Cliente selecionado
  const [selectedClientId, setSelectedClientId] = useState<string | number>(
    clients[0]?.id || ""
  )

  const selectedClient = useMemo(() => {
    return clients.find((c) => String(c.id) === String(selectedClientId)) || clients[0] || null
  }, [clients, selectedClientId])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [storePendente, setStorePendente] = useState(false)

  // Dados da listagem
  const [simulations, setSimulations] = useState<CredereSimulation[]>([])
  const [paging, setPaging] = useState<CredereSimulationsPaging | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Filtros
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<string>("created_at_desc")
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("todos")
  const [dataInicio, setDataInicio] = useState<string>("")
  const [dataFim, setDataFim] = useState<string>("")
  const [periodPreset, setPeriodPreset] = useState<string>("total")

  // Modal de Detalhes
  const [selectedSim, setSelectedSim] = useState<CredereSimulation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const formatCurrency = (cents?: number | null) => {
    if (cents === null || cents === undefined) return "R$ 0,00"
    const val = cents / 100
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

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

  const cleanPhone = (phone?: string | null) => {
    if (!phone) return null
    const cleaned = phone.replace(/\D/g, "")
    return cleaned.length >= 10 ? cleaned : null
  }

  // Buscar Simulações do cliente selecionado com filtros de Status e Data
  const fetchSimulations = useCallback(
    async (clientId: string | number, pageToLoad = 1, isRefresh = false) => {
      if (!clientId) return
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      setStorePendente(false)

      try {
        const params = new URLSearchParams()
        params.set("clienteId", String(clientId))
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

        if (data.pendente) {
          setStorePendente(true)
          setSimulations([])
          setTotal(0)
          setPaging(null)
          return
        }

        if (!res.ok) {
          throw new Error(data.error || "Erro ao consultar simulações.")
        }

        setSimulations(data.simulations || [])
        setPaging(data.paging || null)
        setTotal(data.total || 0)
        setCurrentPage(pageToLoad)
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
    if (selectedClientId) {
      fetchSimulations(selectedClientId, 1)
    }
  }, [selectedClientId, appliedSearch, sortOrder, statusFilter, dataInicio, dataFim, fetchSimulations])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAppliedSearch(searchInput)
  }

  function handleClearSearch() {
    setSearchInput("")
    setAppliedSearch("")
  }

  // Presets de Data Rápidos
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
  }

  const handleCustomDateChange = (type: "inicio" | "fim", value: string) => {
    setPeriodPreset("custom")
    if (type === "inicio") setDataInicio(value)
    else setDataFim(value)
  }

  const handleClearDates = () => {
    setPeriodPreset("total")
    setDataInicio("")
    setDataFim("")
  }

  function handleOpenDetails(sim: CredereSimulation) {
    setSelectedSim(sim)
    setModalOpen(true)
  }

  // Se nenhum cliente tem bancos ativados
  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
          <Calculator className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum Cliente com Bancos Ativo</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          Nenhuma concessionária está com o módulo de bancos ativado para registrar simulações de financiamento.
        </p>
        <Link
          href="/admin/clientes"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          <Store className="w-4 h-4" />
          Gerenciar Clientes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Topo: Título + Badge de Lojas Ativas */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2.5 font-poppins">
            <Calculator className="w-8 h-8 text-indigo-600" />
            Simulações de Financiamento
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {clients.length} {clients.length === 1 ? "loja ativa" : "lojas ativas"}
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Consulte todas as simulações e propostas bancárias submetidas pelos clientes de cada loja.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchSimulations(selectedClientId, currentPage, true)}
          disabled={refreshing || loading}
          className="rounded-xl border-gray-200 hover:bg-gray-50 text-xs font-bold shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar Lista
        </Button>
      </div>

      {/* Seletor de Concessionárias / Lojas */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-indigo-500" />
            Selecione a Loja:
          </span>
          {selectedClient && (
            <span className="text-xs text-gray-400 font-mono">
              ID da Loja: <strong>{selectedClient.credere_store_id ? `#${selectedClient.credere_store_id}` : "Não vinculado"}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {clients.map((c) => {
            const isSelected = String(c.id) === String(selectedClientId)
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedClientId(c.id)
                  setAppliedSearch("")
                  setSearchInput("")
                }}
                className={`px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200/80"
                }`}
              >
                <Store className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-200" : "text-gray-400"}`} />
                <span>{c.nome}</span>
                {c.credere_store_id ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                      isSelected ? "bg-indigo-500/50 text-indigo-100" : "bg-gray-200/80 text-gray-600"
                    }`}
                  >
                    #{c.credere_store_id}
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-bold">
                    Pendente
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Se a loja selecionada não tiver store_id configurado */}
      {storePendente ? (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-amber-200 shadow-xs max-w-2xl mx-auto my-8">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Loja Sem Vínculo Bancário</h3>
          <p className="text-sm text-gray-500 max-w-md mb-5">
            A concessionária <strong>{selectedClient?.nome}</strong> está com o módulo ativado, mas ainda não possui o <code>credere_store_id</code> cadastrado.
          </p>
          <Link
            href={`/admin/clientes/${selectedClient?.id}`}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            Editar Cliente e Inserir ID
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Barra de Busca e Filtros */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3.5">
            {/* Linha 1: Input de Busca + Ordenação */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Pesquisar por nome do cliente ou CPF..."
                  className="w-full pl-10 pr-20 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Buscar
                </button>
              </form>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ordem:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="created_at_desc">Mais recentes primeiro</option>
                  <option value="created_at_asc">Mais antigas primeiro</option>
                </select>
              </div>
            </div>

            {/* Linha 2: Pílulas de Status de Aprovação */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-gray-400 font-semibold mr-1 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Status:
              </span>

              <button
                type="button"
                onClick={() => setStatusFilter("todos")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === "todos"
                    ? "bg-gray-900 text-white shadow-2xs"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                Todas as Simulações
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("aprovadas")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === "aprovadas"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Apenas Aprovadas
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("reprovadas")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === "reprovadas"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                Reprovadas / Sem Aprovação
              </button>
            </div>

            {/* Linha 3: Filtro por Período / Datas */}
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

            {/* Totalizador e Resumo dos Filtros Ativos */}
            <div className="flex flex-wrap items-center justify-between pt-1 text-xs text-gray-500 border-t border-gray-100">
              <span>
                Total de simulações exibidas em <strong>{selectedClient?.nome}</strong>: <strong>{total}</strong>
              </span>
              <div className="flex items-center gap-2">
                {statusFilter !== "todos" && (
                  <span className="text-indigo-600 font-semibold">
                    Status: {statusFilter === "aprovadas" ? "Apenas Aprovadas" : "Reprovadas"}
                  </span>
                )}
                {(dataInicio || dataFim) && (
                  <span className="text-gray-500 font-medium">
                    Período: {dataInicio || "Início"} até {dataFim || "Hoje"}
                  </span>
                )}
                {appliedSearch && (
                  <span className="text-indigo-600 font-medium flex items-center gap-1">
                    Cliente: "{appliedSearch}"
                    <button onClick={handleClearSearch} className="underline text-gray-400 hover:text-gray-600 ml-1">
                      limpar
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
              <p className="text-sm text-gray-500">Consultando simulações bancárias de {selectedClient?.nome}...</p>
            </div>
          ) : simulations.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
              <Calculator className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-base font-semibold text-gray-700">Nenhuma simulação encontrada</p>
              <p className="text-xs text-gray-400 mt-1">
                {appliedSearch || statusFilter !== "todos" || dataInicio || dataFim
                  ? "Nenhum resultado corresponde aos filtros selecionados."
                  : `Esta concessionária (${selectedClient?.nome}) ainda não possui simulações registradas.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulations.map((sim) => {
                const vehicle = sim.vehicle
                const model = vehicle?.vehicle_model
                const lead = sim.lead
                const conditions = sim.conditions || []

                const availableConditions = conditions.filter((c) => c.available || (c.success && !c.reason))
                const banksSet = new Set<string>()
                conditions.forEach((c) => {
                  const name = c.bank?.nickname || c.bank?.name
                  if (name) banksSet.add(name)
                })
                const banksList = Array.from(banksSet)

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
                      {/* Topo: Data e Badge */}
                      <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                        <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateTime(sim.created_at)}
                        </span>

                        {availableConditions.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {availableConditions.length} aprovada(s)
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200"
                            title={`${conditions.length} cenários consultados sem crédito aprovado`}
                          >
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

                      {/* Bancos Consultados */}
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
                            : `Ver Detalhes (${conditions.length} cenários)`}
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
                onClick={() => fetchSimulations(selectedClientId, currentPage - 1)}
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
                onClick={() => fetchSimulations(selectedClientId, currentPage + 1)}
                disabled={currentPage >= paging.pages || loading}
                className="rounded-xl border-gray-200 text-gray-700 cursor-pointer"
              >
                Próxima
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal de Detalhes da Simulação */}
      {modalOpen && selectedSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100">
            {/* Header Modal */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight font-poppins">
                    Detalhes da Simulação
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                    <span>{formatDateTime(selectedSim.created_at)}</span>
                    <span>•</span>
                    <span className="font-mono text-gray-400">UUID: {selectedSim.uuid.substring(0, 8)}...</span>
                    <span>•</span>
                    <span className="text-indigo-600 font-semibold">{selectedClient?.nome}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Cards de Resumo: Cliente e Veículo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    Dados do Proponente
                  </span>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-gray-900 text-sm">
                      {selectedSim.lead?.name || "Não informado"}
                    </p>
                    <p className="text-gray-500 font-mono">
                      CPF: <strong>{selectedSim.lead?.cpf_cnpj || "Não informado"}</strong>
                    </p>
                    {selectedSim.lead?.phone_number && (
                      <p className="text-gray-500">
                        Telefone:{" "}
                        <a
                          href={`https://wa.me/${cleanPhone(selectedSim.lead.phone_number)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          {selectedSim.lead.phone_number}
                        </a>
                      </p>
                    )}
                    {selectedSim.lead?.email && (
                      <p className="text-gray-500">Email: {selectedSim.lead.email}</p>
                    )}
                  </div>
                </div>

                {/* Veículo */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-indigo-600" />
                    Veículo Simulado
                  </span>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-gray-900 text-sm">
                      {selectedSim.vehicle?.vehicle_model?.brand}{" "}
                      {selectedSim.vehicle?.vehicle_model?.model_name || "Veículo"}
                    </p>
                    <p className="text-gray-500">
                      Versão: {selectedSim.vehicle?.vehicle_model?.version || "Padrão"}
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="font-bold text-indigo-700 font-poppins text-sm">
                        {formatCurrency(selectedSim.vehicle?.asset_value || selectedSim.assets_value)}
                      </span>
                      <span className="text-gray-400 font-mono">
                        Ano: {selectedSim.vehicle?.model_year || "-"}
                      </span>
                      {selectedSim.vehicle?.licensing_uf && (
                        <span className="text-gray-400 font-mono">
                          UF: {selectedSim.vehicle.licensing_uf}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela de Cenários Bancários */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-indigo-600" />
                    Respostas dos Bancos ({selectedSim.conditions?.length || 0} cenários)
                  </h4>
                </div>

                {(!selectedSim.conditions || selectedSim.conditions.length === 0) ? (
                  <div className="py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-2xl border">
                    Nenhum retorno bancário registrado para esta simulação.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50/80 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="py-3 pl-4 pr-3 text-left">Banco</th>
                            <th className="px-3 py-3 text-left">Entrada</th>
                            <th className="px-3 py-3 text-left">Financiado</th>
                            <th className="px-3 py-3 text-left">Prazo</th>
                            <th className="px-3 py-3 text-left">Parcela</th>
                            <th className="px-3 py-3 text-left">Taxa a.m.</th>
                            <th className="px-3 py-3 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {selectedSim.conditions.map((cond, idx) => {
                            const isApproved = cond.available || (cond.success && !cond.reason)
                            const bankName = cond.bank?.nickname || cond.bank?.name || "Banco"

                            return (
                              <tr
                                key={cond.id || idx}
                                className={`hover:bg-gray-50/50 transition-colors ${
                                  isApproved ? "bg-emerald-50/20" : ""
                                }`}
                              >
                                <td className="py-3 pl-4 pr-3 font-bold text-gray-900 whitespace-nowrap">
                                  {bankName}
                                  {cond.credit_condition_description && (
                                    <span className="block text-[10px] text-gray-400 font-normal">
                                      {cond.credit_condition_description}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                                  {formatCurrency(cond.down_payment)}
                                </td>
                                <td className="px-3 py-3 text-gray-900 font-medium whitespace-nowrap">
                                  {formatCurrency(cond.financed_amount)}
                                </td>
                                <td className="px-3 py-3 text-gray-800 font-bold whitespace-nowrap">
                                  {cond.installments ? `${cond.installments}x` : "-"}
                                </td>
                                <td className="px-3 py-3 text-gray-900 font-bold font-poppins whitespace-nowrap">
                                  {cond.first_installment_value
                                    ? formatCurrency(cond.first_installment_value)
                                    : "-"}
                                </td>
                                <td className="px-3 py-3 text-gray-500 font-mono whitespace-nowrap">
                                  {cond.interest_monthly ? `${(cond.interest_monthly / 100).toFixed(2)}%` : "-"}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {isApproved ? (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                      Aprovado
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200"
                                      title={cond.reason || "Não elegível no momento"}
                                    >
                                      <XCircle className="w-3 h-3 text-gray-400" />
                                      {cond.reason ? cond.reason.substring(0, 20) + "..." : "Não aprovado"}
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
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border-gray-200 hover:bg-white text-xs font-semibold cursor-pointer"
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
