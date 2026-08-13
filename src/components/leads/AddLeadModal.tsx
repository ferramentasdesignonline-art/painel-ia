"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, UserPlus, Search, Phone, Car, Tag, Loader2, Calendar, StickyNote } from 'lucide-react'

type AddLeadModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddLeadModal({ isOpen, onClose, onSuccess }: AddLeadModalProps) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [veiculo, setVeiculo] = useState('')
  const [dataAgendamento, setDataAgendamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [etapaId, setEtapaId] = useState('')
  const [etapas, setEtapas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/funil/etapas')
        .then(r => r.json())
        .then(d => { if (d.etapas) setEtapas(d.etapas); })
        .catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!nome.trim() || !telefone.trim()) {
      setError('Nome e telefone são obrigatórios.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/funil/leads/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.trim(),
          veiculo_interessado: veiculo.trim() || null,
          etapa_id: etapaId || null,
          data_agendamento: dataAgendamento ? new Date(dataAgendamento).toISOString() : null,
          observacao_lead_qualificado: observacao.trim() || null,
        })
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erro ao criar lead.')
        return
      }
      setNome(''); setTelefone(''); setVeiculo(''); setEtapaId(''); setDataAgendamento(''); setObservacao('')
      onSuccess()
      onClose()
    } catch (e) {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Novo Lead Manual</h2>
              <p className="text-xs text-gray-400">Cadastrado diretamente no sistema</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Ex: João Silva"
              value={nome}
              onChange={e => setNome(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Telefone / WhatsApp <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Ex: (11) 99999-9999"
              value={telefone}
              onChange={e => {
                let v = e.target.value.replace(/\D/g, '');
                if (v.length > 11) v = v.slice(0, 11);
                if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
                if (v.length > 10) v = `${v.slice(0,10)}-${v.slice(10)}`;
                setTelefone(v);
              }}
              disabled={loading}
            />
            <p className="text-xs text-gray-400">Use formato nacional (DDD) + Número</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Veículo de interesse <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Input
              placeholder="Ex: Onix 1.0, HB20, Tracker..."
              value={veiculo}
              onChange={e => setVeiculo(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                Data do Agendamento <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="datetime-local"
                value={dataAgendamento}
                onChange={e => setDataAgendamento(e.target.value)}
                disabled={loading}
                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5 text-gray-400" />
                Obs. Qualificação <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                disabled={loading}
                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Etapa do funil */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-indigo-400" />
              Etapa do funil <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={etapaId}
              onChange={e => setEtapaId(e.target.value)}
              disabled={loading || etapas.length === 0}
              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            >
              <option value="">Selecione uma etapa...</option>
              {etapas.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" />Criar Lead</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

