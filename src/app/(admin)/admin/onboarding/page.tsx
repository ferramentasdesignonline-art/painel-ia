"use client"

import { useState, useEffect } from "react"
import { 
  ClipboardCheck, 
  Plus, 
  ExternalLink, 
  Copy, 
  Check, 
  RefreshCw, 
  Smartphone, 
  Search,
  Building,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  MapPin,
  Database,
  Lock,
  Landmark,
  ShieldCheck,
  Send
} from "lucide-react"

export default function AdminOnboardingPage() {
  const [onboardings, setOnboardings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Modal Criar
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [novoNome, setNovoNome] = useState("")
  const [creating, setCreating] = useState(false)

  // Modal Ver Respostas
  const [selectedOnboarding, setSelectedOnboarding] = useState<any | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchOnboardings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/onboarding")
      const data = await res.json()
      if (res.ok && data.onboardings) {
        setOnboardings(data.onboardings)
      }
    } catch (e) {
      console.error("Erro ao carregar onboardings:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOnboardings()
  }, [])

  const handleCreate = async () => {
    if (!novoNome.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_cliente: novoNome.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao criar")
      
      setNovoNome("")
      setShowCreateModal(false)
      await fetchOnboardings()
    } catch (e: any) {
      alert(e.message || "Erro ao gerar link de onboarding")
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = onboardings.filter(o => 
    (o.nome_cliente || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.token || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ClipboardCheck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Onboarding de Clientes
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Gere links interativos para novos clientes preencherem dados da loja, CRM, bancos e conectarem o WhatsApp.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Gerar Link de Onboarding</span>
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total de Links</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{onboardings.length}</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold">
            <Building className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Concluídos</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {onboardings.filter(o => o.status === "concluido").length}
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Aguardando Preenchimento</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {onboardings.filter(o => o.status !== "concluido").length}
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabela de Links */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente ou token..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={fetchOnboardings}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all self-end sm:self-auto cursor-pointer"
            title="Recarregar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-5">Cliente / Concessionária</th>
                <th className="py-3 px-5">Link de Acesso</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-center">WhatsApp</th>
                <th className="py-3 px-5 text-center">IA / Atendente</th>
                <th className="py-3 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading && onboardings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    Carregando onboardings...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    Nenhum onboarding encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const link = `${origin}/onboarding/${item.token}`
                  const isDone = item.status === "concluido"

                  return (
                    <tr key={item.Id || item.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-5 font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                            {item.nome_cliente?.substring(0, 2) || "LO"}
                          </div>
                          <div>
                            <div>{item.nome_cliente}</div>
                            <div className="text-[11px] text-gray-400 font-normal">
                              Token: <code className="font-mono text-indigo-600">{item.token}</code>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 max-w-xs">
                          <input
                            type="text"
                            readOnly
                            value={link}
                            className="bg-gray-50 border border-gray-200 text-xs text-gray-600 rounded-lg px-2 py-1 truncate flex-1 font-mono"
                          />
                          <button
                            onClick={() => copyToClipboard(link, `link-${item.id}`)}
                            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors cursor-pointer"
                            title="Copiar Link"
                          >
                            {copiedId === `link-${item.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"
                            title="Abrir Link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-center">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluído
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-center">
                        {item.whatsapp_conectado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                            🟢 Conectado
                          </span>
                        ) : item.instancia_whatsapp ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            🟡 Não conectado
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-center font-medium text-gray-700">
                        {item.nome_ia ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                            <Sparkles className="w-3 h-3" />
                            {item.nome_ia}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        {isDone ? (
                          <button
                            onClick={() => setSelectedOnboarding(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Respostas
                          </button>
                        ) : (
                          <button
                            onClick={() => copyToClipboard(link, `link-${item.id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copiar Link
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar Link de Onboarding */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Novo Link de Onboarding</h3>
                <p className="text-xs text-gray-500">Gere um link exclusivo para o cliente preencher</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nome da Concessionária / Loja
                </label>
                <input
                  type="text"
                  placeholder="Ex: Auto Motors Campinas"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  O link será gerado com o nome da loja e já virá preenchido na primeira etapa.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !novoNome.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Gerando...</span>
                    </>
                  ) : (
                    <span>Gerar Link</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizar Respostas do Onboarding */}
      {selectedOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header Modal */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedOnboarding.nome_cliente}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Onboarding Concluído
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Concluído em: {selectedOnboarding.concluido_em ? new Date(selectedOnboarding.concluido_em).toLocaleString("pt-BR") : "—"}
                </p>
              </div>
              <button
                onClick={() => setSelectedOnboarding(null)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-6 overflow-y-auto space-y-6">
              {(() => {
                const r = selectedOnboarding.respostas_json || {}
                const bancos = r.bancos || {}

                return (
                  <>
                    {/* Bloco 1: Identidade & Localização */}
                    <div className="p-5 rounded-2xl border border-gray-200 bg-white space-y-4 shadow-2xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                        <Building className="w-4 h-4" />
                        1. Identidade da Concessionária & Atendente IA
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-400 block font-medium">Nome da Loja</span>
                          <span className="text-gray-900 font-semibold text-sm">{r.nome_empresa || selectedOnboarding.nome_cliente}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">Nome da IA (Atendente Virtual)</span>
                          <span className="text-purple-700 font-bold text-sm bg-purple-50 px-2 py-0.5 rounded-md inline-block">
                            ✨ {r.nome_ia || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">Instagram Oficial</span>
                          <span className="text-gray-900 font-mono">{r.instagram || "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">WhatsApp de Avisos (Leads)</span>
                          <span className="text-gray-900 font-mono font-semibold">{r.whatsapp_avisos || "—"}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-gray-400 block font-medium">Endereço Completo</span>
                          <span className="text-gray-900">
                            {r.endereco ? `${r.endereco.logradouro}, ${r.endereco.numero} ${r.endereco.complemento || ""} - ${r.endereco.bairro}, ${r.endereco.cidade}/${r.endereco.uf} (CEP: ${r.endereco.cep})` : "—"}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-gray-400 block font-medium">Horário de Funcionamento</span>
                          <span className="text-gray-900">{r.horarios || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Acesso ao CRM / Sistema de Estoque */}
                    <div className="p-5 rounded-2xl border border-gray-200 bg-white space-y-4 shadow-2xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                        <Database className="w-4 h-4" />
                        2. Sistema de Gestão / CRM de Estoque
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-gray-400 block font-medium">Plataforma / Sistema</span>
                          <span className="text-gray-900 font-bold text-sm">{r.sistema_estoque || "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">E-mail de Acesso</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-gray-900 font-mono truncate">{r.acesso_crm?.email || "—"}</span>
                            {r.acesso_crm?.email && (
                              <button onClick={() => copyToClipboard(r.acesso_crm.email, "crm-email")} className="text-gray-400 hover:text-indigo-600">
                                {copiedId === "crm-email" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">Senha de Acesso</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-gray-900 font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">{r.acesso_crm?.senha || "—"}</span>
                            {r.acesso_crm?.senha && (
                              <button onClick={() => copyToClipboard(r.acesso_crm.senha, "crm-pass")} className="text-gray-400 hover:text-indigo-600">
                                {copiedId === "crm-pass" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bloco 3: Simulação de Bancos */}
                    <div className="p-5 rounded-2xl border border-gray-200 bg-white space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                          <Landmark className="w-4 h-4" />
                          3. Simulação Bancária & Financiamento
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${r.simulacao_bancos ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.simulacao_bancos ? "Habilitada" : "Desabilitada"}
                        </span>
                      </div>

                      {r.simulacao_bancos && Object.keys(bancos).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                          {Object.entries(bancos).map(([bancoKey, bancoData]: any) => (
                            <div key={bancoKey} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                              <span className="font-bold text-gray-900 uppercase text-[11px] block text-indigo-900">
                                {bancoKey}
                              </span>
                              <div className="space-y-0.5 text-gray-600 font-mono text-[11px]">
                                {Object.entries(bancoData || {}).map(([k, v]: any) => (
                                  <div key={k} className="flex items-center justify-between">
                                    <span className="text-gray-400 capitalize">{k.replace("_", " ")}:</span>
                                    <span className="font-medium text-gray-900 font-mono">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">O cliente optou por não trabalhar com simulação bancária.</p>
                      )}
                    </div>

                    {/* Bloco 4: Conexão WhatsApp */}
                    <div className="p-5 rounded-2xl border border-gray-200 bg-white space-y-3 shadow-2xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4" />
                        4. Conexão WhatsApp Uazapi
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-400 block font-medium">Nome da Instância</span>
                          <span className="font-mono font-bold text-gray-900 text-sm">
                            {r.instancia_whatsapp || selectedOnboarding.instancia_whatsapp || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">Status da Conexão</span>
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full mt-0.5">
                            🟢 WhatsApp Conectado com Sucesso
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/60 flex justify-end">
              <button
                onClick={() => setSelectedOnboarding(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
