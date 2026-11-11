"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  Landmark,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Building2,
  KeyRound,
  Eye,
  EyeOff,
  Share2,
  Info,
  X,
  Lock,
  ArrowRight,
  SlidersHorizontal,
  Store,
  ShieldCheck,
  ExternalLink,
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

const BPO_PREFERENTIAL_BANKS = ['655', '394', '623', '033', 'M22']

interface AdminBancosManagerProps {
  clients: any[]
}

export function AdminBancosManager({ clients }: AdminBancosManagerProps) {
  // Cliente selecionado (padrão: primeiro cliente da lista)
  const [selectedClientId, setSelectedClientId] = useState<string | number>(
    clients[0]?.id || ""
  )

  const selectedClient = useMemo(() => {
    return clients.find((c) => String(c.id) === String(selectedClientId)) || clients[0] || null
  }, [clients, selectedClientId])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [storePendente, setStorePendente] = useState(false)
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

  // Filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos")

  // Modal de Credenciais
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

  const visibleFields = useMemo(() => {
    const requiredOnly = fields.filter((f) => Boolean(f.required))
    return requiredOnly.length > 0 ? requiredOnly : fields
  }, [fields])

  // Buscar Bancos do cliente selecionado
  const fetchBancos = useCallback(
    async (clientId: string | number, isRefresh = false) => {
      if (!clientId) return
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      setErrorMessage(null)
      setStorePendente(false)

      try {
        const res = await fetch(`/api/bancos?clienteId=${encodeURIComponent(String(clientId))}`, {
          cache: "no-store",
        })
        const data = await res.json()

        if (data.pendente) {
          setStorePendente(true)
          setBancos([])
          setResumo({
            conectados: 0,
            invalidos: 0,
            sem_credencial: 0,
            em_verificacao: 0,
            inativos: 0,
            total: 0,
          })
          return
        }

        if (!res.ok) {
          throw new Error(data.error || "Erro ao consultar bancos parceiros.")
        }

        setBancos(data.bancos || [])
        setResumo(
          data.resumo || {
            conectados: 0,
            invalidos: 0,
            sem_credencial: 0,
            em_verificacao: 0,
            inativos: 0,
            total: (data.bancos || []).length,
          }
        )
        setUltimaSincronizacao(data.ultima_sincronizacao || null)
      } catch (err: any) {
        console.error("Erro ao carregar bancos:", err)
        setErrorMessage(err.message || "Não foi possível carregar os bancos.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedClientId) {
      fetchBancos(selectedClientId)
    }
  }, [selectedClientId, fetchBancos])

  // Filtragem de bancos
  const bancosFiltrados = useMemo(() => {
    return bancos.filter((banco) => {
      if (statusFilter !== "todos") {
        if (banco.status !== statusFilter) return false
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const matchName = banco.name?.toLowerCase().includes(term)
        const matchTradename = banco.tradename?.toLowerCase().includes(term)
        const matchCode = banco.code?.toLowerCase().includes(term)
        return matchName || matchTradename || matchCode
      }
      return true
    })
  }, [bancos, statusFilter, searchTerm])

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

  // Abrir Modal de Edição/Conexão
  async function handleOpenConnectModal(bank: BankWithStatus) {
    setSelectedBank(bank)
    setSaveErrorMsg(null)
    setSaveSuccessMsg(null)
    setFormValues({})
    setShowPassword({})
    setModalOpen(true)

    const isBpoBank = BPO_PREFERENTIAL_BANKS.includes(bank.code)
    const existingVersion = bank.bank_credential?.bank_integration_version
    const initialVersion = existingVersion || (isBpoBank ? "v2" : "v1")

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
    if (!selectedClientId) return
    setFieldsLoading(true)
    setRequiresScope(false)
    setScopeNotice("")
    setFields([])

    try {
      const res = await fetch(
        `/api/bancos/${encodeURIComponent(bankCode)}/fields?version=${encodeURIComponent(version)}&clienteId=${encodeURIComponent(String(selectedClientId))}`
      )
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

  async function handleVersionChange(version: string) {
    setSelectedVersion(version)
    if (selectedBank) {
      await loadFields(selectedBank.code, version)
    }
  }

  function togglePasswordVisibility(fieldName: string) {
    setShowPassword((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBank || !selectedClientId) return

    setSavingCredentials(true)
    setSaveErrorMsg(null)
    setSaveSuccessMsg(null)

    try {
      const res = await fetch(
        `/api/bancos/${encodeURIComponent(selectedBank.code)}?version=${encodeURIComponent(selectedVersion)}&clienteId=${encodeURIComponent(String(selectedClientId))}`,
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

      setTimeout(() => {
        fetchBancos(selectedClientId, true)
      }, 1500)
    } catch (err: any) {
      setSaveErrorMsg(err.message || "Falha ao gravar credenciais bancárias.")
    } finally {
      setSavingCredentials(false)
    }
  }

  // Se nenhum cliente tem bancos ativados
  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
          <Landmark className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum Cliente com Bancos Ativo</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          Nenhuma concessionária está com a opção <strong>"Habilitar Módulo de Bancos & Simulações"</strong> ativada no momento.
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
            <Landmark className="w-8 h-8 text-indigo-600" />
            Bancos & Conexões
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {clients.length} {clients.length === 1 ? "loja ativa" : "lojas ativas"}
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie e monitore as credenciais bancárias de cada concessionária parceira.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchBancos(selectedClientId, true)}
          disabled={refreshing || loading}
          className="rounded-xl border-gray-200 hover:bg-gray-50 text-xs font-bold shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar Conexões
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
                onClick={() => setSelectedClientId(c.id)}
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
          {/* Cards de Resumo da Loja Selecionada */}
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
                <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Operando normalmente</p>
              </CardContent>
            </Card>

            {/* Inválidos / Requer Ação */}
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
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inválidos</span>
                  <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-gray-900 mt-2 font-poppins">{resumo.invalidos}</div>
                <p className="text-[11px] text-rose-700 font-medium mt-0.5">Requer nova senha</p>
              </CardContent>
            </Card>

            {/* Sem Credencial */}
            <Card
              onClick={() => setStatusFilter(statusFilter === "none" ? "todos" : "none")}
              className={`cursor-pointer transition-all border rounded-2xl ${
                statusFilter === "none"
                  ? "border-slate-500 ring-2 ring-slate-500/20 bg-slate-50"
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

            {/* Total */}
            <Card
              onClick={() => setStatusFilter("todos")}
              className="cursor-pointer transition-all border rounded-2xl border-gray-200/70 hover:border-indigo-300 hover:shadow-xs bg-white col-span-2 sm:col-span-1"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total</span>
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-gray-900 mt-2 font-poppins">{resumo.total}</div>
                <p className="text-[11px] text-indigo-700 font-medium mt-0.5">Bancos parceiros</p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3.5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar por nome do banco, código Febraban..."
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

            {/* Pílulas de Filtro */}
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
                Inválidos ({resumo.invalidos})
              </button>

              <button
                onClick={() => setStatusFilter("none")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === "none"
                    ? "bg-slate-700 text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60"
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
                Em análise ({resumo.em_verificacao})
              </button>

              <span className="ml-auto text-xs text-gray-400 font-medium pl-2 hidden md:inline">
                Mostrando {bancosFiltrados.length} de {resumo.total} bancos
              </span>
            </div>
          </div>

          {/* Grid de Bancos */}
          {loading ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Consultando bancos de {selectedClient?.nome}...</p>
            </div>
          ) : bancosFiltrados.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
              <Landmark className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-base font-semibold text-gray-700">Nenhum banco encontrado</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm
                  ? `Nenhum resultado corresponde à busca "${searchTerm}".`
                  : "Nenhum banco nesta categoria."}
              </p>
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
                      {/* Topo do Card */}
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

                      {/* Descrição */}
                      <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px] mb-3">
                        {banco.description || banco.name}
                      </p>

                      {/* Metadados adicionais */}
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

                    {/* Botão de Ação */}
                    <div className="pt-3 border-t border-gray-100">
                      {isConnected && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConnectModal(banco)}
                          className="w-full rounded-xl border-gray-200 hover:bg-gray-50 text-xs font-semibold cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                          Editar Credenciais
                        </Button>
                      )}
                      {isInvalid && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenConnectModal(banco)}
                          className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" />
                          Corrigir Credenciais
                        </Button>
                      )}
                      {(isNone || isNotAnalyzed || isInactive) && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenConnectModal(banco)}
                          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" />
                          Conectar Banco
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal de Conexão / Edição de Credenciais */}
      {modalOpen && selectedBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100">
            {/* Cabeçalho do Modal */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-sm shrink-0"
                  style={{ backgroundColor: selectedBank.color || "#4F46E5" }}
                >
                  {selectedBank.tradename ? selectedBank.tradename.substring(0, 2).toUpperCase() : selectedBank.code}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight font-poppins">
                    {selectedBank.tradename || selectedBank.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span>Código Febraban: <strong>{selectedBank.code}</strong></span>
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

            {/* Conteúdo do Formulário */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Seletor de Versão (API vs BPO) */}
              {availableVersions.length > 1 && (
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                    Tipo de Conexão:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableVersions.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleVersionChange(v)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          selectedVersion === v
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {v === "v2" ? "Operador BPO (Usuário e Senha)" : "Direto via API (v1)"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagem de Erro ou Sucesso */}
              {saveSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-medium flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>{saveSuccessMsg}</div>
                </div>
              )}

              {saveErrorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-medium flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>{saveErrorMsg}</div>
                </div>
              )}

              {requiresScope && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-medium space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Permissão Pendente na Credere
                  </div>
                  <p className="text-amber-800">{scopeNotice}</p>
                </div>
              )}

              {/* Formulário Dinâmico */}
              {fieldsLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Consultando campos exigidos...</p>
                </div>
              ) : visibleFields.length === 0 && !requiresScope ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  Nenhum campo cadastrado para esta versão de integração.
                </div>
              ) : (
                <form id="bank-credentials-form" onSubmit={handleSaveCredentials} className="space-y-4">
                  {visibleFields.map((field) => {
                    const isSensitive = field.sensitive || field.type === "password"
                    const isVisible = showPassword[field.name]

                    return (
                      <div key={field.name} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                          <span>
                            {field.label}
                            {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                          </span>
                          {field.format_hint && (
                            <span className="text-[10px] text-gray-400 font-normal">{field.format_hint}</span>
                          )}
                        </label>

                        {field.type === "choices" && field.options ? (
                          <select
                            value={formValues[field.name] || ""}
                            onChange={(e) =>
                              setFormValues((prev) => ({
                                ...prev,
                                [field.name]: e.target.value,
                              }))
                            }
                            required={Boolean(field.required)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                          >
                            <option value="">Selecione uma opção...</option>
                            {field.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="relative">
                            <input
                              type={isSensitive && !isVisible ? "password" : "text"}
                              value={formValues[field.name] || ""}
                              onChange={(e) =>
                                setFormValues((prev) => ({
                                  ...prev,
                                  [field.name]: e.target.value,
                                }))
                              }
                              required={Boolean(field.required)}
                              placeholder={`Digite o ${field.label.toLowerCase()}...`}
                              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                            />

                            {isSensitive && (
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(field.name)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </form>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border-gray-200 hover:bg-white text-xs font-semibold cursor-pointer"
              >
                Fechar
              </Button>

              {!requiresScope && visibleFields.length > 0 && (
                <Button
                  type="submit"
                  form="bank-credentials-form"
                  size="sm"
                  disabled={savingCredentials || fieldsLoading}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {savingCredentials ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Gravando...
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
