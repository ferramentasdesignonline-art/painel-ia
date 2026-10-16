"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles, RefreshCw, Flame, AlertTriangle, TrendingUp, Car, Phone, MessageSquare,
  Clock, ShieldAlert, CheckCircle2, Copy, Check, Lightbulb, Quote, User, ChevronRight,
} from "lucide-react"
import { LeadDrawer, LeadType } from "@/components/leads/LeadDrawer"

function toLeadType(lead: any, fallback: any): LeadType {
  const l = lead || {}
  return {
    id: l.id?.toString() || "",
    nome: l.nome || fallback.nome || "Cliente",
    telefone: l.telefone || l.phone || String(fallback.telefone || "").split("@")[0],
    veiculo: l.veiculo_interessado || fallback.veiculo || "",
    vendedor: l.vendedor_lead || "IA",
    status: l.lead_finalizado ? "Finalizado" : l.data_agendamento ? "Agendado" : "Em atendimento",
    origem: l.origem || "ia",
    ultimaMensagem: l.ultima_mensagem || "-",
    createdAt: l.created_at,
    ultimaMensagemTs: l.ultima_mensagem,
    quantidadeFollowup: l.quantidade_followup,
    leadFinalizado: l.lead_finalizado === true,
    vendedorLead: l.vendedor_lead || null,
    horarioLeadQualificado: l.horario_lead_qualificado || null,
    veiculoInteressado: l.veiculo_interessado || fallback.veiculo || null,
    dataAgendamento: l.data_agendamento || null,
    observacaoLeadQualificado: l.observacao_lead_qualificado || null,
    email: l.email || null,
    cpfCnpj: l.cpf_cnpj || null,
    dataNascimento: l.data_nascimento || null,
    veiculoTroca: l.veiculo_troca || null,
    endereco: l["endereço"] || l.endereco || null,
    possuiCnh: l.possui_cnh,
    genero: l.genero || null,
    tags: l.tags || [],
    canal_origem: l.canal_origem,
    canal_label_name: l.canal_label_name,
    canal_color: l.canal_color,
    anuncio_titulo: l.anuncio_titulo,
    anuncio_id: l.anuncio_id,
    anuncio_url: l.anuncio_url,
    origem_detalhe: l.origem_detalhe,
  }
}

