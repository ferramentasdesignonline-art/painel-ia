'use client';

import { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageCircle, 
  Phone,
  Car,
  Clock,
  RefreshCw,
  Users,
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type Lead = {
  id: number | string;
  nome: string | null;
  telefone: string;
  veiculo_interessado?: string;
  vendedor_lead?: string | null;
  origem: 'ia' | 'manual';
  bloqueado: boolean;
  movido_manualmente: boolean;
  created_at: string;
  ultima_mensagem?: string;
  quantidade_followup?: number;
  data_agendamento?: string | null;
  observacao_lead_qualificado?: string | null;
  horario_lead_qualificado?: string | null;
  lead_finalizado?: boolean;
};

type Props = {
  lead: Lead;
  colunaAtualId: string;
  todasColunas: any[];
  onClick: () => void;
  onMover: (paraEtapaId: string) => void;
  formatarTelefone: (tel: string) => string;
  metaFollowup: number;
  nomeEtapa: string;
  isDragOverlay?: boolean;
};

export function LeadCard({ lead, onClick, formatarTelefone, metaFollowup, nomeEtapa, isDragOverlay }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id.toString(),
    data: { lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const iniciais = lead.nome
    ? lead.nome.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const formattedDate = useMemo(() => {
    try {
      if (!lead.created_at) return '';
      const date = new Date(lead.created_at);
      if (isNaN(date.getTime())) return '';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}, ${hours}:${minutes}`;
    } catch {
      return '';
    }
  }, [lead.created_at]);

  const colors = [
    'bg-blue-100 text-blue-600',
    'bg-purple-100 text-purple-600',
    'bg-emerald-100 text-emerald-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
    'bg-indigo-100 text-indigo-600'
  ];
  const colorIndex = (lead.nome?.length || 0) % colors.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group bg-white rounded-xl border border-gray-100 p-3.5 transition-all duration-200 hover:shadow-md hover:border-indigo-200 cursor-pointer relative",
        lead.bloqueado && "opacity-70",
        isDragging && "opacity-40 scale-95",
        isDragOverlay && "shadow-2xl rotate-1 scale-105 border-indigo-300 cursor-grabbing ring-2 ring-indigo-200"
      )}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0",
          colors[colorIndex]
        )}>
          {iniciais}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* Nome */}
          <h4 className="text-[14px] font-bold text-gray-800 truncate leading-tight pr-5">
            {lead.nome || 'Visitante'}
          </h4>

          {/* Carro */}
          <div className="flex items-center gap-1.5 text-gray-500">
            <Car className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[12px] font-medium truncate">
              {lead.veiculo_interessado || 'Nenhum interessado'}
            </span>
          </div>

          {/* Pills Labels */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {lead.origem === 'ia' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100/50">
                <BotIcon className="w-2.5 h-2.5 text-indigo-500" />
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">IA ativa</span>
              </div>
            )}
            {lead.origem === 'manual' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100/50">
                <Users className="w-2.5 h-2.5 text-blue-500" />
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Manual</span>
              </div>
            )}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100">
              <Phone className="w-2.5 h-2.5 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                {formatarTelefone(lead.telefone)}
              </span>
            </div>
          </div>

          {/* Barra de Progresso de Follow-up */}
          {(lead.quantidade_followup && lead.quantidade_followup > 0) ? (
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                <div className="flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5 text-blue-400" />
                  <span>{lead.quantidade_followup} de {metaFollowup} follow-ups</span>
                </div>
                <span>{Math.min(Math.round((lead.quantidade_followup / metaFollowup) * 100), 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    (lead.quantidade_followup / metaFollowup) >= 1 ? "bg-green-500" : "bg-blue-500"
                  )}
                  style={{ width: `${Math.min((lead.quantidade_followup / metaFollowup) * 100, 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
            <span className="text-[11px] font-medium text-gray-400">
              {formattedDate}
            </span>
            <div className="flex items-center gap-2.5">
              <MessageCircle className="w-4 h-4 text-gray-300" />
              <PhoneIcon className="w-4 h-4 text-orange-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BotIcon(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
  );
}

function PhoneIcon(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
