"use client"

import { useState, useMemo } from "react"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Phone,
  Car,
  CheckCircle2,
  CalendarDays,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ArrowRight,
  CalendarCheck
} from "lucide-react"
import { cn } from "@/lib/utils"

interface VisitasCalendarProps {
  leads: any[]
  onOpenLead?: (lead: any) => void
}

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

export function extrairDataLead(lead: any, defaultYear = new Date().getFullYear()): {
  ano: number
  mes: number
  dia: number
  chave: string
} | null {
  if (!lead) return null
  const rawData = lead.data_agendamento_visita || lead.dataAgendamentoVisita || ""
  const iso = lead.data_agendamento || lead.dataAgendamento || ""

  if (rawData && String(rawData).trim()) {
    const s = String(rawData).trim()
    if (s.includes("/")) {
      const parts = s.split("/")
      const d = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      let y = parts[2] ? parseInt(parts[2], 10) : defaultYear
      if (y < 100) y += 2000
      if (!isNaN(d) && !isNaN(m) && d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        const pad = (n: number) => String(n).padStart(2, "0")
        return { ano: y, mes: m, dia: d, chave: `${y}-${pad(m)}-${pad(d)}` }
      }
    } else if (s.includes("-")) {
      const parts = s.split("-")
      if (parts.length === 3) {
        let y = parseInt(parts[0], 10)
        let m = parseInt(parts[1], 10)
        let d = parseInt(parts[2], 10)
        if (parts[0].length < 4 && parts[2].length === 4) {
          d = parseInt(parts[0], 10)
          m = parseInt(parts[1], 10)
          y = parseInt(parts[2], 10)
        }
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const pad = (n: number) => String(n).padStart(2, "0")
          return { ano: y, mes: m, dia: d, chave: `${y}-${pad(m)}-${pad(d)}` }
        }
      }
    }
  }

  if (iso) {
    try {
      const dt = new Date(iso)
      if (!isNaN(dt.getTime())) {
        const y = dt.getFullYear()
        const m = dt.getMonth() + 1
        const d = dt.getDate()
        const pad = (n: number) => String(n).padStart(2, "0")
        return { ano: y, mes: m, dia: d, chave: `${y}-${pad(m)}-${pad(d)}` }
      }
    } catch {}
  }

  return null
}

export function getHorarioOrdem(lead: any): number {
  const horaStr = String(lead.horario_agendamento_visita || lead.horarioAgendamentoVisita || "").trim().toLowerCase()
  const match = horaStr.match(/^(\d{1,2}):?(\d{2})?/)
  if (match) {
    const hh = parseInt(match[1], 10)
    const mm = match[2] ? parseInt(match[2], 10) : 0
    return hh * 60 + mm
  }
  if (horaStr.includes("manh")) return 9 * 60
  if (horaStr.includes("tard")) return 14 * 60
  if (horaStr.includes("noit")) return 19 * 60
  return 9999
}

function formatarTelefoneExibicao(tel?: string | null) {
  if (!tel) return ""
  const clean = String(tel).replace(/\D/g, "")
  if (clean.length === 13 && clean.startsWith("55")) {
    return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
  }
  return tel
}

