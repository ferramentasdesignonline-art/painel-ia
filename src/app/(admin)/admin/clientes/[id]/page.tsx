"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, RefreshCw, Database, AlertCircle } from "lucide-react"

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

export default function EditarClientePage() {
  const router = useRouter()
  const { id } = require('next/navigation').useParams()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [tables, setTables] = useState<string[]>([])
  const [loadingTables, setLoadingTables] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nome: "",
    slug: "",
    email: "",
    tabela_leads: "",
    tabela_bloqueios: "",
    tabela_memoria: "",
    tabela_estoque: "",
  })

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const res = await fetch(`/api/admin/clientes/${id}`)
        if (res.ok) {
          const data = await res.json()
          setFormData({
            nome: data.nome || "",
            slug: data.slug || "",
            email: data.email || "",
            tabela_leads: data.tabela_leads || "",
            tabela_bloqueios: data.tabela_bloqueios || "",
            tabela_memoria: data.tabela_memoria || "",
            tabela_estoque: data.tabela_estoque || "",
          })
        }
      } catch (e) {
        console.error("Erro ao buscar cliente", e)
      } finally {
        setLoadingData(false)
      }
    }
    fetchClient()
  }, [id])

  const fetchTables = async () => {
    setLoadingTables(true)
    setApiError(null)
    try {
      const res = await fetch("/api/admin/tables")
      const json = await res.json()
      if (json.error) {
        setApiError(json.error)
      } else if (json.tables) {
        setTables(json.tables)
        if (json.tables.length === 0) {
          setApiError("Nenhuma tabela encontrada no schema público do seu Supabase.")
        }
      }
    } catch (e) {
      setApiError("Erro de conexão com a API de tabelas.")
    } finally {
      setLoadingTables(false)
    }
  }

  useEffect(() => {
    fetchTables()
  }, [])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value
    const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    setFormData({ ...formData, nome, slug })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/admin/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao atualizar cliente")
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
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Editar Cliente</h1>
        <p className="text-gray-500 mt-2">Atualize as informações e tabelas deste cliente.</p>
      </div>

      {loadingData ? (
        <div className="text-center py-10">Carregando dados...</div>
      ) : (
      <form onSubmit={handleSubmit} className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6 sm:p-8 space-y-8 max-w-3xl">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div>
          <h3 className="text-base font-semibold text-gray-900 pb-3 border-b border-gray-100 mb-4">Dados da Concessionária</h3>
          <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Concessionária</label>
              <input
                type="text" required value={formData.nome} onChange={handleNameChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                placeholder="Ex: Duo Motors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL Amigável)</label>
              <input
                type="text" required value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-gray-50 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de Acesso</label>
              <input
                type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                placeholder="contato@concessionaria.com.br"
              />
            </div>
          </div>
        </div>

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
            <TableSelect
              label="Tabela de Estoque"
              value={formData.tabela_estoque}
              onChange={(v) => setFormData({ ...formData, tabela_estoque: v })}
              tables={tables}
              loadingTables={loadingTables}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-semibold leading-6 text-gray-900 px-4 py-2 hover:bg-gray-50 rounded-md"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 flex items-center"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
      )}
    </div>
  )
}
