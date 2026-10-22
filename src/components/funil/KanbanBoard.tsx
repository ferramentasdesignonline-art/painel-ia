'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { Lead, LeadCard } from './LeadCard';
import { NovoLeadModal } from './NovoLeadModal';
import { LeadDrawer, LeadType } from '@/components/leads/LeadDrawer';
import { 
  Trophy, 
  Plus, 
  Search, 
  RefreshCw,
  Settings,
  Tag,
  Check,
  ChevronDown,
  Megaphone,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChannelIcon } from '@/components/common/ChannelIcon';
import Link from 'next/link';
import { 
  DndContext, 
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  UniqueIdentifier
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

type Coluna = {
  id: string;
  nome: string;
  cor: string;
  tipo: string;
  ordem: number;
  leads: Lead[];
};

export function KanbanBoard() {
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [nomeFunil, setNomeFunil] = useState('Funil de Leads');
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState('30d');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [canaisFiltro, setCanaisFiltro] = useState<string[]>([]);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [canaisMenuAberto, setCanaisMenuAberto] = useState(false);
  const [tagsMenuAberto, setTagsMenuAberto] = useState(false);
  const canaisDropdownRef = useRef<HTMLDivElement>(null);
  const tagsDropdownRef = useRef<HTMLDivElement>(null);
  const [novoLeadAberto, setNovoLeadAberto] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState<LeadType | null>(null);
  const [colunaPreId, setColunaPreId] = useState<string | undefined>();
  const [config, setConfig] = useState<{ meta_followup: number; tipo_atendimento?: string }>({ meta_followup: 5 });

  // DnD state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);
  const initialContainer = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const carregarFunil = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      let url = `/api/funil/leads?periodo=${periodo}`;
      if (dataInicio && dataFim) {
        url += `&dataInicio=${new Date(dataInicio).toISOString()}&dataFim=${new Date(dataFim + 'T23:59:59').toISOString()}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.colunas) {
        setColunas(data.colunas);
      }
      if (data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
      }
      const resFunil = await fetch('/api/funil');
      const dataFunil = await resFunil.json();
      if (dataFunil.funil) {
        setNomeFunil(dataFunil.funil.nome || 'Funil de Leads');
        setConfig(prev => ({ ...prev, meta_followup: dataFunil.funil.meta_followup || 5 }));
      }
    } catch (err) {
      console.error('Erro ao carregar funil:', err);
    } finally {
      setCarregando(false);
    }
  }, [periodo, dataInicio, dataFim]);

  useEffect(() => {
    carregarFunil();
    const interval = setInterval(() => carregarFunil(true), 120000);
    return () => clearInterval(interval);
  }, [carregarFunil]);

  // Fecha os dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (canaisDropdownRef.current && !canaisDropdownRef.current.contains(event.target as Node)) {
        setCanaisMenuAberto(false);
      }
      if (tagsDropdownRef.current && !tagsDropdownRef.current.contains(event.target as Node)) {
        setTagsMenuAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle multi-select canal
  const toggleCanalFiltro = (canalKey: string) => {
    setCanaisFiltro(prev => 
      prev.includes(canalKey) ? prev.filter(k => k !== canalKey) : [...prev, canalKey]
    );
  };

  // Toggle multi-select tag
  const toggleTagFiltro = (tagNome: string) => {
    const lower = tagNome.toLowerCase();
    setTagsFiltro(prev =>
      prev.some(t => t.toLowerCase() === lower)
        ? prev.filter(t => t.toLowerCase() !== lower)
        : [...prev, tagNome]
    );
  };

  // Dado um ID (lead ou coluna), retorna o ID da coluna que o contém
  const findContainer = useCallback((id: UniqueIdentifier): string | undefined => {
    const idStr = id.toString();
    // Verifica se é um ID de coluna direto
    if (colunas.some(col => col.id === idStr)) return idStr;
    // Procura em qual coluna está o lead
    for (const col of colunas) {
      if (col.leads.some(l => l.id.toString() === idStr)) return col.id;
    }
    return undefined;
  }, [colunas]);

  // Collision detection personalizada: prioriza containers (colunas)
  const collisionDetectionStrategy = useCallback((args: any) => {
    if (activeId && colunas.some(col => col.id === activeId.toString())) {
      return rectIntersection({ ...args });
    }

    const pointerCollisions = pointerWithin(args);
    const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);

    let overId = getFirstCollision(intersections, 'id');

    if (overId != null) {
      // Se o over é uma coluna, retorna ela
      if (colunas.some(col => col.id === overId?.toString())) {
        return intersections;
      }
      // Caso contrário, retorna a coluna que contém o item
      const containerCol = findContainer(overId!);
      if (containerCol) {
        lastOverId.current = containerCol;
        return [{ id: containerCol }];
      }
    }

    if (lastOverId.current) {
      return [{ id: lastOverId.current }];
    }
    return intersections;
  }, [activeId, colunas, findContainer]);

  async function moverLead(leadId: string, paraEtapaId: string) {
    // Pega o lead original para saber a origem (ia ou manual)
    let leadOriginal: Lead | undefined;
    for (const col of colunas) {
      const found = col.leads.find(l => l.id.toString() === leadId);
      if (found) {
        leadOriginal = found;
        break;
      }
    }

    if (!leadOriginal) return;

    const previousState = [...colunas];

    setColunas(prev => {
      let leadMovido: Lead | undefined;
      const novas = prev.map(col => {
        const idx = col.leads.findIndex(l => l.id.toString() === leadId);
        if (idx !== -1) {
          leadMovido = { ...col.leads[idx], movido_manualmente: true };
          return { ...col, leads: col.leads.filter(l => l.id.toString() !== leadId) };
        }
        return col;
      });
      if (leadMovido) {
        return novas.map(col => {
          if (col.id === paraEtapaId) {
            return { ...col, leads: [leadMovido!, ...col.leads] };
          }
          return col;
        });
      }
      return novas;
    });

    try {
      const realId = leadOriginal.id.toString().replace(/^(ia|manual)-/, '');
      
      const res = await fetch('/api/funil/leads/mover', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead_id: realId, 
          etapa_id: paraEtapaId, 
          origem: leadOriginal.origem 
        }),
      });
      if (!res.ok) throw new Error('Falha ao mover');
      const json = await res.json();
      if (json.whatsapp_labels) {
        setColunas(prev => prev.map(col => ({
          ...col,
          leads: col.leads.map(l => l.id.toString() === leadId ? { ...l, whatsapp_labels: json.whatsapp_labels } : l)
        })));
      }
    } catch (err) {
      console.error(err);
      setColunas(previousState);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id);
    const container = findContainer(active.id);
    if (container) {
      initialContainer.current = container;
    }
    // Encontra o lead sendo arrastado
    for (const col of colunas) {
      const lead = col.leads.find(l => l.id.toString() === active.id.toString());
      if (lead) { setActiveLead(lead); break; }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !active) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    // Achar o lead
    let leadOriginal: Lead | undefined;
    for (const col of colunas) {
      const found = col.leads.find(l => l.id.toString() === active.id.toString());
      if (found) {
        leadOriginal = found;
        break;
      }
    }



    // Mover lead entre colunas no estado local (sem chamar API ainda)
    setColunas(prev => {
      let leadMovido: Lead | undefined;
      const novas = prev.map(col => {
        const idx = col.leads.findIndex(l => l.id.toString() === active.id.toString());
        if (idx !== -1) {
          leadMovido = col.leads[idx];
          return { ...col, leads: col.leads.filter(l => l.id.toString() !== active.id.toString()) };
        }
        return col;
      });
      if (leadMovido) {
        recentlyMovedToNewContainer.current = true;
        return novas.map(col => {
          if (col.id === overContainer) {
            return { ...col, leads: [leadMovido!, ...col.leads] };
          }
          return col;
        });
      }
      return novas;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setActiveLead(null);
    lastOverId.current = null;

    if (!over) {
      initialContainer.current = null;
      return;
    }

    const overContainer = findContainer(over.id);
    if (!overContainer) {
      initialContainer.current = null;
      return;
    }

    // Se mudou de coluna usando o registro da coluna original local, persiste na API
    if (initialContainer.current && initialContainer.current !== overContainer) {
      moverLead(active.id.toString(), overContainer);
    }
    
    initialContainer.current = null;
  }

  const abrirNovoLead = (colId?: string) => {
    setColunaPreId(colId);
    setNovoLeadAberto(true);
  };

  const handleAbrirLead = (l: Lead, nomeEtapa: string) => {
    const formattedLead: LeadType = {
      id: l.id?.toString() || "",
      nome: l.nome || "Cliente",
      telefone: l.telefone || "",
      veiculo: l.veiculo_interessado || "",
      vendedor: l.vendedor_lead || "IA",
      status: nomeEtapa,
      origem: l.origem || "ia",
      ultimaMensagem: l.ultima_mensagem || "-",
      createdAt: l.created_at,
      ultimaMensagemTs: l.ultima_mensagem,
      quantidadeFollowup: l.quantidade_followup,
      leadFinalizado: l.lead_finalizado === true,
      vendedorLead: l.vendedor_lead || null,
      horarioLeadQualificado: l.horario_lead_qualificado || null,
      veiculoInteressado: l.veiculo_interessado || null,
      dataAgendamento: l.data_agendamento || null,
      data_agendamento_visita: (l as any).data_agendamento_visita || null,
      horario_agendamento_visita: (l as any).horario_agendamento_visita || null,
      dataAgendamentoVisita: (l as any).data_agendamento_visita || null,
      horarioAgendamentoVisita: (l as any).horario_agendamento_visita || null,
      observacaoLeadQualificado: l.observacao_lead_qualificado || null,
      email: (l as any).email || null,
      cpfCnpj: (l as any).cpf_cnpj || null,
      dataNascimento: (l as any).data_nascimento || null,
      veiculoTroca: (l as any).veiculo_troca || null,
      endereco: (l as any).endereço || null,
      possuiCnh: (l as any).possui_cnh,
      genero: (l as any).genero || null,
      tags: l.tags || [],
      canal_origem: l.canal_origem,
      canal_label_name: l.canal_label_name,
      canal_color: l.canal_color,
      anuncio_titulo: l.anuncio_titulo,
      anuncio_id: l.anuncio_id,
      anuncio_url: l.anuncio_url,
      origem_detalhe: l.origem_detalhe,
    };
    setLeadSelecionado(formattedLead);
  };

  const formatarTelefone = (tel?: string | null) => {
    if (!tel) return '-';
    let limpo = tel.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    if (!limpo) return tel.split('@')[0];
    if (limpo.startsWith('55')) limpo = limpo.slice(2);
    if (limpo.length === 11) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    if (limpo.length === 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return limpo;
  };

  // Métricas consolidadas por Canal de Atendimento
  const canaisMetrics = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; color?: string }>();
    let totalComCanal = 0;

    for (const col of colunas) {
      for (const lead of col.leads) {
        const canalKey = lead.canal_origem || 'desconhecido';
        const canalNome = lead.canal_label_name || (
          canalKey === 'facebook_ads' ? 'Facebook Ads' :
          canalKey === 'instagram_ads' ? 'Instagram Ads' :
          canalKey === 'meta_ads' ? 'Meta Ads' :
          canalKey === 'facebook_marketplace' ? 'Marketplace' :
          canalKey === 'mercado_livre' ? 'Mercado Livre' :
          canalKey === 'webmotors' ? 'WebMotors' :
          canalKey === 'olx' ? 'OLX' :
          canalKey === 'icarros' ? 'iCarros' :
          'Outros / Direto'
        );

        if (!map.has(canalKey)) {
          map.set(canalKey, {
            nome: canalNome,
            count: 0,
            color: lead.canal_color || undefined,
          });
        }
        map.get(canalKey)!.count += 1;
        totalComCanal += 1;
      }
    }

    const list = Array.from(map.entries()).map(([key, data]) => ({
      key,
      nome: data.nome,
      count: data.count,
      color: data.color,
    })).sort((a, b) => b.count - a.count);

    return { list, total: totalComCanal };
  }, [colunas]);

  // Lista de todas as tags ativas presentes nos leads (exceto canais)
  const tagsDisponiveis = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string; count: number }>();
    for (const col of colunas) {
      for (const lead of col.leads) {
        for (const tag of (lead.tags || [])) {
          if (!map.has(tag.nome)) {
            map.set(tag.nome, { nome: tag.nome, cor: tag.cor, count: 0 });
          }
          map.get(tag.nome)!.count += 1;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [colunas]);

  const colunasFiltradas = useMemo(() => {
    return colunas.map(col => ({
      ...col,
      leads: col.leads.filter(lead => {
        const matchesBusca = (lead.nome?.toLowerCase().includes(busca.toLowerCase()) || 
                             lead.veiculo_interessado?.toLowerCase().includes(busca.toLowerCase()));
        if (!matchesBusca) return false;

        // Filtro por Canais de Atendimento (se houver algum marcado, deve pertencer a um deles)
        if (canaisFiltro.length > 0) {
          const leadCanal = lead.canal_origem || 'desconhecido';
          if (!canaisFiltro.includes(leadCanal)) {
            return false;
          }
        }

        // Filtro por Etiquetas / Tags (se houver alguma marcada, o lead deve ter pelo menos uma das selecionadas)
        if (tagsFiltro.length > 0) {
          const leadTagNames = (lead.tags || []).map((t: any) => t.nome.toLowerCase());
          const matchQualquerTag = tagsFiltro.some(tf => leadTagNames.includes(tf.toLowerCase()));
          if (!matchQualquerTag) {
            return false;
          }
        }

        if (filtroAtivo === 'todos') return true;
        if (filtroAtivo === 'ia') return lead.origem === 'ia';
        if (filtroAtivo === 'manual') return lead.origem === 'manual';
        
        const dataLead = new Date(lead.created_at);
        const agora = new Date();
        
        if (filtroAtivo === 'hoje') {
          return dataLead.toDateString() === agora.toDateString();
        }
        if (filtroAtivo === 'semana') {
          const umaSemanaAtras = new Date();
          umaSemanaAtras.setDate(agora.getDate() - 7);
          return dataLead >= umaSemanaAtras;
        }
        return true;
      })
    }));
  }, [colunas, busca, filtroAtivo, canaisFiltro, tagsFiltro]);

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-190px)] min-h-[550px] space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[16px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-100 rotate-2 shrink-0">
            <Trophy className="w-4 h-4 text-white -rotate-2" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">{nomeFunil}</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Estratégia comercial</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1">Início</span>
            <input 
              type="date"
              className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1">Fim</span>
            <input 
              type="date"
              className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1">Atalho</span>
            <select 
              className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
              value={periodo}
              onChange={e => {
                setPeriodo(e.target.value);
                setDataInicio('');
                setDataFim('');
              }}
            >
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="90d">90 dias</option>
            </select>
          </div>
        </div>
      </div>

      {/* Barra de Ferramentas Minimalista (Filtros, Dropdowns de Canais e Etiquetas, Busca e Ações) */}
      <div className="mx-1 bg-white rounded-2xl border border-gray-100 p-2.5 flex flex-wrap items-center gap-3 shadow-xs">
        {/* Filtro Rápido de Período/Origem */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-gray-400 ml-1">Filtrar:</span>
          <div className="flex items-center gap-1">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'hoje', label: 'Hoje' },
              { id: 'semana', label: 'Semana' },
              { id: 'ia', label: 'IA' },
              { id: 'manual', label: 'Manual' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroAtivo(f.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-bold transition-all border",
                  filtroAtivo === f.id 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-2xs" 
                    : "bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Botão Dropdown Minimalista: Canais de Atendimento */}
        {canaisMetrics.list.length > 0 && (
          <div className="relative" ref={canaisDropdownRef}>
            <button
              onClick={() => {
                setCanaisMenuAberto(prev => !prev);
                setTagsMenuAberto(false);
              }}
              className={cn(
                "flex items-center gap-2 px-3 h-9 rounded-xl border text-xs font-bold transition-all select-none",
                canaisFiltro.length > 0
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                  : "bg-gray-50/70 border-gray-100 text-gray-600 hover:bg-gray-100/70 hover:border-gray-200"
              )}
            >
              <Megaphone className="w-3.5 h-3.5 text-indigo-500" />
              <span>Canais</span>
              {canaisFiltro.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                  {canaisFiltro.length}
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 font-normal">({canaisMetrics.list.length})</span>
              )}
              <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", canaisMenuAberto && "rotate-180")} />
            </button>

            {/* Menu Popover Flutuante de Canais */}
            {canaisMenuAberto && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-2 py-1 border-b border-gray-50">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Canais de Atendimento</span>
                  {canaisFiltro.length > 0 && (
                    <button
                      onClick={() => setCanaisFiltro([])}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {canaisMetrics.list.map(c => {
                    const isChecked = canaisFiltro.includes(c.key);
                    return (
                      <div
                        key={c.key}
                        onClick={() => toggleCanalFiltro(c.key)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-xl text-xs font-semibold cursor-pointer transition-all select-none",
                          isChecked ? "bg-indigo-50/80 text-indigo-900" : "hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0",
                              isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 bg-white"
                            )}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          <ChannelIcon canal={c.key} label={c.nome} className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{c.nome}</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 ml-2 shrink-0">{c.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão Dropdown Minimalista: Etiquetas do WhatsApp & Estágios */}
        {tagsDisponiveis.length > 0 && (
          <div className="relative" ref={tagsDropdownRef}>
            <button
              onClick={() => {
                setTagsMenuAberto(prev => !prev);
                setCanaisMenuAberto(false);
              }}
              className={cn(
                "flex items-center gap-2 px-3 h-9 rounded-xl border text-xs font-bold transition-all select-none",
                tagsFiltro.length > 0
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                  : "bg-gray-50/70 border-gray-100 text-gray-600 hover:bg-gray-100/70 hover:border-gray-200"
              )}
            >
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              <span>Etiquetas</span>
              {tagsFiltro.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                  {tagsFiltro.length}
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 font-normal">({tagsDisponiveis.length})</span>
              )}
              <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", tagsMenuAberto && "rotate-180")} />
            </button>

            {/* Menu Popover Flutuante de Etiquetas */}
            {tagsMenuAberto && (
              <div className="absolute top-full left-0 mt-1.5 w-72 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-2 py-1 border-b border-gray-50">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Etiquetas & Estágios</span>
                  {tagsFiltro.length > 0 && (
                    <button
                      onClick={() => setTagsFiltro([])}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {tagsDisponiveis.map(t => {
                    const isChecked = tagsFiltro.some(tf => tf.toLowerCase() === t.nome.toLowerCase());
                    const isHex = t.cor?.startsWith('#');
                    return (
                      <div
                        key={t.nome}
                        onClick={() => toggleTagFiltro(t.nome)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-xl text-xs font-semibold cursor-pointer transition-all select-none",
                          isChecked ? "bg-indigo-50/80 text-indigo-900" : "hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0",
                              isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 bg-white"
                            )}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: isHex ? t.cor : '#6366f1' }}
                          />
                          <span className="truncate">{t.nome}</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 ml-2 shrink-0">{t.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-[200px] relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar por nome ou carro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-gray-50/50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-[12px] font-semibold focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 pr-1">
          <button 
            onClick={() => carregarFunil()}
            disabled={carregando}
            className="p-2.5 bg-gray-50 hover:bg-white border border-transparent hover:border-gray-100 rounded-xl text-gray-400 hover:text-indigo-600 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", carregando && "animate-spin")} />
          </button>
          
          <Link
            href="/funil/configurar"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 hover:border-indigo-200 rounded-xl text-[12px] font-bold text-gray-500 hover:text-indigo-600 transition-all shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            Ajustes
          </Link>

          <button 
            onClick={() => setNovoLeadAberto(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[12px] font-black text-white shadow-lg shadow-indigo-100 transition-all uppercase tracking-tighter"
          >
            <Plus className="w-4 h-4" />
            Novo
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="relative flex-1 overflow-hidden">
        {carregando && colunas.length === 0 ? (
          <div className="flex h-full gap-4 overflow-x-auto pb-4 px-1">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-[300px] h-full bg-gray-50 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="h-full flex gap-4 overflow-x-auto pb-6 px-1 custom-scrollbar">
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetectionStrategy}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {colunasFiltradas.map(col => (
                <KanbanColumn 
                  key={col.id} 
                  coluna={col}
                  todasColunas={colunas}
                  onAbrirLead={(lead) => handleAbrirLead(lead, col.nome)}
                  onMoverLead={(leadId, paraId) => moverLead(leadId, paraId)}
                  onAdicionarLead={abrirNovoLead}
                  formatarTelefone={formatarTelefone}
                  metaFollowup={config.meta_followup}
                />
              ))}

              <DragOverlay dropAnimation={{
                duration: 200,
                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
              }}>
                {activeId && activeLead ? (
                  <LeadCard
                    lead={activeLead}
                    colunaAtualId=""
                    todasColunas={colunas}
                    onClick={() => {}}
                    onMover={() => {}}
                    formatarTelefone={formatarTelefone}
                    metaFollowup={config.meta_followup}
                    nomeEtapa=""
                    isDragOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
            <div className="w-px h-1 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Modal de Novo Lead */}
      {novoLeadAberto && (
        <NovoLeadModal 
          colunas={colunas}
          onFechar={() => setNovoLeadAberto(false)}
          onSalvar={() => carregarFunil(true)}
          colunaPreSelecionadaId={colunaPreId}
        />
      )}

      {/* Drawer de Detalhes */}
      <LeadDrawer 
        lead={leadSelecionado}
        isOpen={!!leadSelecionado}
        onClose={() => {
          setLeadSelecionado(null)
          carregarDados()
        }}
        isSemIA={config.tipo_atendimento === 'sem_ia'}
        onLeadUpdated={(leadId, updates) => {
          setColunas(prev => prev.map(col => ({
            ...col,
            leads: col.leads.map(l => (l.id === leadId || String(l.original_id) === String(leadId)) ? { ...l, ...updates } : l)
          })))
          if (leadSelecionado && (leadSelecionado.id === leadId || String(leadSelecionado.original_id) === String(leadId))) {
            setLeadSelecionado((prev: any) => prev ? { ...prev, ...updates } : null)
          }
        }}
      />
    </div>
  );
}
