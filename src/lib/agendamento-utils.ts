/**
 * Utilitários para tratamento e exibição de agendamento de visitas no Dashboard, Leads e Funil.
 * Trata tanto horários exatos (ex: "13:30", "14h") quanto períodos textuais (ex: "manhã", "tarde", "qualquer horário").
 */

export interface HorarioParsed {
  isTime: boolean;
  formatted: string;
}

export function parseHorarioVisita(horarioRaw?: string | null): HorarioParsed | null {
  if (!horarioRaw || !String(horarioRaw).trim()) return null;
  const str = String(horarioRaw).trim();

  // Caso 1: Formato HH:mm ou HH:mm:ss
  const timeColonMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeColonMatch) {
    const h = timeColonMatch[1].padStart(2, '0');
    const m = timeColonMatch[2];
    return { isTime: true, formatted: `${h}:${m}` };
  }

  // Caso 2: Formato 14h ou 14h30
  const timeHMatch = str.match(/^(\d{1,2})h(?:(\d{2}))?$/i);
  if (timeHMatch) {
    const h = timeHMatch[1].padStart(2, '0');
    const m = timeHMatch[2] ? timeHMatch[2].padStart(2, '0') : '00';
    return { isTime: true, formatted: `${h}:${m}` };
  }

  // Caso 3: Texto descritivo ("manhã", "tarde", "parte da manhã", "qualquer horário", etc.)
  const formattedText = str.charAt(0).toUpperCase() + str.slice(1);
  return { isTime: false, formatted: formattedText };
}

/**
 * Constrói string ISO com fuso -03:00 (Brasil) para persistência e ordenação cronológica.
 * Se o horário for textual (ex: "manhã"), atribui uma hora representativa do período (ex: 09:00)
 * para que fique na ordem correta do dia e nunca desloque a data para o dia anterior.
 */
