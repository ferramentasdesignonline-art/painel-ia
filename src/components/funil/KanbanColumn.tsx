'use client';

import { Lead, LeadCard } from './LeadCard';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  coluna: {
    id: string;
    nome: string;
    cor: string;
    tipo: string;
    leads: Lead[];
  };
  todasColunas: any[];
  onAbrirLead: (lead: Lead) => void;
  onMoverLead: (leadId: string, paraEtapaId: string) => void;
  onAdicionarLead: (colunaId: string) => void;
  formatarTelefone: (tel: string) => string;
  metaFollowup: number;
};

export function KanbanColumn({ 
  coluna, 
  todasColunas, 
  onAbrirLead, 
  onMoverLead, 
  onAdicionarLead,
  formatarTelefone,
  metaFollowup
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: coluna.id,
  });

  return (
    <div className="flex flex-col w-[350px] shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: coluna.cor }} 
          />
          <h3 className="text-[14px] font-black text-gray-800 tracking-tight uppercase">
            {coluna.nome}
          </h3>
          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {coluna.leads.length}
          </span>
        </div>
        {coluna.tipo.startsWith('ia_') && (
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tighter">
            automático IA
          </span>
        )}
      </div>

      {/* Lista de Leads — área droppable */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 flex flex-col gap-3 p-3 rounded-2xl border overflow-y-auto custom-scrollbar max-h-full transition-colors duration-150",
          isOver
            ? "bg-indigo-50/60 border-indigo-200 border-dashed"
            : "bg-gray-50/50 border-gray-100/50 hover:bg-gray-100/50"
        )}
      >
        <SortableContext
          items={coluna.leads.map(l => l.id.toString())}
          strategy={verticalListSortingStrategy}
        >
          {coluna.leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              colunaAtualId={coluna.id}
              todasColunas={todasColunas}
              onClick={() => onAbrirLead(lead)}
              onMover={(paraId) => onMoverLead(lead.id.toString(), paraId)}
              formatarTelefone={formatarTelefone}
              metaFollowup={metaFollowup}
              nomeEtapa={coluna.nome}
            />
          ))}
        </SortableContext>

        {/* Mensagem quando a coluna está vazia e sendo hovered */}
        {isOver && coluna.leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Solte aqui</p>
          </div>
        )}

        {/* Botão Adicionar Lead */}
        <button
          onClick={() => onAdicionarLead(coluna.id)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-[12px] font-bold text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-white transition-all flex items-center justify-center gap-2 group mt-2"
        >
          <div className="w-5 h-5 rounded-full bg-gray-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
            <Plus className="w-3 h-3" />
          </div>
          Adicionar lead
        </button>
      </div>
    </div>
  );
}
