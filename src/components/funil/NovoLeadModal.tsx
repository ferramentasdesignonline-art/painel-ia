'use client';

import { useState } from 'react';
import { X, User, Phone, Car, Tag, StickyNote, Loader2, Calendar } from 'lucide-react';

type Props = {
  colunas: any[];
  onFechar: () => void;
  onSalvar: () => void;
  colunaPreSelecionadaId?: string;
};

export function NovoLeadModal({ colunas, onFechar, onSalvar, colunaPreSelecionadaId }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    veiculo_interessado: '',
    vendedor: '',
    notas: '',
    data_agendamento: '',
    observacao_lead_qualificado: '',
    etapa_id: colunaPreSelecionadaId || colunas[0]?.id || '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/funil/leads/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          data_agendamento: formData.data_agendamento ? new Date(formData.data_agendamento).toISOString() : null,
          observacao_lead_qualificado: formData.observacao_lead_qualificado || null,
        }),
      });

      if (res.ok) {
        onSalvar();
        onFechar();
      } else {
        const error = await res.json();
        alert('Erro ao salvar lead: ' + (error.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onFechar} 
      />
      
      <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Novo Lead Manual</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Captura direta do vendedor</p>
          </div>
          <button 
            onClick={onFechar}
            className="p-2 hover:bg-white rounded-2xl text-gray-400 hover:text-gray-900 transition-all border border-transparent hover:border-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nome completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Carlos Alberto"
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-indigo-400/50 focus:ring-[4px] focus:ring-indigo-500/5 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formData.telefone}
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length > 11) v = v.slice(0, 11);
                    if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
                    if (v.length > 10) v = `${v.slice(0,10)}-${v.slice(10)}`;
                    setFormData({ ...formData, telefone: v });
                  }}
                  placeholder="Ex: (11) 99999-9999"
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-indigo-400/50 focus:ring-[4px] focus:ring-indigo-500/5 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Veículo de Interesse</label>
              <div className="relative">
                <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.veiculo_interessado}
                  onChange={e => setFormData({ ...formData, veiculo_interessado: e.target.value })}
                  placeholder="Ex: Honda Civic 2021"
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-indigo-400/50 focus:ring-[4px] focus:ring-indigo-500/5 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Etapa do Funil</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  required
                  value={formData.etapa_id}
                  onChange={e => setFormData({ ...formData, etapa_id: e.target.value })}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-indigo-400/50 focus:ring-[4px] focus:ring-indigo-500/5 transition-all outline-none appearance-none font-semibold text-gray-700"
                >
                  <option value="" disabled>Selecione uma etapa</option>
                  {colunas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Notas e Observações</label>
            <div className="relative">
              <StickyNote className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
              <textarea
                value={formData.notas}
                onChange={e => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Detalhes sobre a conversa, proposta enviada..."
                rows={3}
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-indigo-400/50 focus:ring-[4px] focus:ring-indigo-500/5 transition-all outline-none resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Data/Hora Agendamento</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="datetime-local"
                  value={formData.data_agendamento}
                  onChange={e => setFormData({ ...formData, data_agendamento: e.target.value })}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-indigo-400/50 focus:ring-[4px] focus:ring-indigo-500/5 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Obs. Qualificação</label>
              <div className="relative">
                <StickyNote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.observacao_lead_qualificado}
                  onChange={e => setFormData({ ...formData, observacao_lead_qualificado: e.target.value })}
                  placeholder="Se houver agendamento..."
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:bg-white focus:border-indigo-400/50 focus:ring-[4px] focus:ring-indigo-500/5 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 py-4 px-6 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-colors uppercase text-xs tracking-widest"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