export function construirDataAgendamentoIso(
  dateRaw?: string | null,
  timeRaw?: string | null
): string | null {
  if (!dateRaw || !String(dateRaw).trim()) return null;
  const dateStr = String(dateRaw).trim();
  const timeStr = timeRaw ? String(timeRaw).trim() : '';

  let day = 1;
  let month = 1;
  let year = new Date().getFullYear();
  let parsedOk = false;

  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 2) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      if (parts.length >= 3) {
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
      }
      parsedOk = true;
    }
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
        parsedOk = true;
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        parsedOk = true;
      }
    }
  }

  if (!parsedOk) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {}
    return null;
  }

  // Determina hora e minuto
  let hh = 12; // padrão meio-dia para manter no mesmo dia em qualquer timezone
  let mm = 0;

  const colonMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (colonMatch) {
    hh = parseInt(colonMatch[1], 10);
    mm = parseInt(colonMatch[2], 10);
  } else {
    const hMatch = timeStr.match(/^(\d{1,2})h(?:(\d{2}))?/i);
    if (hMatch) {
      hh = parseInt(hMatch[1], 10);
      mm = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    } else {
      const lower = timeStr.toLowerCase();
      if (lower.includes('manh')) {
        hh = 9;
      } else if (lower.includes('tard')) {
        hh = 14;
      } else if (lower.includes('noit')) {
        hh = 19;
      }
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoComOffset = `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00-03:00`;
  try {
    return new Date(isoComOffset).toISOString();
  } catch {
    return null;
  }
}

export interface VisitaFormatada {
  hasAgendamento: boolean;
  badgeText: string;
  dataTexto: string;
  isHoraExata: boolean;
  dataFormatada: string;
  horarioFormatado: string;
}

/**
 * Formata as informações de visita para exibição no Dashboard e na lista de Leads.
 */
export function formatarVisitaDashboard(lead: any): VisitaFormatada {
  if (!lead) {
    return {
      hasAgendamento: false,
      badgeText: '',
      dataTexto: '',
      isHoraExata: false,
      dataFormatada: '',
      horarioFormatado: '',
    };
  }

  const rawHora = lead.horario_agendamento_visita ?? lead.horarioAgendamentoVisita ?? '';
  const rawData = lead.data_agendamento_visita ?? lead.dataAgendamentoVisita ?? '';
  const isoAgendamento = lead.data_agendamento ?? lead.dataAgendamento ?? '';

  let horaParsed = parseHorarioVisita(rawHora);

  // Extrair data DD/MM/AAAA
  let dataStr = '';
  if (rawData && String(rawData).trim()) {
    const s = String(rawData).trim();
    if (s.includes('/')) {
      const parts = s.split('/');
      const d = parts[0].padStart(2, '0');
      const m = (parts[1] || '01').padStart(2, '0');
      let y = parts[2] || '';
      if (!y) {
        y = isoAgendamento ? String(new Date(isoAgendamento).getFullYear()) : String(new Date().getFullYear());
      } else if (y.length === 2) {
        y = `20${y}`;
      }
      dataStr = `${d}/${m}/${y}`;
    } else if (s.includes('-')) {
      const parts = s.split('-');
      if (parts[0].length === 4) {
        dataStr = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      } else {
        dataStr = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2] || new Date().getFullYear()}`;
      }
    } else {
      dataStr = s;
    }
  }

  if (!dataStr && isoAgendamento) {
    try {
      const d = new Date(isoAgendamento);
      if (!isNaN(d.getTime())) {
        dataStr = d.toLocaleDateString('pt-BR');
        if (!horaParsed) {
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          if (`${hh}:${mm}` !== '00:00' && `${hh}:${mm}` !== '12:00') {
            horaParsed = { isTime: true, formatted: `${hh}:${mm}` };
          }
        }
      }
    } catch {}
  }

  const hasAgendamento = Boolean(dataStr || horaParsed || isoAgendamento);

  if (!hasAgendamento) {
    return {
      hasAgendamento: false,
      badgeText: '',
      dataTexto: '',
      isHoraExata: false,
      dataFormatada: '',
      horarioFormatado: '',
    };
  }

  if (horaParsed) {
    if (horaParsed.isTime) {
      return {
        hasAgendamento: true,
        badgeText: horaParsed.formatted,
        dataTexto: dataStr ? `Data da visita: ${dataStr} às ${horaParsed.formatted}` : `Horário: ${horaParsed.formatted}`,
        isHoraExata: true,
        dataFormatada: dataStr,
        horarioFormatado: horaParsed.formatted,
      };
    } else {
      // Texto como "Manhã", "Tarde", "Parte da manhã", etc.
      return {
        hasAgendamento: true,
        badgeText: horaParsed.formatted,
        dataTexto: dataStr ? `Data da visita: ${dataStr} • ${horaParsed.formatted}` : `Período: ${horaParsed.formatted}`,
        isHoraExata: false,
        dataFormatada: dataStr,
        horarioFormatado: horaParsed.formatted,
      };
    }
  }

  return {
    hasAgendamento: true,
    badgeText: 'Agendado',
    dataTexto: dataStr ? `Data da visita: ${dataStr}` : 'Visita agendada',
    isHoraExata: false,
    dataFormatada: dataStr,
    horarioFormatado: '',
  };
}

/**
 * Filtra se um lead corresponde à data selecionada no filtro (formato YYYY-MM-DD),
 * evitando problemas de fuso horário.
 */
export function matchesVisitasDate(lead: any, filterDateStr: string): boolean {
  if (!filterDateStr) return true;
  const rawData = lead.data_agendamento_visita ?? lead.dataAgendamentoVisita;
  if (rawData && String(rawData).trim()) {
    const raw = String(rawData).trim();
    const parts = filterDateStr.split('-');
    if (parts.length === 3) {
      const fYear = parts[0];
      const fMonth = parts[1];
      const fDay = parts[2];

      if (raw.includes('/')) {
        const rParts = raw.split('/');
        const rDay = rParts[0].padStart(2, '0');
        const rMonth = (rParts[1] || '').padStart(2, '0');
        if (rParts.length >= 3) {
          let rYear = rParts[2];
          if (rYear.length === 2) rYear = `20${rYear}`;
          return rYear === fYear && rMonth === fMonth && rDay === fDay;
        }
        return rMonth === fMonth && rDay === fDay;
      }
      if (raw.includes('-')) {
        return raw.startsWith(filterDateStr);
      }
    }
  }

  const iso = lead.data_agendamento ?? lead.dataAgendamento;
  if (iso) {
    try {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}` === filterDateStr;
      }
    } catch {}
  }

  return false;
}