export function VisitasCalendar({ leads, onOpenLead }: VisitasCalendarProps) {
  // 1. Filtrar estritamente apenas leads com visita agendada
  const leadsAgendados = useMemo(() => {
    return (leads || []).filter((l: any) => {
      const temData = Boolean(l.data_agendamento_visita || l.dataAgendamentoVisita || l.data_agendamento || l.dataAgendamento)
      const temHora = Boolean(l.horario_agendamento_visita || l.horarioAgendamentoVisita)
      const isConfirmada = l.lead_visita_confirmada === true || l.leadVisitaConfirmada === true
      const isEtapaVisita = l.etapa === "visita_agendada" || l.status === "visita_agendada"
      return temData || temHora || isConfirmada || isEtapaVisita
    })
  }, [leads])

  // Data atual de referência
  const hoje = useMemo(() => new Date(), [])
  const hojeStr = useMemo(() => {
    const y = hoje.getFullYear()
    const m = String(hoje.getMonth() + 1).padStart(2, "0")
    const d = String(hoje.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [hoje])

  // Mapa de visitas por chave "YYYY-MM-DD"
  const visitasPorDia = useMemo(() => {
    const mapa = new Map<string, any[]>()
    leadsAgendados.forEach((l) => {
      const dataObj = extrairDataLead(l, hoje.getFullYear())
      if (dataObj) {
        if (!mapa.has(dataObj.chave)) mapa.set(dataObj.chave, [])
        mapa.get(dataObj.chave)!.push(l)
      }
    })
    // Ordenar as visitas de cada dia por horário crescente
    mapa.forEach((lista) => {
      lista.sort((a, b) => getHorarioOrdem(a) - getHorarioOrdem(b))
    })
    return mapa
  }, [leadsAgendados, hoje])

  // Determinar o mês/ano inicial: se houver visitas no mês atual, usa atual; senão, usa o mês mais recente com visitas
  const [dataVisualizacao, setDataVisualizacao] = useState<Date>(() => {
    // Verificar se há visitas no mês atual
    const mesAtual = hoje.getMonth() + 1
    const anoAtual = hoje.getFullYear()
    const temNoMesAtual = Array.from(visitasPorDia.keys()).some((k) => {
      const [y, m] = k.split("-").map(Number)
      return y === anoAtual && m === mesAtual
    })
    if (temNoMesAtual) return new Date(anoAtual, mesAtual - 1, 1)

    // Se não tiver no atual, pegar a data com agendamento mais recente
    const chaves = Array.from(visitasPorDia.keys()).sort()
    if (chaves.length > 0) {
      const ultimaChave = chaves[chaves.length - 1]
      const [y, m] = ultimaChave.split("-").map(Number)
      return new Date(y, m - 1, 1)
    }
    return new Date(anoAtual, mesAtual - 1, 1)
  })

  // Dia selecionado (default: hoje se tiver visita, ou o primeiro dia com visita do mês visível)
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(() => {
    const ano = dataVisualizacao.getFullYear()
    const mes = dataVisualizacao.getMonth() + 1
    const pad = (n: number) => String(n).padStart(2, "0")
    const hojeChave = `${ano}-${pad(mes)}-${pad(hoje.getDate())}`

    if (visitasPorDia.has(hojeChave)) return hojeChave

    // Buscar primeiro dia com visitas neste mês
    for (const chave of Array.from(visitasPorDia.keys()).sort()) {
      const [y, m] = chave.split("-").map(Number)
      if (y === ano && m === mes) return chave
    }

    // Se não tiver no mês, buscar qualquer dia existente
    const todasChaves = Array.from(visitasPorDia.keys()).sort()
    return todasChaves.length > 0 ? todasChaves[todasChaves.length - 1] : hojeStr
  })

  // Controles de Navegação de Mês
  const handleMesAnterior = () => {
    setDataVisualizacao((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleProximoMes = () => {
    setDataVisualizacao((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleIrParaHoje = () => {
    const now = new Date()
    setDataVisualizacao(new Date(now.getFullYear(), now.getMonth(), 1))
    setDiaSelecionado(hojeStr)
  }

  const anoAtual = dataVisualizacao.getFullYear()
  const mesAtual = dataVisualizacao.getMonth() // 0-indexed

  // Total de visitas no mês visível
  const totalVisitasNoMes = useMemo(() => {
    let total = 0
    visitasPorDia.forEach((lista, chave) => {
      const [y, m] = chave.split("-").map(Number)
      if (y === anoAtual && m === mesAtual + 1) {
        total += lista.length
      }
    })
    return total
  }, [visitasPorDia, anoAtual, mesAtual])

  // Gerar a matriz do calendário (dias do mês anterior para completar semana + dias do mês + dias do próximo)
  const gradeDias = useMemo(() => {
    const primeiroDiaMes = new Date(anoAtual, mesAtual, 1)
    const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0)

    const diaSemanaInicio = primeiroDiaMes.getDay() // 0 (Dom) a 6 (Sáb)
    const totalDiasMes = ultimoDiaMes.getDate()

    const dias: Array<{
      diaNumero: number
      chave: string
      isMesAtual: boolean
      isHoje: boolean
      visitas: any[]
    }> = []

    const pad = (n: number) => String(n).padStart(2, "0")

    // Dias do mês anterior
    const ultimoDiaMesAnterior = new Date(anoAtual, mesAtual, 0).getDate()
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const dNum = ultimoDiaMesAnterior - i
      const prevDate = new Date(anoAtual, mesAtual - 1, dNum)
      const chave = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(dNum)}`
      dias.push({
        diaNumero: dNum,
        chave,
        isMesAtual: false,
        isHoje: chave === hojeStr,
        visitas: visitasPorDia.get(chave) || []
      })
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDiasMes; d++) {
      const chave = `${anoAtual}-${pad(mesAtual + 1)}-${pad(d)}`
      dias.push({
        diaNumero: d,
        chave,
        isMesAtual: true,
        isHoje: chave === hojeStr,
        visitas: visitasPorDia.get(chave) || []
      })
    }

    // Dias do próximo mês para fechar a última linha (múltiplo de 7)
    const resto = dias.length % 7
    if (resto > 0) {
      const faltam = 7 - resto
      for (let d = 1; d <= faltam; d++) {
        const nextDate = new Date(anoAtual, mesAtual + 1, d)
        const chave = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(d)}`
        dias.push({
          diaNumero: d,
          chave,
          isMesAtual: false,
          isHoje: chave === hojeStr,
          visitas: visitasPorDia.get(chave) || []
        })
      }
    }

    return dias
  }, [anoAtual, mesAtual, hojeStr, visitasPorDia])

  // Leads do dia selecionado
  const visitasDoDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return []
    return visitasPorDia.get(diaSelecionado) || []
  }, [visitasPorDia, diaSelecionado])

  // Formatar data selecionada por extenso
  const dataSelecionadaTexto = useMemo(() => {
    if (!diaSelecionado) return ""
    try {
      const [y, m, d] = diaSelecionado.split("-").map(Number)
      const dataObj = new Date(y, m - 1, d)
      return dataObj.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    } catch {
      return diaSelecionado
    }
  }, [diaSelecionado])

  return (
    <div className="space-y-6 mt-10">
      {/* 1. Header da Seção com Controles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-poppins flex items-center gap-2">
                Visitas Agendadas
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                  {leadsAgendados.length} Total
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Calendário interativo de agendamentos e visitas de clientes à concessionária.
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Navegação de Mês */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleIrParaHoje}
            className="px-3.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Hoje
          </button>

          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-1 shadow-2xs">
            <button
              onClick={handleMesAnterior}
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-4 text-sm font-bold text-gray-900 min-w-[150px] text-center">
              {NOMES_MESES[mesAtual]} de {anoAtual}
            </span>

            <button
              onClick={handleProximoMes}
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 bg-indigo-50/80 border border-indigo-100 px-3.5 py-2 rounded-2xl text-xs font-bold text-indigo-700">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <span>{totalVisitasNoMes} agendada{totalVisitasNoMes === 1 ? "" : "s"} no mês</span>
          </div>
        </div>
      </div>

      {/* 2. Grade do Calendário Mensal */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/70 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 py-3">
          {DIAS_DA_SEMANA.map((d, i) => (
            <div key={i} className={cn(i === 0 || i === 6 ? "text-gray-400" : "text-gray-600")}>
              {d}
            </div>
          ))}
        </div>

        {/* Grade de Dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 bg-gray-50/30">
          {gradeDias.map((item, idx) => {
            const isSelected = diaSelecionado === item.chave
            const hasVisitas = item.visitas.length > 0

            return (
              <div
                key={idx}
                onClick={() => setDiaSelecionado(item.chave)}
                className={cn(
                  "min-h-[90px] sm:min-h-[105px] p-2 transition-all cursor-pointer flex flex-col justify-between group relative select-none",
                  !item.isMesAtual && "bg-gray-50/80 text-gray-300",
                  item.isMesAtual && !isSelected && "bg-white hover:bg-indigo-50/30",
                  isSelected && "bg-indigo-50/60 ring-2 ring-indigo-500 z-10 shadow-sm",
                  item.isHoje && !isSelected && "border-indigo-300"
                )}
              >
                {/* Linha Superior da Célula: Número do Dia + Indicador de Hoje */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                      item.isHoje && "bg-indigo-600 text-white font-black",
                      !item.isHoje && item.isMesAtual && !isSelected && "text-gray-700 group-hover:text-indigo-600",
                      !item.isHoje && !item.isMesAtual && "text-gray-300",
                      isSelected && !item.isHoje && "bg-indigo-200 text-indigo-900 font-black"
                    )}
                  >
                    {item.diaNumero}
                  </span>

                  {/* Badge de quantidade de visitas no dia (estilo da foto do celular) */}
                  {hasVisitas && (
                    <span
                      className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs",
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-blue-600 text-white group-hover:bg-blue-700"
                      )}
                      title={`${item.visitas.length} visita(s) agendada(s)`}
                    >
                      {item.visitas.length}
                    </span>
                  )}
                </div>

                {/* Conteúdo / Horários dos Agendamentos no Dia (Chips Azuis idênticos ao print) */}
                <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end">
                  {hasVisitas && (
                    <div className="space-y-0.5">
                      {item.visitas.slice(0, 2).map((v: any, vIdx: number) => {
                        const hora = String(v.horario_agendamento_visita || v.horarioAgendamentoVisita || "Visita").trim()
                        return (
                          <div
                            key={vIdx}
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate transition-colors flex items-center gap-1",
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-blue-500/90 text-white hover:bg-blue-600"
                            )}
                            title={`${hora} - ${v.nome || "Cliente"} (${v.veiculo_interessado || ""})`}
                          >
                            <Clock className="w-2.5 h-2.5 shrink-0 opacity-80" />
                            <span className="truncate">{hora}</span>
                          </div>
                        )
                      })}

                      {/* Se houver mais de 2 visitas no mesmo dia */}
                      {item.visitas.length > 2 && (
                        <div className="text-[9px] font-black text-blue-700 text-right pr-1">
                          +{item.visitas.length - 2} mais
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Painel de Detalhes das Visitas do Dia Selecionado */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 capitalize font-poppins">
                {dataSelecionadaTexto || "Selecione um dia"}
              </h3>
              <p className="text-xs text-gray-500">
                {visitasDoDiaSelecionado.length === 0
                  ? "Nenhum agendamento para este dia"
                  : `${visitasDoDiaSelecionado.length} agendamento${visitasDoDiaSelecionado.length > 1 ? "s" : ""} programado${visitasDoDiaSelecionado.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {visitasDoDiaSelecionado.length > 0 && (
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl self-start sm:self-auto flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              {visitasDoDiaSelecionado.length} Visita{visitasDoDiaSelecionado.length > 1 ? "s" : ""} em ordem de horário
            </span>
          )}
        </div>

        {/* Lista de Cards de Agendamentos do Dia em Ordem Cronológica */}
        {visitasDoDiaSelecionado.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {visitasDoDiaSelecionado.map((lead: any, i: number) => {
              const hora = String(lead.horario_agendamento_visita || lead.horarioAgendamentoVisita || "Agendado").trim()
              const telFormatado = formatarTelefoneExibicao(lead.telefone)
              const telPuro = String(lead.telefone || "").replace(/\D/g, "")

              return (
                <div
                  key={lead.id || i}
                  onClick={() => onOpenLead && onOpenLead(lead)}
                  className="group relative bg-gray-50/70 hover:bg-white rounded-2xl p-4 border border-gray-200/80 hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3"
                >
                  {/* Topo do Card: Horário em Destaque + Badge de Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 text-white font-black text-xs shadow-2xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{hora}</span>
                    </div>

                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Agendado
                    </span>
                  </div>

                  {/* Informações Principais do Cliente */}
                  <div className="space-y-2">
                    <div>
                      <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center justify-between text-sm">
                        <span>{lead.nome || "Cliente não informado"}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100" />
                      </h4>
                      <p className="text-xs text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span>{telFormatado || lead.telefone}</span>
                      </p>
                    </div>

                    {/* Veículo de Interesse */}
                    <div className="bg-white rounded-xl p-2.5 border border-gray-100 flex items-start gap-2">
                      <Car className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Veículo de Interesse</span>
                        <p className="text-xs font-bold text-gray-800 line-clamp-1">
                          {lead.veiculo_interessado || "Não especificado"}
                        </p>
                      </div>
                    </div>

                    {/* Observação Qualificada da IA / Loja */}
                    {lead.observacao_lead_qualificado && (
                      <p className="text-[11px] text-gray-600 bg-white/60 p-2 rounded-lg border border-gray-100/80 line-clamp-2 leading-relaxed">
                        <span className="font-bold text-gray-500">Obs:</span> {lead.observacao_lead_qualificado}
                      </p>
                    )}
                  </div>

                  {/* Rodapé do Card com Ação */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Abrir conversa e ficha
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Estado Vazio Amigável para dias sem visita */
          <div className="text-center py-10 px-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-gray-800 font-poppins">
              Nenhuma visita agendada para este dia
            </h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Clique em qualquer dia do calendário que contenha marcação azul para visualizar os horários e detalhes dos leads agendados.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
