"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Landmark,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  ShieldAlert,
  Building2,
  KeyRound,
  Eye,
  EyeOff,
  Share2,
  Info,
  HelpCircle,
  X,
  Lock,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BankWithStatus,
  BankCredentialStatus,
  CredereSummary,
  CredereFormField,
  CredereBankFieldsResponse,
} from "@/lib/credere/types"

type StatusFilter = "todos" | "okay" | "unauthorized" | "none" | "not_analyzed" | "inactive"

// Lista oficial de instituições que operam com credenciais BPO (Usuário e Senha)
const BPO_PREFERENTIAL_BANKS = ['655', '394', '623', '033', 'M22']

export default function BancosPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [storePendente, setStorePendente] = useState(false)
  const [clienteNome, setClienteNome] = useState("")
  const [bancos, setBancos] = useState<BankWithStatus[]>([])
  const [resumo, setResumo] = useState<CredereSummary>({
    conectados: 0,
    invalidos: 0,
    sem_credencial: 0,
    em_verificacao: 0,
    inativos: 0,
    total: 0,
  })
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos")

  // Modal de Conexão / Edição de Credenciais
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBank, setSelectedBank] = useState<BankWithStatus | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<string>("v1")
  const [availableVersions, setAvailableVersions] = useState<string[]>(["v1"])
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fields, setFields] = useState<CredereFormField[]>([])
  const [requiresScope, setRequiresScope] = useState(false)
  const [scopeNotice, setScopeNotice] = useState<string>("")
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [savingCredentials, setSavingCredentials] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null)

  // Filtra apenas os campos obrigatórios (marcados com *) exigidos pela instituição bancária
  const visibleFields = useMemo(() => {
    const requiredOnly = fields.filter((f) => Boolean(f.required))
    return requiredOnly.length > 0 ? requiredOnly : fields
  }, [fields])

  // Carregar dados de bancos
  const fetchBancos = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setErrorMessage(null)

    try {
      const res = await fetch("/api/bancos", { cache: "no-store" })
      const data = await res.json()

      if (res.status === 403) {
        setEnabled(false)
        setErrorMessage(data.error || "O módulo de Bancos não está habilitado para a sua conta.")
        return
      }

      if (data.pendente) {
        setEnabled(true)
        setStorePendente(true)
        setClienteNome(data.cliente_nome || "")
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar informações bancárias")
      }

      setEnabled(true)
      setStorePendente(false)
      setBancos(data.bancos || [])
      setResumo(data.resumo || {
        conectados: 0,
        invalidos: 0,
        sem_credencial: 0,
        em_verificacao: 0,
        inativos: 0,
        total: (data.bancos || []).length,
      })
      setUltimaSincronizacao(data.ultima_sincronizacao || new Date().toISOString())
      setClienteNome(data.cliente_nome || "")
    } catch (err: any) {
      console.error("Erro ao carregar bancos:", err)
      setErrorMessage(err.message || "Não foi possível sincronizar as instituições bancárias.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchBancos()
  }, [fetchBancos])

  // Formatação de data amigável
  const formatDateTime = (isoDate?: string | null) => {
    if (!isoDate) return "-"
    try {
      const date = new Date(isoDate)
      return date.toLocaleString("pt-BR", {
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

  // Filtragem e busca
  const bancosFiltrados = useMemo(() => {
    return bancos.filter((banco) => {
      // Filtro de status
      if (statusFilter !== "todos") {
        if (banco.status !== statusFilter) return false
      }

      // Busca por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchName = banco.name?.toLowerCase().includes(query)
        const matchTrade = banco.tradename?.toLowerCase().includes(query)
        const matchCode = banco.code?.toLowerCase().includes(query)
        const matchDesc = banco.description?.toLowerCase().includes(query)
        if (!matchName && !matchTrade && !matchCode && !matchDesc) return false
      }

      return true
    })
  }, [bancos, statusFilter, searchTerm])

  // Abrir modal de conexão/reconexão
  async function handleOpenBankModal(bank: BankWithStatus) {
    setSelectedBank(bank)
    setModalOpen(true)
    setSaveSuccessMsg(null)
    setSaveErrorMsg(null)
    setFormValues({})
    setShowPassword({})
    setRequiresScope(false)
    setScopeNotice("")

    // Para bancos que operam prioritariamente em modo BPO (BV, Bradesco, Pan, Santander, Honda),
    // o padrão oficial é sempre v2 (Usuário e Senha do portal)
    const isBpoBank = BPO_PREFERENTIAL_BANKS.includes(bank.code)
    const initialVersion = bank.bank_credential?.bank_integration_version || (isBpoBank ? "v2" : "v1")
    
    setSelectedVersion(initialVersion)
    setAvailableVersions(
      bank.available_versions && bank.available_versions.length > 0
        ? bank.available_versions
        : (isBpoBank ? ["v2", "v1"] : [initialVersion])
    )

    await loadFields(bank.code, initialVersion)
  }

  // Carregar campos dinâmicos da instituição bancária
  async function loadFields(bankCode: string, version: string) {
    setFieldsLoading(true)
    setRequiresScope(false)
    setScopeNotice("")
    setFields([])

    try {
      const res = await fetch(`/api/bancos/${encodeURIComponent(bankCode)}/fields?version=${encodeURIComponent(version)}`)
      const data: CredereBankFieldsResponse & { requires_scope?: boolean; error?: string } = await res.json()

      if (res.status === 403 && data.requires_scope) {
        setRequiresScope(true)
        setScopeNotice(data.error || "O token de integração requer autorização para gerenciar credenciais bancárias.")
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "Não foi possível carregar os campos deste banco.")
      }

      if (data.bank_integration_versions && data.bank_integration_versions.length > 0) {
        setAvailableVersions(data.bank_integration_versions)
      }
      if (data.current_version) {
        setSelectedVersion(data.current_version)
      }

      const returnedFields = data.fields || []
      setFields(returnedFields)

      // Pré-popular valores padrão
      const initialVals: Record<string, any> = {}
      returnedFields.forEach((f) => {
        if (f.default_value !== undefined) {
          initialVals[f.name] = f.default_value
        }
      })
      setFormValues(initialVals)
    } catch (err: any) {
      console.error("Erro ao carregar campos:", err)
      setSaveErrorMsg(err.message || "Erro ao consultar formulário bancário.")
    } finally {
      setFieldsLoading(false)
    }
  }

  // Mudança de versão dentro do modal
  async function handleVersionChange(version: string) {
    setSelectedVersion(version)
    if (selectedBank) {
      await loadFields(selectedBank.code, version)
    }
  }

  // Alternar visualização de senha
  function togglePasswordVisibility(fieldName: string) {
    setShowPassword((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }

  // Submeter formulário de credenciais
  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBank) return

    setSavingCredentials(true)
    setSaveErrorMsg(null)
    setSaveSuccessMsg(null)

    try {
      const res = await fetch(
        `/api/bancos/${encodeURIComponent(selectedBank.code)}?version=${encodeURIComponent(selectedVersion)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        }
      )

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Erro ao salvar credenciais bancárias.")
      }

      setSaveSuccessMsg(
        "Credenciais salvas com sucesso! O status entrou em verificação pela instituição bancária."
      )

      // Recarrega bancos após breve delay
      setTimeout(() => {
        fetchBancos(true)
      }, 1500)
    } catch (err: any) {
      setSaveErrorMsg(err.message || "Falha ao gravar credenciais bancárias.")
    } finally {
      setSavingCredentials(false)
    }
  }

  // Caso o módulo esteja desabilitado
  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-xs max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Módulo de Bancos Não Habilitado</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          {errorMessage || "Este recurso não está ativado para a sua concessionária no momento."}
        </p>
        <p className="text-xs text-gray-400">
          Entre em contato com o suporte ou com o administrador do sistema para solicitar a habilitação do módulo de bancos.
        </p>
      </div>
    )
  }

  // Caso o store_id esteja pendente de configuração pelo Master
  if (storePendente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-xs max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Vínculo Bancário Pendente</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          O módulo de Bancos está ativado para <strong>{clienteNome || "sua conta"}</strong>, mas a sua loja ainda não foi vinculada à esteira bancária pelo administrador.
        </p>
        <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-800 text-left max-w-md w-full mb-6">
          <p className="font-semibold mb-1">Como resolver:</p>
          <p>
            Solicite ao administrador Master para vincular o ID da sua concessionária através da tela de edição de clientes no Painel Master.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchBancos(true)}
          disabled={refreshing}
          className="rounded-xl border-gray-200 hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Verificar Novamente
        </Button>
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
              <Landmark className="w-8 h-8 text-indigo-600" />
              Bancos
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Integração Bancária
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie suas credenciais e conexões bancárias em um só lugar com status em tempo real.
          </p>
          {ultimaSincronizacao && (
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Última atualização: {formatDateTime(ultimaSincronizacao)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => fetchBancos(true)}
            disabled={loading || refreshing}
            className="rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700 font-medium shadow-xs w-full sm:w-auto cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar status
          </Button>
        </div>
      </div>

      {/* Cartões de Resumo Superior (Indicadores) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Conectados */}
        <Card
          onClick={() => setStatusFilter(statusFilter === "okay" ? "todos" : "okay")}
          className={`cursor-pointer transition-all border rounded-2xl ${
            statusFilter === "okay"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40"
              : "border-gray-200/70 hover:border-emerald-300 hover:shadow-xs bg-white"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Conectados</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mt-2 font-poppins">{resumo.conectados}</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Credenciais ativas</p>
          </CardContent>
        </Card>

        {/* Credenciais Inválidas */}
        <Card
          onClick={() => setStatusFilter(statusFilter === "unauthorized" ? "todos" : "unauthorized")}
          className={`cursor-pointer transition-all border rounded-2xl ${
            statusFilter === "unauthorized"
              ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40"
              : "border-gray-200/70 hover:border-rose-300 hover:shadow-xs bg-white"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inválidas</span>
              <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mt-2 font-poppins">{resumo.invalidos}</div>
            <p className="text-[11px] text-rose-700 font-medium mt-0.5">Requer reconexão</p>
          </CardContent>
        </Card>

        {/* Sem Credencial */}
        <Card
          onClick={() => setStatusFilter(statusFilter === "none" ? "todos" : "none")}
          className={`cursor-pointer transition-all border rounded-2xl ${
            statusFilter === "none"
              ? "border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/40"
              : "border-gray-200/70 hover:border-slate-300 hover:shadow-xs bg-white"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sem Credencial</span>
              <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mt-2 font-poppins">{resumo.sem_credencial}</div>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Disponíveis p/ conectar</p>
          </CardContent>
        </Card>

        {/* Em Verificação */}
        <Card
          onClick={() => setStatusFilter(statusFilter === "not_analyzed" ? "todos" : "not_analyzed")}
          className={`cursor-pointer transition-all border rounded-2xl ${
            statusFilter === "not_analyzed"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40"
              : "border-gray-200/70 hover:border-amber-300 hover:shadow-xs bg-white"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Em Análise</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mt-2 font-poppins">{resumo.em_verificacao}</div>
            <p className="text-[11px] text-amber-700 font-medium mt-0.5">Aguardando validação</p>
          </CardContent>
        </Card>

        {/* Inativos */}
        <Card
          onClick={() => setStatusFilter(statusFilter === "inactive" ? "todos" : "inactive")}
          className={`cursor-pointer transition-all border rounded-2xl col-span-2 sm:col-span-1 ${
            statusFilter === "inactive"
              ? "border-gray-500 ring-2 ring-gray-500/20 bg-gray-50"
              : "border-gray-200/70 hover:border-gray-300 hover:shadow-xs bg-white"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inativos</span>
              <div className="w-7 h-7 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mt-2 font-poppins">{resumo.inativos}</div>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Desativados na loja</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Input de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome do banco, apelido ou código Febraban..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Pílulas de Filtro Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-gray-400 font-semibold mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtrar:
          </span>

          <button
            onClick={() => setStatusFilter("todos")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "todos"
                ? "bg-gray-900 text-white shadow-2xs"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Todos ({resumo.total})
          </button>

          <button
            onClick={() => setStatusFilter("okay")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "okay"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Conectados ({resumo.conectados})
          </button>

          <button
            onClick={() => setStatusFilter("unauthorized")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "unauthorized"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Credencial inválida ({resumo.invalidos})
          </button>

          <button
            onClick={() => setStatusFilter("none")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "none"
                ? "bg-slate-700 text-white shadow-2xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Sem credencial ({resumo.sem_credencial})
          </button>

          <button
            onClick={() => setStatusFilter("not_analyzed")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "not_analyzed"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Em verificação ({resumo.em_verificacao})
          </button>

          {resumo.inativos > 0 && (
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === "inactive"
                  ? "bg-gray-600 text-white shadow-2xs"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              Inativos ({resumo.inativos})
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400 font-medium pl-2 hidden md:inline">
            Mostrando {bancosFiltrados.length} de {resumo.total} bancos
          </span>
        </div>
      </div>

      {/* Lista / Grid de Bancos */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Consultando status dos bancos parceiros...</p>
        </div>
      ) : bancosFiltrados.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
          <Landmark className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-base font-semibold text-gray-700">Nenhum banco encontrado</p>
          <p className="text-xs text-gray-400 mt-1">
            {searchTerm ? `Nenhum resultado corresponde à busca "${searchTerm}".` : "Nenhum banco nesta categoria."}
          </p>
          {searchTerm && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-2 text-indigo-600 font-bold"
            >
              Limpar pesquisa
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bancosFiltrados.map((banco) => {
            const isConnected = banco.status === "okay"
            const isInvalid = banco.status === "unauthorized"
            const isNotAnalyzed = banco.status === "not_analyzed"
            const isNone = banco.status === "none"
            const isInactive = banco.status === "inactive"
            const isShared = Boolean(banco.bank_credential?.is_shared)
            const version = banco.bank_credential?.bank_integration_version

            return (
              <div
                key={banco.code}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                  isInvalid
                    ? "border-rose-200/90 hover:border-rose-300"
                    : isConnected
                    ? "border-emerald-200/80 hover:border-emerald-300"
                    : isNotAnalyzed
                    ? "border-amber-200/80 hover:border-amber-300"
                    : "border-gray-200/80 hover:border-gray-300"
                }`}
              >
                <div>
                  {/* Topo do Card: Logo/Iniciais + Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-xs shrink-0"
                        style={{
                          backgroundColor: banco.color || "#4F46E5",
                        }}
                      >
                        {banco.tradename ? banco.tradename.substring(0, 2).toUpperCase() : banco.code}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-base leading-tight truncate font-poppins">
                          {banco.tradename || banco.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono mt-0.5">
                          <span>Cód: <strong>{banco.code}</strong></span>
                          {version && (
                            <>
                              <span>•</span>
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase">
                                {version === "v2" ? "BPO" : version === "v1" ? "API" : version}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isConnected && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Conectado
                        </span>
                      )}
                      {isInvalid && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          Inválida
                        </span>
                      )}
                      {isNotAnalyzed && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Em verificação
                        </span>
                      )}
                      {isNone && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          Não conectado
                        </span>
                      )}
                      {isInactive && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Descrição e tags */}
                  <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px] mb-3">
                    {banco.description || banco.name}
                  </p>

                  {/* Indicadores adicionais (Compartilhada, Última Verificação) */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] text-gray-400">
                    {isShared && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                        <Share2 className="w-3 h-3" />
                        Compartilhada
                      </span>
                    )}
                    {banco.last_checked_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {formatDateTime(banco.last_checked_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botão de Ação contextual */}
                <div className="pt-3 border-t border-gray-100">
                  {isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenBankModal(banco)}
                      className="w-full rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs cursor-pointer"
                    >
                      Gerenciar
                    </Button>
                  )}

                  {isInvalid && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenBankModal(banco)}
                      className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                    >
                      Reconectar
                    </Button>
                  )}

                  {isNone && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenBankModal(banco)}
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                    >
                      Conectar
                    </Button>
                  )}

                  {isNotAnalyzed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenBankModal(banco)}
                      className="w-full rounded-xl border-amber-300 text-amber-800 bg-amber-50/50 hover:bg-amber-100 font-semibold text-xs cursor-pointer"
                    >
                      Consultar status
                    </Button>
                  )}

                  {isInactive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenBankModal(banco)}
                      className="w-full rounded-xl border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-xs cursor-pointer"
                    >
                      Gerenciar
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Dinâmico de Conexão / Atualização de Credenciais */}
      {modalOpen && selectedBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Topo do Modal */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                  style={{ backgroundColor: selectedBank.color || "#4F46E5" }}
                >
                  {selectedBank.tradename ? selectedBank.tradename.substring(0, 2).toUpperCase() : selectedBank.code}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight font-poppins">
                    {selectedBank.tradename || selectedBank.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    Código Febraban: <strong>{selectedBank.code}</strong>
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
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Seletor de Modo de Integração (BPO vs API) */}
              {availableVersions.length > 1 && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Modo de Integração
                    </label>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                      {selectedVersion === "v2" ? "Modo BPO Ativo" : "Modo API Ativo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {availableVersions.map((v) => {
                      const isBpo = v === "v2"
                      const isSelected = selectedVersion === v
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleVersionChange(v)}
                          className={`p-2.5 rounded-xl text-left transition-all border cursor-pointer ${
                            isSelected
                              ? "bg-white border-indigo-600 shadow-2xs ring-2 ring-indigo-500/10"
                              : "bg-white/60 border-gray-200 hover:bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isSelected ? "text-indigo-600" : "text-gray-800"}`}>
                              {isBpo ? "BPO (Usuário e Senha)" : "Integração API"}
                            </span>
                            {isBpo && (
                              <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                Padrão
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                            {isBpo
                              ? "Apenas login e senha de acesso ao portal do banco"
                              : "Requer chaves de parceiro e filial"}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Detalhes da Conexão Atual (quando já possui credencial) */}
              {selectedBank.bank_credential ? (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2.5 text-xs">
                  <div className="font-bold text-gray-800 flex items-center justify-between">
                    <span className="font-poppins">Detalhes da Conexão</span>
                    <span className="font-mono text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold uppercase">
                      Versão {selectedBank.bank_credential.bank_integration_version || "v1"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11px] pt-1">
                    <div>
                      <span className="text-gray-400 block">Status da Credencial:</span>
                      <span className="font-bold text-gray-800">{selectedBank.statusLabel}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Última Validação:</span>
                      <span className="font-medium text-gray-700">
                        {formatDateTime(selectedBank.bank_credential.status_updated_at || selectedBank.last_checked_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Tipo de Vínculo:</span>
                      <span className="font-medium text-gray-700">
                        {selectedBank.bank_credential.is_shared ? "Compartilhada" : "Credencial Própria"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Situação na Loja:</span>
                      <span className="font-medium text-gray-700">
                        {selectedBank.bank_credential.active !== false ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Status Atual do Banco */
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-xs">
                  <span className="text-gray-500 font-medium">Status da integração:</span>
                  <span className="font-bold text-gray-900">{selectedBank.statusLabel}</span>
                </div>
              )}

              {/* Alerta de Escopo Pendente */}
              {requiresScope && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Permissão Bancária Requerida (Escopo da API)</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    A esteira bancária exige que o token de integração possua a permissão de acesso{" "}
                    <code className="bg-amber-100/90 px-1 py-0.5 rounded font-mono font-bold text-amber-900">
                      bank_credentials
                    </code>{" "}
                    habilitada para consultar campos sensíveis e alterar credenciais bancárias diretamente pelo painel.
                  </p>
                  <p className="text-amber-700 text-[11px] leading-relaxed">
                    Para habilitar o cadastro e reconexão de senhas por aqui, solicite ao administrador a liberação do escopo de <strong>credenciais bancárias</strong> para a integração.
                  </p>
                </div>
              )}

              {/* Feedback de Sucesso */}
              {saveSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Feedback de Erro */}
              {saveErrorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{saveErrorMsg}</span>
                </div>
              )}

              {/* Formulário Dinâmico de Campos */}
              {fieldsLoading ? (
                <div className="py-10 text-center">
                  <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Consultando campos exigidos pelo banco...</p>
                </div>
              ) : visibleFields.length > 0 ? (
                <form id="bank-credentials-form" onSubmit={handleSaveCredentials} className="space-y-4">
                  {visibleFields.map((field) => {
                    const isSensitive = Boolean(
                      field.sensitive ||
                      field.type === "password" ||
                      field.name.toLowerCase().includes("senha") ||
                      field.name.toLowerCase().includes("password") ||
                      field.name.toLowerCase().includes("secret")
                    )
                    const isChoice = field.type === "choices" && Array.isArray(field.options) && field.options.length > 0
                    const isBoolean = field.type === "boolean"

                    // Labels humanizados e precisos para o padrão BPO
                    let displayLabel = field.label || field.name
                    if (field.name === "usuario" || field.name === "username" || field.name === "login_usuario") {
                      displayLabel = "Usuário (login do portal)"
                    } else if (field.name === "senha" || field.name === "password") {
                      displayLabel = "Senha"
                    }

                    return (
                      <div key={field.name} className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700">
                          {displayLabel}
                          <span className="text-rose-500 ml-1">*</span>
                        </label>

                        {/* Campo Select */}
                        {isChoice ? (
                          <select
                            value={formValues[field.name] || ""}
                            onChange={(e) =>
                              setFormValues({ ...formValues, [field.name]: e.target.value })
                            }
                            required
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          >
                            <option value="">Selecione...</option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : isBoolean ? (
                          /* Campo Checkbox / Boolean */
                          <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={Boolean(formValues[field.name])}
                              onChange={(e) =>
                                setFormValues({ ...formValues, [field.name]: e.target.checked })
                              }
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-600">{displayLabel}</span>
                          </label>
                        ) : (
                          /* Campo Texto ou Senha */
                          <div className="relative">
                            <input
                              type={isSensitive && !showPassword[field.name] ? "password" : "text"}
                              value={formValues[field.name] || ""}
                              onChange={(e) =>
                                setFormValues({ ...formValues, [field.name]: e.target.value })
                              }
                              required
                              placeholder={
                                field.format_hint ||
                                (isSensitive
                                  ? "Digite sua senha"
                                  : field.name === "usuario" || field.name === "username" || field.name === "login_usuario"
                                  ? "ex.: P12345.678 ou seu usuário de acesso"
                                  : `Digite ${displayLabel.toLowerCase()}`)
                              }
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all pr-10"
                            />
                            {isSensitive && (
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(field.name)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                {showPassword[field.name] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {field.format_hint && !isChoice && (
                          <p className="text-[11px] text-gray-400">{field.format_hint}</p>
                        )}
                      </div>
                    )
                  })}

                  <div className="pt-2 text-[11px] text-gray-400">
                    <p className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      Suas credenciais são transmitidas de ponta a ponta com segurança e criptografia bancária.
                    </p>
                  </div>
                </form>
              ) : !requiresScope ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  <Info className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
                  <p>Nenhum campo de configuração adicional necessário no momento para este banco.</p>
                </div>
              ) : null}
            </div>

            {/* Rodapé do Modal com Ações */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/70">
              <Button
                variant="outline"
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </Button>

              {visibleFields.length > 0 && (
                <Button
                  type="submit"
                  form="bank-credentials-form"
                  disabled={savingCredentials}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {savingCredentials ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Credenciais"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
