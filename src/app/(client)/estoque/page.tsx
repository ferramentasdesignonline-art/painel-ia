"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Car,
  Search,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Fuel,
  Gauge,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VeiculoEstoque } from "@/lib/estoque/service"

export default function EstoquePage() {
  const [ativos, setAtivos] = useState<VeiculoEstoque[]>([])
  const [inativos, setInativos] = useState<VeiculoEstoque[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [message, setMessage] = useState("")

  const [activeTab, setActiveTab] = useState<"ativos" | "inativos">("ativos")
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
  const [filterCombustivel, setFilterCombustivel] = useState("")
  const [filterCambio, setFilterCambio] = useState("")

  const [togglingId, setTogglingId] = useState<string | number | null>(null)

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VeiculoEstoque | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [formData, setFormData] = useState<Partial<VeiculoEstoque>>({
    marca: "",
    modelo: "",
    versao: "",
    ano: "",
    cor: "",
    quilometragem: "",
    combustivel: "",
    cambio: "",
    valor_venda: "",
    fotos: [],
    opcionais: "",
    tipo: "",
  })

  // Modal de Galeria Ampliada
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchEstoque() {
    setLoading(true)
    try {
      const res = await fetch("/api/estoque")
      const json = await res.json()

      if (json.enabled === false) {
        setEnabled(false)
        setMessage(json.message || "Módulo de estoque não habilitado.")
        return
      }

      setEnabled(true)
      setAtivos(json.ativos || [])
      setInativos(json.inativos || [])
    } catch (err: any) {
      console.error("Erro ao carregar estoque:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEstoque()
  }, [])

  // Alternar Ativar / Desativar
  async function handleToggle(vehicle: VeiculoEstoque) {
    const id = vehicle.Id || vehicle.id
    if (!id) return

    setTogglingId(id)
    const tornarAtivo = !vehicle.ativo

    try {
      const res = await fetch("/api/estoque/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tornarAtivo }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || "Erro ao alterar status")
        return
      }

      // Atualiza estado local imediatamente
      if (tornarAtivo) {
        setInativos((prev) => prev.filter((v) => (v.Id || v.id) !== id))
        setAtivos((prev) => [{ ...vehicle, ativo: true }, ...prev])
      } else {
        setAtivos((prev) => prev.filter((v) => (v.Id || v.id) !== id))
        setInativos((prev) => [{ ...vehicle, ativo: false }, ...prev])
      }
    } catch (err) {
      alert("Falha de conexão ao alterar status.")
    } finally {
      setTogglingId(null)
    }
  }

  // Excluir Veículo
  async function handleDelete(vehicle: VeiculoEstoque) {
    const id = vehicle.Id || vehicle.id
    if (!id) return

    if (!confirm(`Deseja realmente excluir permanentemente o veículo ${vehicle.marca} ${vehicle.modelo}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/estoque/${id}?ativo=${vehicle.ativo}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Erro ao excluir veículo")
        return
      }

      if (vehicle.ativo) {
        setAtivos((prev) => prev.filter((v) => (v.Id || v.id) !== id))
      } else {
        setInativos((prev) => prev.filter((v) => (v.Id || v.id) !== id))
      }
    } catch {
      alert("Falha ao excluir veículo.")
    }
  }

  // Abrir Modal de Edição
  function handleOpenEdit(vehicle: VeiculoEstoque) {
    setEditingVehicle(vehicle)
    setFormData({
      marca: vehicle.marca || "",
      modelo: vehicle.modelo || "",
      versao: vehicle.versao || "",
      ano: vehicle.ano || "",
      cor: vehicle.cor || "",
      quilometragem: vehicle.quilometragem || "",
      combustivel: vehicle.combustivel || "",
      cambio: vehicle.cambio || "",
      valor_venda: vehicle.valor_venda || "",
      fotos: vehicle.fotos || [],
      opcionais: Array.isArray(vehicle.opcionais) ? vehicle.opcionais.join("\n") : String(vehicle.opcionais || ""),
      tipo: vehicle.tipo || "",
    })
    setModalOpen(true)
  }

  // Abrir Modal de Criação
  function handleOpenCreate() {
    setEditingVehicle(null)
    setFormData({
      marca: "",
      modelo: "",
      versao: "",
      ano: "",
      cor: "",
      quilometragem: "",
      combustivel: "Flex",
      cambio: "Automático",
      valor_venda: "",
      fotos: [],
      opcionais: "",
      tipo: "Carro",
    })
    setModalOpen(true)
  }

  // Upload de Fotos para Cloudflare R2
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingPhotos(true)
    try {
      const form = new FormData()
      for (let i = 0; i < files.length; i++) {
        form.append("files", files[i])
      }

      const res = await fetch("/api/estoque/upload", {
        method: "POST",
        body: form,
      })

      const json = await res.json()
      if (json.success && Array.isArray(json.urls)) {
        setFormData((prev) => ({
          ...prev,
          fotos: [...(prev.fotos || []), ...json.urls],
        }))
      } else {
        alert(json.error || "Erro no upload das imagens")
      }
    } catch {
      alert("Erro ao enviar imagens para o Cloudflare R2.")
    } finally {
      setUploadingPhotos(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleRemovePhoto(index: number) {
    setFormData((prev) => ({
      ...prev,
      fotos: (prev.fotos || []).filter((_, i) => i !== index),
    }))
  }

  // Salvar Veículo (Criar ou Editar)
  async function handleSaveVehicle(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.marca || !formData.modelo) {
      alert("Marca e modelo são obrigatórios.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        opcionais: typeof formData.opcionais === "string" ? formData.opcionais.split("\n").filter(Boolean) : formData.opcionais,
      }

      if (editingVehicle) {
        const id = editingVehicle.Id || editingVehicle.id
        const res = await fetch(`/api/estoque/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, ativo: editingVehicle.ativo }),
        })

        if (!res.ok) {
          const err = await res.json()
          alert(err.error || "Erro ao salvar alterações")
          return
        }

        setModalOpen(false)
        fetchEstoque()
      } else {
        const res = await fetch("/api/estoque", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const err = await res.json()
          alert(err.error || "Erro ao criar veículo")
          return
        }

        setModalOpen(false)
        fetchEstoque()
      }
    } catch {
      alert("Erro ao processar requisição.")
    } finally {
      setSaving(false)
    }
  }

  // Filtragem dos veículos
  const veiculosExibidos = useMemo(() => {
    const list = activeTab === "ativos" ? ativos : inativos

    return list.filter((v) => {
      const search = searchTerm.toLowerCase().trim()
      const matchSearch =
        !search ||
        v.marca?.toLowerCase().includes(search) ||
        v.modelo?.toLowerCase().includes(search) ||
        v.versao?.toLowerCase().includes(search) ||
        String(v.ano || "").includes(search) ||
        v.cor?.toLowerCase().includes(search)

      const matchCombustivel =
        !filterCombustivel || v.combustivel?.toLowerCase() === filterCombustivel.toLowerCase()
      const matchCambio = !filterCambio || v.cambio?.toLowerCase() === filterCambio.toLowerCase()

      return matchSearch && matchCombustivel && matchCambio
    })
  }, [activeTab, ativos, inativos, searchTerm, filterCombustivel, filterCambio])

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-xs">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
          <Car className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Módulo de Estoque Não Habilitado</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">{message}</p>
        <p className="text-xs text-gray-400">
          Para ativar o estoque deste cliente, acesse o painel de administração e habilite a tabela de estoque.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-poppins">
              Estoque de Veículos
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Cloudflare R2 & IA
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie os carros disponíveis no estoque. Ative ou desative veículos com sincronização instantânea com a IA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEstoque}
            disabled={loading}
            className="rounded-xl border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-medium"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Veículo
          </Button>
        </div>
      </div>

      {/* Abas e Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Abas Ativos / Desativados */}
          <div className="flex items-center p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setActiveTab("ativos")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "ativos"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Ativos no Estoque</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-700 font-bold">
                {ativos.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("inativos")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "inativos"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <XCircle className="w-4 h-4 text-gray-400" />
              <span>Desativados / Pausados</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-bold">
                {inativos.length}
              </span>
            </button>
          </div>

          {/* Alternar Visualização (Cards vs Tabela) */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-lg border transition-colors ${
                viewMode === "cards"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                  : "border-gray-200 text-gray-400 hover:text-gray-600"
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg border transition-colors ${
                viewMode === "table"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                  : "border-gray-200 text-gray-400 hover:text-gray-600"
              }`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Linha de Busca e Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Buscar por marca, modelo, versão, ano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white text-sm"
            />
          </div>

          <select
            value={filterCombustivel}
            onChange={(e) => setFilterCombustivel(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os Combustíveis</option>
            <option value="Flex">Flex</option>
            <option value="Gasolina">Gasolina</option>
            <option value="Diesel">Diesel</option>
            <option value="Híbrido">Híbrido</option>
            <option value="Elétrico">Elétrico</option>
          </select>

          <select
            value={filterCambio}
            onChange={(e) => setFilterCambio(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os Câmbios</option>
            <option value="Automático">Automático</option>
            <option value="Manual">Manual</option>
            <option value="CVT">CVT</option>
          </select>
        </div>
      </div>

      {/* Conteúdo: Cards ou Tabela */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando catálogo de veículos...</p>
        </div>
      ) : veiculosExibidos.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-200/80 p-8 shadow-xs">
          <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">Nenhum veículo encontrado</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchTerm || filterCombustivel || filterCambio
              ? "Tente ajustar os filtros ou o termo de pesquisa."
              : activeTab === "ativos"
              ? "Você ainda não tem veículos cadastrados no estoque ativo."
              : "Não há veículos desativados no momento."}
          </p>
          {activeTab === "ativos" && !searchTerm && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Cadastrar Primeiro Veículo
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* Visualização em Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {veiculosExibidos.map((vehicle) => {
            const id = vehicle.Id || vehicle.id
            const isToggling = togglingId === id
            const fotos = vehicle.fotos || []
            const capa = fotos.length > 0 ? fotos[0] : null

            return (
              <div
                key={id}
                className={`group flex flex-col bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  vehicle.ativo
                    ? "border-gray-200/80 hover:border-indigo-300"
                    : "border-gray-200 bg-gray-50/50 opacity-90"
                }`}
              >
                {/* Imagem de Capa */}
                <div className="relative aspect-16/10 bg-gray-100 overflow-hidden cursor-pointer"
                  onClick={() => {
                    if (fotos.length > 0) {
                      setGalleryPhotos(fotos)
                      setGalleryIndex(0)
                      setGalleryOpen(true)
                    }
                  }}
                >
                  {capa ? (
                    <img
                      src={capa}
                      alt={`${vehicle.marca} ${vehicle.modelo}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                      <Car className="w-12 h-12 mb-1 opacity-40" />
                      <span className="text-xs">Sem foto</span>
                    </div>
                  )}

                  {/* Badge de Quantidade de Fotos */}
                  {fotos.length > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-[11px] font-medium">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{fotos.length}</span>
                    </div>
                  )}

                  {/* Badge Status Ativo/Inativo */}
                  <div className="absolute top-2.5 left-2.5">
                    {vehicle.ativo ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-700 text-white shadow-xs">
                        Desativado
                      </span>
                    )}
                  </div>
                </div>

                {/* Dados do Carro */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                          {vehicle.marca}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {vehicle.modelo}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400 block">Preço</span>
                        <span className="text-base font-extrabold text-emerald-600">
                          {vehicle.valor_venda || "Consulte"}
                        </span>
                      </div>
                    </div>

                    {vehicle.versao && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{vehicle.versao}</p>
                    )}

                    {/* Tags / Especificações */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
                      {vehicle.ano && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Ano: {vehicle.ano}</span>
                        </div>
                      )}
                      {vehicle.quilometragem && (
                        <div className="flex items-center gap-1.5">
                          <Gauge className="w-3.5 h-3.5 text-gray-400" />
                          <span>{vehicle.quilometragem} km</span>
                        </div>
                      )}
                      {vehicle.combustivel && (
                        <div className="flex items-center gap-1.5">
                          <Fuel className="w-3.5 h-3.5 text-gray-400" />
                          <span>{vehicle.combustivel}</span>
                        </div>
                      )}
                      {vehicle.cambio && (
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-gray-400" />
                          <span>{vehicle.cambio}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra de Ações: Switch Ativar/Desativar + Editar/Excluir */}
                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle(vehicle)}
                      disabled={isToggling}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        vehicle.ativo
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {isToggling ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : vehicle.ativo ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span>{vehicle.ativo ? "Ativo" : "Desativado"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(vehicle)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar veículo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Visualização em Tabela */
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Veículo</th>
                  <th className="py-3 px-4">Ano</th>
                  <th className="py-3 px-4">KM</th>
                  <th className="py-3 px-4">Câmbio / Comb.</th>
                  <th className="py-3 px-4">Preço</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {veiculosExibidos.map((vehicle) => {
                  const id = vehicle.Id || vehicle.id
                  const isToggling = togglingId === id
                  const fotos = vehicle.fotos || []
                  const capa = fotos[0]

                  return (
                    <tr key={id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                            {capa ? (
                              <img src={capa} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Car className="w-5 h-5 opacity-40" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                              {vehicle.marca}
                            </span>
                            <span className="font-bold text-gray-900 block">{vehicle.modelo}</span>
                            {vehicle.versao && (
                              <span className="text-xs text-gray-400 block line-clamp-1">
                                {vehicle.versao}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">{vehicle.ano || "-"}</td>
                      <td className="py-3.5 px-4 text-xs">{vehicle.quilometragem ? `${vehicle.quilometragem} km` : "-"}</td>
                      <td className="py-3.5 px-4 text-xs">
                        <span>{vehicle.cambio || "-"}</span>
                        <span className="text-gray-400 block">{vehicle.combustivel || ""}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">
                        {vehicle.valor_venda || "Consulte"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggle(vehicle)}
                          disabled={isToggling}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            vehicle.ativo
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                          }`}
                        >
                          {isToggling ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                vehicle.ativo ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                            ></span>
                          )}
                          <span>{vehicle.ativo ? "Ativo" : "Desativado"}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(vehicle)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(vehicle)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  {editingVehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSaveVehicle} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Seção de Fotos com Upload Cloudflare R2 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-800">
                    Galeria de Fotos (Cloudflare R2)
                  </label>
                  <span className="text-xs text-gray-400">
                    {formData.fotos?.length || 0} fotos adicionadas
                  </span>
                </div>

                {/* Dropzone de Upload */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-indigo-50/20"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploadingPhotos ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                      <p className="text-sm font-semibold text-gray-700">Enviando para o Cloudflare R2...</p>
                      <p className="text-xs text-gray-400">Aguarde o processamento das imagens</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-2">
                      <UploadCloud className="w-9 h-9 text-indigo-500 mb-2" />
                      <p className="text-sm font-semibold text-gray-700">
                        Clique para enviar fotos do veículo
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG ou WEBP (múltiplos arquivos)</p>
                    </div>
                  )}
                </div>

                {/* Preview das Fotos Carregadas */}
                {formData.fotos && formData.fotos.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
                    {formData.fotos.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                            Capa
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informações Básicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Chevrolet"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Onix, Veraneio, Corolla"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Versão</label>
                  <input
                    type="text"
                    placeholder="Ex: 1.0 Turbo LTZ"
                    value={formData.versao || ""}
                    onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ano / Modelo</label>
                  <input
                    type="text"
                    placeholder="Ex: 2021 ou 2021/2022"
                    value={formData.ano || ""}
                    onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cor</label>
                  <input
                    type="text"
                    placeholder="Ex: Preto, Prata"
                    value={formData.cor || ""}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Quilometragem (KM)</label>
                  <input
                    type="text"
                    placeholder="Ex: 45000"
                    value={formData.quilometragem || ""}
                    onChange={(e) => setFormData({ ...formData, quilometragem: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Câmbio</label>
                  <select
                    value={formData.cambio || ""}
                    onChange={(e) => setFormData({ ...formData, cambio: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="">Selecione</option>
                    <option value="Automático">Automático</option>
                    <option value="Manual">Manual</option>
                    <option value="CVT">CVT</option>
                    <option value="Automatizado">Automatizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Combustível</label>
                  <select
                    value={formData.combustivel || ""}
                    onChange={(e) => setFormData({ ...formData, combustivel: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="">Selecione</option>
                    <option value="Flex">Flex</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Híbrido">Híbrido</option>
                    <option value="Elétrico">Elétrico</option>
                    <option value="Etanol">Etanol</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Valor de Venda</label>
                  <input
                    type="text"
                    placeholder="Ex: R$ 89.900"
                    value={formData.valor_venda || ""}
                    onChange={(e) => setFormData({ ...formData, valor_venda: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-semibold text-emerald-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Opcionais / Observações */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Opcionais e Observações (Uma por linha ou texto descritivo)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ar-condicionado, Direção elétrica, Vidros elétricos, Sensor de estacionamento..."
                  value={formData.opcionais || ""}
                  onChange={(e) => setFormData({ ...formData, opcionais: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || uploadingPhotos}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Veículo"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE GALERIA AMPLIFICADA */}
      {galleryOpen && galleryPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute top-5 right-5 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative max-w-4xl max-h-[85vh] flex items-center justify-center">
            <img
              src={galleryPhotos[galleryIndex]}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />

            {galleryPhotos.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setGalleryIndex((prev) => (prev > 0 ? prev - 1 : galleryPhotos.length - 1))
                  }
                  className="absolute left-2 p-3 text-white bg-black/50 hover:bg-black/80 rounded-full"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() =>
                    setGalleryIndex((prev) => (prev < galleryPhotos.length - 1 ? prev + 1 : 0))
                  }
                  className="absolute right-2 p-3 text-white bg-black/50 hover:bg-black/80 rounded-full"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <div className="absolute -bottom-8 text-center text-white/80 text-xs font-medium">
              {galleryIndex + 1} de {galleryPhotos.length} fotos
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