function Exemplos({ exemplos, onOpen }: { exemplos: any[]; onOpen: (tel: string, nome: string) => void }) {
  if (!exemplos?.length) return null
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exemplos reais ({exemplos.length})</p>
      {exemplos.map((ex: any, i: number) => (
        <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-bold text-gray-800 flex items-center gap-1"><User className="w-3 h-3" />{ex.cliente || "Cliente"}</span>
            {ex.telefone && (
              <button onClick={() => onOpen(ex.telefone, ex.cliente)} className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer">
                Abrir conversa <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {ex.trecho && <p className="text-xs text-gray-700 italic flex gap-1.5"><Quote className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" />{ex.trecho}</p>}
          {ex.problema && <p className="text-[11px] text-red-700 mt-1">{ex.problema}</p>}
        </div>
      ))}
    </div>
  )
}

export default function AnaliseIaPage() {
  const router = useRouter()
  const [analise, setAnalise] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'oportunidades' | 'canais' | 'atritos' | 'estoque'>('oportunidades')
  const [selectedLead, setSelectedLead] = useState<LeadType | null>(null)

  const fetchUltimaAnalise = async () => {
    try {
      const res = await fetch('/api/analise-ia', { cache: 'no-store' })
      const data = await res.json()
      if (data.analise) setAnalise(data.analise)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGerarAnalise = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/analise-ia', { method: 'POST' })
      const text = await res.text()
      let data: any = {}
      try { data = JSON.parse(text) } catch { throw new Error(res.status === 504 ? "Tempo limite excedido no servidor. Tente novamente." : text.slice(0, 200)) }
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar análise')
      if (data.analise) setAnalise(data.analise)
    } catch (err: any) {
      alert("Erro ao processar Análise com IA: " + err.message)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => { fetchUltimaAnalise() }, [])

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2500)
  }

  const abrirWhatsAppWeb = (tel: string, nome?: string, msg?: string) => {
    const p = new URLSearchParams({ tel: String(tel).split('@')[0].replace(/\D/g, '') })
    if (nome) p.set('nome', nome)
    if (msg) p.set('msg', msg)
    router.push(`/whatsapp-web?${p.toString()}`)
  }

  const m = analise?.metricas || {}
  const tabBtn = (key: typeof activeTab, icon: any, label: string, count: number) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
    >
      {icon}{label} ({count})
    </button>
  )

  const qualidadeCls = (q?: string) => {
    const v = (q || '').toLowerCase()
    return v === 'alta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : v.startsWith('m') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
  }

  return (
    <div className="space-y-6 pb-12 font-poppins max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">Análise com Inteligência Artificial</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">Auditoria completa de todas as conversas do WhatsApp, leads quentes e diagnóstico de tráfego.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {analise?.created_at && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(analise.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleGerarAnalise}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? "Analisando todas as conversas..." : "Atualizar Análise"}
          </button>
        </div>
      </div>

      {generating && (
        <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
          Estamos lendo todas as conversas. Isso pode levar de 1 a 4 minutos, dependendo do volume. Não feche a página.
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-gray-100 p-8">
          <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs font-bold text-gray-600">Carregando relatório...</p>
        </div>
      ) : !analise ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Sparkles className="w-8 h-8 text-indigo-600 mb-3" />
          <h3 className="text-base font-bold text-gray-900">Nenhuma análise gerada ainda</h3>
          <p className="text-xs text-gray-500 mt-1">Clique em "Atualizar Análise" para gerar o primeiro relatório.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <Flame className="w-6 h-6" />, cls: 'bg-amber-50 text-amber-600', label: 'Temperatura', value: m.temperatura_geral || '-', sub: m.quentes != null ? `${m.quentes} quentes · ${m.mornas} mornas · ${m.frias} frias` : 'Momento atual dos leads' },
              { icon: <TrendingUp className="w-6 h-6" />, cls: 'bg-emerald-50 text-emerald-600', label: 'Score Qualidade', value: `${m.score_qualidade_leads ?? 0}/100`, sub: 'Nível de prontidão dos leads' },
              { icon: <CheckCircle2 className="w-6 h-6" />, cls: 'bg-indigo-50 text-indigo-600', label: 'Taxa de Agendamento', value: m.taxa_agendamento_estimada || '0%', sub: 'Leads com visita agendada' },
              { icon: <MessageSquare className="w-6 h-6" />, cls: 'bg-purple-50 text-purple-600', label: 'Conversas Analisadas', value: m.total_leads_analisados ?? 0, sub: m.total_mensagens ? `${m.total_mensagens.toLocaleString('pt-BR')} mensagens · ${m.total_leads_banco} leads` : 'Cruzadas com IA & tráfego' },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${k.cls}`}>{k.icon}</div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
                  <p className="text-xl font-black text-gray-900">{k.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{k.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {analise.resumo_geral && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Lightbulb className="w-4 h-4" /></div>
                <h2 className="font-bold text-sm text-gray-900 uppercase tracking-wider">Raio-X Comercial</h2>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{analise.resumo_geral}</p>
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
            {tabBtn('oportunidades', <Flame className="w-3.5 h-3.5" />, 'Leads Quentes & Resgate', analise.leads_quentes?.length || 0)}
            {tabBtn('canais', <TrendingUp className="w-3.5 h-3.5" />, 'Diagnóstico de Canais', analise.diagnostico_canais?.length || 0)}
            {tabBtn('atritos', <AlertTriangle className="w-3.5 h-3.5" />, 'Alertas de Atrito', analise.alertas_atrito?.length || 0)}
            {tabBtn('estoque', <Car className="w-3.5 h-3.5" />, 'Demanda de Estoque', analise.insights_estoque?.length || 0)}
          </div>

          {/* LEADS QUENTES */}
          {activeTab === 'oportunidades' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!analise.leads_quentes?.length ? (
                <div className="md:col-span-2 bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">Nenhum lead quente identificado.</div>
              ) : analise.leads_quentes.map((item: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setSelectedLead(toLeadType(item.lead, item))}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between gap-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">{item.nome || "Cliente"}</h4>
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{String(item.telefone || '-').split('@')[0]}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black whitespace-nowrap">🔥 {item.probabilidade_fechamento}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {item.veiculo && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold"><Car className="w-3.5 h-3.5" />{item.veiculo}</span>}
                      {item.canal && <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">{item.canal}</span>}
                    </div>
                    <div className="space-y-2 text-xs text-gray-600 mt-2">
                      <p className="leading-relaxed"><strong className="text-gray-900">Por que é quente:</strong> {item.motivo}</p>
                      {item.sinais_compra?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.sinais_compra.map((s: string, i: number) => <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold">✓ {s}</span>)}
                        </div>
                      )}
                      <p><strong className="text-gray-900">Próximo passo:</strong> {item.acao_recomendada}</p>
                    </div>
                    {item.copy_resgate && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Mensagem de resgate sugerida</span>
                          <button onClick={(e) => { e.stopPropagation(); handleCopy(item.copy_resgate, idx) }} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[10px] font-bold cursor-pointer">
                            {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            {copiedIndex === idx ? "Copiado!" : "Copiar"}
                          </button>
                        </p>
                        <p className="text-xs text-gray-800 italic">"{item.copy_resgate}"</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400">Clique no card para ver o lead completo</span>
                    {item.telefone && (
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirWhatsAppWeb(item.session_id || item.telefone, item.nome, item.copy_resgate) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Abrir no WhatsApp Web
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CANAIS */}
          {activeTab === 'canais' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {!analise.diagnostico_canais?.length ? (
                <div className="lg:col-span-2 bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">Sem dados de canais suficientes.</div>
              ) : analise.diagnostico_canais.map((c: any, idx: number) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900">{c.canal}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${qualidadeCls(c.qualidade)}`}>Qualidade {c.qualidade}</span>
                  </div>
                  {c.stats && (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        ['Leads', c.stats.total_leads],
                        ['Agendam.', `${c.stats.taxa_agendamento}%`],
                        ['Quentes', `${c.stats.quentes} (${c.stats.taxa_quentes}%)`],
                        ['Atritos', c.stats.atritos],
                      ].map(([l, v]) => (
                        <div key={l as string} className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{l}</p>
                          <p className="text-sm font-black text-gray-900">{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-600 leading-relaxed">{c.analise}</p>
                  {c.perfil_lead && <p className="text-xs text-gray-600"><strong className="text-gray-900">Perfil do lead:</strong> {c.perfil_lead}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {c.pontos_fortes?.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Pontos fortes</p>
                        <ul className="text-xs text-emerald-950 space-y-0.5">{c.pontos_fortes.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul>
                      </div>
                    )}
                    {c.pontos_fracos?.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-red-50/60 border border-red-100">
                        <p className="text-[10px] font-bold text-red-700 uppercase mb-1">Pontos fracos</p>
                        <ul className="text-xs text-red-950 space-y-0.5">{c.pontos_fracos.map((p: string, i: number) => <li key={i}>• {p}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {c.stats?.top_veiculos?.length > 0 && (
                    <p className="text-[11px] text-gray-500"><strong className="text-gray-700">Veículos mais pedidos:</strong> {c.stats.top_veiculos.join(', ')}</p>
                  )}
                  {c.stats?.top_anuncios?.length > 0 && (
                    <p className="text-[11px] text-gray-500"><strong className="text-gray-700">Anúncios que mais geram leads:</strong> {c.stats.top_anuncios.join(', ')}</p>
                  )}
                  <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase mb-0.5">Recomendação</p>
                    <p className="text-xs text-indigo-950 font-medium">{c.recomendacao}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ATRITOS */}
          {activeTab === 'atritos' && (
            <div className="space-y-3">
              {!analise.alertas_atrito?.length ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">Nenhum atrito detectado.</div>
              ) : analise.alertas_atrito.map((a: any, idx: number) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-1 rounded-md bg-red-50 text-red-600"><ShieldAlert className="w-4 h-4" /></span>
                    <h4 className="font-bold text-sm text-gray-900">{a.tipo}</h4>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">Impacto {a.impacto}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed pt-2">{a.descricao}</p>
                  <Exemplos exemplos={a.exemplos} onOpen={(t, n) => abrirWhatsAppWeb(t, n)} />
                </div>
              ))}
            </div>
          )}

          {/* ESTOQUE */}
          {activeTab === 'estoque' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!analise.insights_estoque?.length ? (
                <div className="md:col-span-2 bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">Sem dados suficientes de demanda.</div>
              ) : analise.insights_estoque.map((e: any, idx: number) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-indigo-600" />
                      <h4 className="font-bold text-sm text-gray-900">{e.titulo}</h4>
                    </div>
                    {e.volume ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">{e.volume} pedidos</span> : null}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{e.descricao}</p>
                  {e.modelos?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {e.modelos.map((mo: string, i: number) => <span key={i} className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-semibold">{mo}</span>)}
                    </div>
                  )}
                  <Exemplos exemplos={e.exemplos} onOpen={(t, n) => abrirWhatsAppWeb(t, n)} />
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Sugestão prática</span>
                    <p className="text-xs font-semibold text-gray-800">{e.acao}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <LeadDrawer lead={selectedLead} isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  )
}
