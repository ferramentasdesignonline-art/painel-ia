"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, RefreshCw, AlertCircle, Bot, UserCheck, Sparkles, MessageCircle, Info, Car } from "lucide-react"

function TableSelect({
  label,
  value,
  onChange,
  tables,
  loadingTables,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  tables: string[]
  loadingTables: boolean
}) {
  const [isManual, setIsManual] = useState(tables.length === 0 && !loadingTables)

  useEffect(() => {
    if (tables.length === 0 && !loadingTables) {
      setIsManual(true)
    } else if (tables.length > 0) {
      setIsManual(false)
    }
  }, [tables.length, loadingTables])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button 
          type="button" 
          onClick={() => setIsManual(!isManual)}
          className="text-[10px] text-indigo-600 hover:underline"
        >
          {isManual ? "Ver lista" : "Digitar manualmente"}
        </button>
      </div>
      
      <div className="relative">
        {isManual ? (
          <input
            type="text"
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 font-mono text-xs bg-indigo-50/20"
            placeholder="Digite o nome exato da tabela"
          />
        ) : (
          <>
            <select
              required
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 pr-8 bg-white appearance-none font-mono text-xs"
            >
              <option value="">
                {loadingTables ? "Carregando tabelas..." : "-- Selecione uma tabela --"}
              </option>
              {tables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              {loadingTables ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function NovoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [tables, setTables] = useState<string[]>([])
  const [loadingTables, setLoadingTables] = useState(true)
  const [instancias, setInstancias] = useState<Array<{ id: string; nome_instancia: string; cliente_id: string | null }>>([])
  const [loadingInstancias, setLoadingInstancias] = useState(true)

  const [tipoAtendimento, setTipoAtendimento] = useState<'com_ia' | 'sem_ia'>('sem_ia')
  const [moduloEstoqueAtivo, setModuloEstoqueAtivo] = useState(false)

  const [formData, setFormData] = useState({
    nome: "",
    slug: "",
    email: "",
    password: "",
    nome_instancia: "",
    tabela_leads: "",
    tabela_bloqueios: "",
    tabela_memoria: "",
    tabela_estoque: "",
    supabase_url: "",
    supabase_anon_key: "",
    supabase_service_role_key: "",
    whatsapp_token: "",
  })

  const fetchTables = async () => {
    setLoadingTables(true)
    try {
      const res = await fetch("/api/admin/tables")
      const json = await res.json()
      if (json.tables) {
        setTables(json.tables)
      }
    } catch (e) {
      console.error("Erro ao carregar tabelas:", e)
    } finally {
      setLoadingTables(false)
    }
  }

  const fetchInstancias = async () => {
    setLoadingInstancias(true)
    try {
      const res = await fetch("/api/admin/instancias")
      const json = await res.json()
      if (json.instancias) {
        setInstancias(json.instancias)
      }
    } catch (e) {
      console.error("Erro ao carregar instâncias:", e)
    } finally {
      setLoadingInstancias(false)
    }
  }

  useEffect(() => {
    fetchTables()
    fetchInstancias()
  }, [])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value
    const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    setFormData(prev => ({ ...prev, nome, slug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const payload = {
        ...formData,
        tipo_atendimento: tipoAtendimento,
      }

      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao criar cliente")
      }

      router.push("/admin/clientes")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans">Novo Cliente SaaS</h1>
        <p className="text-gray-500 mt-2 font-sans">Cadastre uma nova concessionária e configure o tipo de atendimento.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 shadow-sm border border-gray-100 rounded-2xl">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tipo de Atendimento Selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">Tipo de Atendimento do Cliente</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setTipoAtendimento('sem_ia')}
              className={`cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 ${
                tipoAtendimento === 'sem_ia'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tipoAtendimento === 'sem_ia' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Sem IA (Atendimento Humano)</h4>
                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">CRM Simplificado</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mt-2">
                Concessionária opera com vendedores humanos. Mensagens e leads centralizados via instância da Uazapi/Wacloud, sem necessidade de tabelas dedicadas.
              </p>
            </div>

            <div
              onClick={() => setTipoAtendimento('com_ia')}
              className={`cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 ${
                tipoAtendimento === 'com_ia'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tipoAtendimento === 'com_ia' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Com IA (Automação Completa)</h4>
                  <span className="text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Agente IA Ativo</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mt-2">
                Agente inteligente responde automaticamente. Requer tabelas dedicadas de leads, memória, bloqueios e estoque.
              </p>
            </div>
          </div>
        </div>

        {/* Informação sobre Sem IA */}
        {tipoAtendimento === 'sem_ia' && (
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 leading-relaxed">
              <strong className="font-semibold">Como funciona o modo Sem IA:</strong> O painel lê automaticamente contatos, conversas e etiquetas direto da instância vinculada da Uazapi. Você <strong>não precisa criar nenhuma tabela no banco de dados</strong>. O QR Code do WhatsApp é escaneado pelo próprio cliente na tela de Conexão WhatsApp.
            </div>
          </div>
        )}

        {/* Dados da Concessionária */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 pb-3 border-b border-gray-100 mb-4">Dados da Concessionária</h3>
          <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Concessionária</label>
              <input
                type="text" required value={formData.nome} onChange={handleNameChange}
                className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                placeholder="Ex: CarShop Automóveis"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL Amigável)</label>
              <input
                type="text" required value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-gray-50 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Instância Uazapi</label>
              <input
                type="text"
                required
                list="instancias-list"
                value={formData.nome_instancia}
                onChange={(e) => setFormData({ ...formData, nome_instancia: e.target.value })}
                className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border font-mono"
                placeholder="Ex: CarShop"
              />
              <datalist id="instancias-list">
                {instancias.map((inst) => (
                  <option key={inst.id} value={inst.nome_instancia}>
                    {inst.nome_instancia} {inst.cliente_id ? "(Já vinculada)" : "(Disponível)"}
                  </option>
                ))}
              </datalist>
              <p className="text-[11px] text-gray-400 mt-1">
                Digite o nome da nova instância (será criada na Uazapi) ou selecione da lista.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de Acesso</label>
              <input
                type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                placeholder="contato@carshop.com.br"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha Inicial</label>
              <input
                type="password" required minLength={6} value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
        </div>

        {/* Tabelas e Configurações (Apenas para Com IA) */}
        {tipoAtendimento === 'com_ia' && (
          <>
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Vincular Tabelas do Supabase</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Selecione as tabelas que pertencem a este cliente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
                <TableSelect
                  label="Tabela de Leads"
                  value={formData.tabela_leads}
                  onChange={(v) => setFormData({ ...formData, tabela_leads: v })}
                  tables={tables}
                  loadingTables={loadingTables}
                />
                <TableSelect
                  label="Tabela de Bloqueios"
                  value={formData.tabela_bloqueios}
                  onChange={(v) => setFormData({ ...formData, tabela_bloqueios: v })}
                  tables={tables}
                  loadingTables={loadingTables}
                />
                <TableSelect
                  label="Tabela de Memória (Chat)"
                  value={formData.tabela_memoria}
                  onChange={(v) => setFormData({ ...formData, tabela_memoria: v })}
                  tables={tables}
                  loadingTables={loadingTables}
                />
              </div>
            </div>

            {/* Módulo de Estoque (Opcional) */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">Módulo de Estoque</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                        Opcional
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Habilita o gerenciamento de estoque, upload de fotos no Cloudflare R2 e botões de ativar/desativar veículos.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduloEstoqueAtivo}
                    onChange={(e) => {
                      const ativo = e.target.checked
                      setModuloEstoqueAtivo(ativo)
                      if (!ativo) {
                        setFormData((prev) => ({ ...prev, tabela_estoque: "" }))
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {moduloEstoqueAtivo && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <TableSelect
                    label="Tabela de Estoque (NocoDB ou Supabase)"
                    value={formData.tabela_estoque}
                    onChange={(v) => setFormData({ ...formData, tabela_estoque: v })}
                    tables={tables}
                    loadingTables={loadingTables}
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Ex: <code className="text-indigo-600 font-mono font-semibold">cr_motors_estoque</code> ou o ID da tabela no NocoDB.
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Configurações Avançadas (Opcional)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Credenciais para o modelo Multi-Supabase e integração WhatsApp.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supabase URL (Cliente)</label>
                  <input
                    type="text" value={formData.supabase_url}
                    onChange={(e) => setFormData({ ...formData, supabase_url: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border font-mono text-xs"
                    placeholder="https://xxx.supabase.co"
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supabase Anon Key</label>
                  <input
                    type="text" value={formData.supabase_anon_key}
                    onChange={(e) => setFormData({ ...formData, supabase_anon_key: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border font-mono text-xs"
                    placeholder="eyJh..."
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supabase Service Role Key</label>
                  <input
                    type="password" value={formData.supabase_service_role_key}
                    onChange={(e) => setFormData({ ...formData, supabase_service_role_key: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border font-mono text-xs"
                    placeholder="eyJh..."
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Token (UAZAPI)</label>
                  <input
                    type="text" value={formData.whatsapp_token}
                    onChange={(e) => setFormData({ ...formData, whatsapp_token: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border font-mono text-xs"
                    placeholder="Token gerado na UAZAPI"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="pt-5 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button" onClick={() => router.back()}
            className="py-2.5 px-5 border border-gray-300 rounded-xl shadow-xs text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit" disabled={loading}
            className="inline-flex items-center gap-2 justify-center py-2.5 px-6 border border-transparent shadow-xs text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Criando...</span>
              </>
            ) : (
              <span>Criar Cliente</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
