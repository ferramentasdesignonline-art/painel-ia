'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  ArrowLeft, 
  GripVertical, 
  Save, 
  Loader2,
  Bot,
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

function SortableEtapa({ etapa, onExcluir, onAtualizar }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: etapa.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  const isIA = etapa.tipo?.startsWith('ia_');

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-transparent transition-all",
        isDragging ? "opacity-50 shadow-2xl bg-white border-indigo-200" : "hover:bg-white hover:shadow-xl hover:shadow-gray-500/5 hover:border-gray-100",
        isIA && "border-l-4 border-l-indigo-400"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab p-1 text-gray-300 group-hover:text-gray-400">
        <GripVertical className="w-4 h-4" />
      </div>
      
      <input 
        type="color" 
        value={etapa.cor}
        onChange={(e) => onAtualizar(etapa.id, etapa.nome, e.target.value)}
        className="w-8 h-8 rounded-xl cursor-pointer border-none bg-transparent shrink-0"
      />

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input 
          type="text"
          value={etapa.nome}
          onChange={(e) => onAtualizar(etapa.id, e.target.value, etapa.cor)}
          className="flex-1 bg-transparent border-none font-bold text-gray-700 text-sm focus:outline-none"
        />
        {isIA && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 rounded-md shrink-0">
            <Lock className="w-2.5 h-2.5 text-indigo-400" />
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Fixo pela IA</span>
          </div>
        )}
      </div>

      {!isIA ? (
        <button 
          onClick={() => onExcluir(etapa.id)}
          className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <div className="p-2 opacity-0 group-hover:opacity-100">
           <Bot className="w-4 h-4 text-indigo-200" />
        </div>
      )}
    </div>
  );
}

export default function ConfigurarFunilPage() {
  const [etapas, setEtapas] = useState<any[]>([]);
  const [nomeFunil, setNomeFunil] = useState('Funil Principal');
  const [metaFollowup, setMetaFollowup] = useState(3);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState('#6366f1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedConfig, setSavedConfig] = useState(false);

  useEffect(() => {
    fetchDados();
  }, []);

  async function fetchDados() {
    setLoading(true);
    try {
      const resEtapas = await fetch('/api/funil/etapas');
      const dataEtapas = await resEtapas.json();
      setEtapas(dataEtapas.etapas || []);

      const resFunil = await fetch('/api/funil');
      const dataFunil = await resFunil.json();
      if (dataFunil.funil) {
        setNomeFunil(dataFunil.funil.nome || 'Funil Principal');
        setMetaFollowup(dataFunil.funil.meta_followup || 3);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function adicionarEtapa() {
    if (!novoNome.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/funil/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome, cor: novaCor }),
      });
      const body = await res.json();
      if (!res.ok || !body.etapa) {
        console.error('Erro ao adicionar etapa:', body);
        alert(`Erro ao criar etapa: ${body.error || 'resposta inesperada da API'}`);
        return;
      }
      setEtapas(prev => [...prev, body.etapa]);
      setNovoNome('');
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao criar etapa.');
    } finally {
      setSaving(false);
    }
  }

  async function excluirEtapa(id: string) {
    if (!confirm('Deseja realmente excluir esta etapa? Leads manuais nela serão movidos para a anterior.')) return;
    
    try {
      await fetch(`/api/funil/etapas/${id}`, { method: 'DELETE' });
      setEtapas(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  function atualizarEtapaLocal(id: string, nome: string, cor: string) {
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, nome, cor } : e));
    // Salva silenciosamente no banco
    fetch(`/api/funil/etapas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, cor }),
    }).catch(console.error);
  }

  async function salvarConfiguracoes() {
    setSavingConfig(true);
    try {
      await fetch('/api/funil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeFunil, meta_followup: metaFollowup }),
      });
      setSavedConfig(true);
      setTimeout(() => setSavedConfig(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = etapas.findIndex(e => e.id === active.id);
      const newIndex = etapas.findIndex(e => e.id === over.id);
      
      const newEtapas = arrayMove(etapas, oldIndex, newIndex);
      const orderedEtapas = newEtapas.map((e, idx) => ({ ...e, ordem: idx + 1 }));
      setEtapas(orderedEtapas);

      try {
        await fetch('/api/funil/etapas/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ etapas: orderedEtapas.map(e => ({ id: e.id, ordem: e.ordem })) }),
        });
      } catch (err) {
        console.error('Erro ao salvar ordem:', err);
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-poppins pb-20">
      {/* Header com botões */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/funil"
            className="p-2.5 hover:bg-white rounded-2xl text-gray-400 hover:text-gray-900 transition-all border border-transparent hover:border-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <input
              type="text"
              value={nomeFunil}
              onChange={(e) => setNomeFunil(e.target.value)}
              className="text-2xl font-black text-gray-900 tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-2 -ml-2"
              placeholder="Nome do Funil"
            />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Configure todas as etapas em uma única lista</p>
          </div>
        </div>
        <button
          onClick={salvarConfiguracoes}
          disabled={savingConfig}
          className="flex items-center gap-2.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 hover:-translate-y-0.5"
        >
          {savingConfig ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : savedConfig ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {savedConfig ? 'Salvo!' : 'Salvar tudo'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar de Configurações Gerais */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-amber-50/50 border border-amber-100/50 rounded-[24px] p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Meta Global</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest block mb-1.5 opacity-60">
                   Follow-ups por Lead
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    value={metaFollowup}
                    onChange={(e) => setMetaFollowup(parseInt(e.target.value) || 1)}
                    className="w-full h-10 bg-white border border-amber-200 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <p className="text-[9px] text-amber-700 mt-2 font-medium leading-tight">
                  A barra de progresso no Kanban se baseará neste número.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-[24px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-indigo-400" />
              <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Sobre as Etapas</h3>
            </div>
            <p className="text-[10px] text-indigo-900/50 font-medium leading-relaxed">
              Arraste as etapas para mudar a ordem visual no Kanban. Etapas marcadas com ícone de cadeado são essenciais para a IA.
            </p>
          </div>
        </div>

        {/* Lista Unificada de Etapas */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Estrutura do Funil</h2>
              <span className="bg-gray-100 text-[10px] font-black text-gray-400 px-3 py-1 rounded-full uppercase tracking-tighter">
                {etapas.length} Etapas no total
              </span>
            </div>

            <div className="space-y-3 mb-8">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-200" />
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Carregando etapas...</p>
                </div>
              ) : etapas.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-3xl">
                  <p className="text-sm font-bold text-gray-300">Nenhuma etapa encontrada.</p>
                </div>
              ) : (
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={etapas.map(e => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {etapas.map((etapa) => (
                        <SortableEtapa 
                          key={etapa.id} 
                          etapa={etapa} 
                          onExcluir={excluirEtapa}
                          onAtualizar={atualizarEtapaLocal}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Nova Etapa Form */}
            <div className="pt-8 border-t border-gray-100">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Adicionar Etapa Manual</h3>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={novaCor}
                  onChange={(e) => setNovaCor(e.target.value)}
                  className="w-12 h-12 rounded-2xl cursor-pointer border-2 border-gray-100 hover:border-indigo-200 transition-all bg-transparent p-1 shadow-sm"
                />
                <div className="flex-1 relative">
                  <input 
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && adicionarEtapa()}
                    placeholder="Ex: Visita Agendada, Em Negociação..."
                    className="w-full h-12 px-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                  />
                </div>
                <button 
                  onClick={adicionarEtapa}
                  disabled={saving || !novoNome.trim()}
                  className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  ADICIONAR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
