"use client"

import { useState, useEffect } from "react"
import { 
  Sparkles, 
  RefreshCw, 
  Flame, 
  AlertTriangle, 
  TrendingUp, 
  Car, 
  Phone, 
  MessageSquare, 
  ArrowUpRight, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  Copy, 
  Check, 
  HelpCircle,
  Lightbulb
} from "lucide-react"

export default function AnaliseIaPage() {
  const [analise, setAnalise] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'oportunidades' | 'canais' | 'atritos' | 'estoque'>('oportunidades')

  // Carrega última análise do banco
  const fetchUltimaAnalise = async () => {
    try {
      const res = await fetch('/api/analise-ia', { cache: 'no-store' })
      const data = await res.json()
      if (data.analise) {
        setAnalise(data.analise)
      }
    } catch (err) {
      console.error("Erro ao carregar analise:", err)
    } finally {
      setLoading(false)
    }
  }

  // Gera nova análise na hora chamando OpenAI
  const handleGerarAnalise = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/analise-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar análise')
      if (data.analise) {
        setAnalise(data.analise)
      }
    } catch (err: any) {
      alert("Erro ao processar Análise com IA: " + err.message)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchUltimaAnalise()
  }, [])

  const handleCopyCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2500)
  }

  const formatWhatsAppLink = (phone: string, text?: string) => {
    const limpo = phone.replace(/\D/g, '')
    const num = limpo.startsWith('55') ? limpo : `55${limpo}`
    const msg = text ? encodeURIComponent(text) : ''
    return `https://wa.me/${num}${msg ? `?text=${msg}` : ''}`
  }

  return (
    <div className="space-y-6 pb-12 font-poppins max-w-7xl mx-auto">
      {/* Cabeçalho Minimalista e Clean */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">
              Análise com Inteligência Artificial
            </h1>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              GPT-4o Mini
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Auditoria das conversas no WhatsApp, detecção de leads quentes e diagnóstico de tráfego.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {analise?.created_at && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {new Date(analise.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleGerarAnalise}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? "Analisando..." : "Atualizar Análise"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs font-bold text-gray-600">Carregando relatório...</p>
        </div>
      ) : !analise ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Nenhuma análise gerada ainda</h3>
          <p className="text-xs text-gray-500 max-w-sm mt-1 mb-5">
            Clique no botão abaixo para processar as conversas e gerar o primeiro relatório estratégico.
          </p>
          <button
            onClick={handleGerarAnalise}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generating ? "Processando..." : "Gerar Análise"}
          </button>
        </div>
      ) : (
        <>
          {/* Métricas Principais (Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Temperatura</p>
                <p className="text-xl font-black text-gray-900">{analise.metricas?.temperatura_geral || "Quente"}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Momento atual dos leads</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Score Qualidade</p>
                <p className="text-xl font-black text-emerald-600">{analise.metricas?.score_qualidade_leads || 85}/100</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Nível de prontidão dos leads</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Agendamento Estimado</p>
                <p className="text-xl font-black text-indigo-600">{analise.metricas?.taxa_agendamento_estimada || "35%"}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Potencial de visita presencial</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amostra Analisada</p>
                <p className="text-xl font-black text-gray-900">{analise.metricas?.total_leads_analisados || "Conversas Recentes"}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Cruzadas com IA & tráfego</p>
              </div>
            </div>
          </div>

          {/* Resumo Executivo da IA */}
          {analise.resumo_geral && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-gray-900 uppercase tracking-wider">
                  Raio-X Comercial da Semana
                </h2>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line font-normal">
                {analise.resumo_geral}
              </p>
            </div>
          )}

          {/* Navegação entre Abas */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <button
              onClick={() => setActiveTab('oportunidades')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'oportunidades'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Leads Quentes & Resgate ({analise.leads_quentes?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab('canais')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'canais'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Diagnóstico de Canais ({analise.diagnostico_canais?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab('atritos')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'atritos'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Alertas de Atrito ({analise.alertas_atrito?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab('estoque')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'estoque'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              Demanda de Estoque ({analise.insights_estoque?.length || 0})
            </button>
          </div>

          {/* Conteúdo Aba: Oportunidades Quentes & Copy de Resgate */}
          {activeTab === 'oportunidades' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(!analise.leads_quentes || analise.leads_quentes.length === 0) ? (
                <div className="col-span-2 bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">
                  Nenhum lead com alta propensão identificado nas últimas mensagens.
                </div>
              ) : (
                analise.leads_quentes.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between gap-4 hover:border-indigo-200 transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-bold text-sm text-gray-900">{item.nome || "Cliente"}</h4>
                          <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {item.telefone || "-"}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black flex items-center gap-1">
                          🔥 {item.probabilidade_fechamento || "Alta"} Probabilidade
                        </span>
                      </div>

                      {item.veiculo && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
                          <Car className="w-3.5 h-3.5" />
                          {item.veiculo}
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs text-gray-600 mt-2">
                        <p><strong className="text-gray-900">Motivo:</strong> {item.motivo}</p>
                        <p><strong className="text-gray-900">Ação imediata:</strong> {item.acao_recomendada}</p>
                      </div>

                      {/* Caixa com Copy Pronta de WhatsApp */}
                      {item.copy_resgate && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 relative group">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>Mensagem de Resgate Sugerida</span>
                            <button
                              onClick={() => handleCopyCopy(item.copy_resgate, idx)}
                              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[10px] font-bold"
                            >
                              {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              {copiedIndex === idx ? "Copiado!" : "Copiar"}
                            </button>
                          </p>
                          <p className="text-xs text-gray-800 italic">"{item.copy_resgate}"</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                      {item.telefone && (
                        <a
                          href={formatWhatsAppLink(item.telefone, item.copy_resgate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Chamar no WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Conteúdo Aba: Diagnóstico de Canais */}
          {activeTab === 'canais' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(!analise.diagnostico_canais || analise.diagnostico_canais.length === 0) ? (
                <div className="col-span-3 bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">
                  Sem dados de canais suficientes para diagnóstico.
                </div>
              ) : (
                analise.diagnostico_canais.map((c: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-gray-900">{c.canal}</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          c.qualidade?.toLowerCase() === 'alta' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          c.qualidade?.toLowerCase() === 'média' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          Qualidade {c.qualidade}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed mb-3">{c.analise}</p>
                    </div>
                    <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-0.5">Recomendação:</p>
                      <p className="text-xs text-indigo-950 font-medium">{c.recomendacao}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Conteúdo Aba: Alertas de Atrito */}
          {activeTab === 'atritos' && (
            <div className="space-y-3">
              {(!analise.alertas_atrito || analise.alertas_atrito.length === 0) ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">
                  Nenhum atrito crítico detectado nas conversas analisadas.
                </div>
              ) : (
                analise.alertas_atrito.map((a: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-md bg-red-50 text-red-600">
                          <ShieldAlert className="w-4 h-4" />
                        </span>
                        <h4 className="font-bold text-sm text-gray-900">{a.tipo}</h4>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          Impacto {a.impacto}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed pt-1">{a.descricao}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 shrink-0 sm:max-w-xs w-full">
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Como resolver:</p>
                      <p className="text-xs text-amber-950">{a.sugestao_correcao}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Conteúdo Aba: Demanda de Estoque */}
          {activeTab === 'estoque' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(!analise.insights_estoque || analise.insights_estoque.length === 0) ? (
                <div className="col-span-2 bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">
                  Sem dados suficientes para avaliar demanda de modelos de veículos.
                </div>
              ) : (
                analise.insights_estoque.map((e: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-indigo-600" />
                      <h4 className="font-bold text-sm text-gray-900">{e.titulo}</h4>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{e.descricao}</p>
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 mt-2">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Sugestão Prática:</span>
                      <p className="text-xs font-semibold text-gray-800">{e.acao}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
