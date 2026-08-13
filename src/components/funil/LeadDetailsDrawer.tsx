'use client';

import { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Lead } from './LeadCard';
import { 
  User, 
  Phone, 
  Car, 
  Clock, 
  MessageSquare, 
  StickyNote, 
  Calendar,
  Send,
  Loader2,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Props = {
  lead: Lead | null;
  aberto: boolean;
  onFechar: () => void;
  onAtualizar: () => void;
};

export function LeadDetailsDrawer({ lead, aberto, onFechar, onAtualizar }: Props) {
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (lead) {
      // Aqui poderíamos buscar notas salvas no banco
      // Por enquanto, usaremos as notas que já vem no lead manual se houver
      setNotas((lead as any).notas || '');
    }
  }, [lead]);

  if (!lead) return null;

  async function salvarNotas() {
    if (!lead) return;
    setSalvando(true);
    try {
      // Implementar API de atualização de notas se necessário
      // Por enquanto, vamos simular ou atualizar via API de lead manual
      const res = await fetch('/api/funil/leads/manual/atualizar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, notas, origem: lead.origem }),
      });
      
      if (res.ok) {
        onAtualizar();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  const dataFormatada = format(new Date(lead.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  return (
    <Sheet open={aberto} onOpenChange={onFechar}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg border-l-0 sm:border-l border-gray-100 shadow-2xl p-0 flex flex-col gap-0">
        {/* Header Premium */}
        <div className="bg-gradient-to-br from-gray-900 to-indigo-950 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center text-xl font-black border border-white/20">
              {lead.nome?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{lead.nome || 'Lead s/ Nome'}</h2>
              <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-widest mt-1">
                {lead.origem === 'ia' ? '⚡ Identificado por IA' : '👤 Cadastro Manual'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {/* Informações de Contato */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <Phone className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Telefone</span>
              </div>
              <p className="text-sm font-bold text-gray-700">{lead.telefone}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Entrada</span>
              </div>
              <p className="text-sm font-bold text-gray-700">{format(new Date(lead.created_at), 'dd/MM/yy HH:mm')}</p>
            </div>
          </div>

          {/* Destaque do Veículo */}
          <div className="bg-white p-6 rounded-[32px] border-2 border-indigo-50 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Car className="w-16 h-16 text-indigo-600" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Interesse Comercial</span>
            </div>
            <h3 className="text-xl font-black text-gray-900 leading-tight">
              {lead.veiculo_interessado || 'Nenhum veículo vinculado'}
            </h3>
          </div>

          {/* Seção de Notas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-gray-900">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black uppercase tracking-tight">Anotações Internas</h3>
              </div>
              {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
            </div>
            <div className="relative">
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                onBlur={salvarNotas}
                placeholder="Adicione detalhes sobre a negociação, propostas ou observações do cliente..."
                className="w-full bg-amber-50/30 border border-amber-100/50 rounded-[28px] p-6 text-sm font-medium text-gray-700 focus:outline-none focus:ring-4 focus:ring-amber-500/5 focus:bg-white transition-all min-h-[160px] leading-relaxed"
              />
            </div>
          </div>

          {/* Histórico Simples */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2 text-gray-900">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-black uppercase tracking-tight">Última Interação</h3>
            </div>
            {lead.ultima_mensagem ? (
              <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                <p className="text-sm text-gray-600 italic leading-relaxed">
                  "{lead.ultima_mensagem}"
                </p>
                <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                  <span>Mensagem recebida</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {dataFormatada}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[11px] font-bold uppercase tracking-widest">Sem mensagens registradas</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer com Botão WhatsApp */}
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <button 
            onClick={() => window.open(`https://wa.me/${lead.telefone.replace(/\D/g, '')}`, '_blank')}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3"
          >
            <MessageSquare className="w-4 h-4" />
            Continuar no WhatsApp
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
