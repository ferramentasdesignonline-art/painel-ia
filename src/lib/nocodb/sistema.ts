/**
 * src/lib/nocodb/sistema.ts
 *
 * Módulo de acesso ao NocoDB para as tabelas principais do Sistema Dash IA
 * Base NocoDB: Sistema Dash IA (phlpcm1vv49x1ka)
 */

const NOCODB_URL = (process.env.NOCODB_URL || "https://evolution-nocodb.4lap5g.easypanel.host").replace(/\/+$/, "");
const NOCODB_TOKEN = process.env.NOCODB_API_TOKEN || "9Qz7ETxba8JnXq3B0e9ybHaSiDar6hLqYBIIkg7u";
export const SISTEMA_BASE_ID = "phlpcm1vv49x1ka";

export const SISTEMA_TABLES = {
  CLIENTES: "mjdblijq92ayvua",
  ADMINS: "m8ud3tl4c480iaj",
  FUNIS: "my69qadj49wz4yw",
  ETAPAS_FUNIL: "m01vrpxdyz0nmce",
  LEAD_POSICOES: "mfjx794okbm7959",
  LEAD_HISTORICO: "mxmb25ssa3tbcc1",
  LEADS_MANUAIS: "mzjtof1nbbhu8dy",
  TAGS: "mrkmdcmmhmjsob6",
  LEAD_TAGS: "mwmil2suropx22w",
  ANALISES: "mhpfeq6riok04jb",
};

// Cache de mapeamento de UUID antigo -> NocoDB Id para evitar chamadas redundantes
const clientIdCache = new Map<string, number>();
const etapaIdCache = new Map<string, number>();

/**
 * Normaliza um registro do NocoDB para garantir compatibilidade com código existente
 * que espera propriedades minúsculas (ex: id, cliente_id, funil_id, etc.)
 */
export function normalizeRecord<T = any>(record: any): T {
  if (!record || typeof record !== "object") return record;
  const copy: any = { ...record };

  if (copy.Id !== undefined && copy.id === undefined) {
    copy.id = copy.Id;
  }
  if (copy["sistema-dash-ia_clientes_id"] !== undefined && copy.cliente_id === undefined) {
    copy.cliente_id = copy["sistema-dash-ia_clientes_id"];
  }
  if (copy["sistema-dash-ia_funis_id"] !== undefined && copy.funil_id === undefined) {
    copy.funil_id = copy["sistema-dash-ia_funis_id"];
  }
  if (copy["sistema-dash-ia_etapas_funil_id"] !== undefined && copy.etapa_id === undefined) {
    copy.etapa_id = copy["sistema-dash-ia_etapas_funil_id"];
  }
  if (copy["sistema-dash-ia_tags_id"] !== undefined && copy.tag_id === undefined) {
    copy.tag_id = copy["sistema-dash-ia_tags_id"];
  }
  if (copy.CreatedAt !== undefined && copy.created_at === undefined) {
    copy.created_at = copy.CreatedAt;
  }
  if (copy.UpdatedAt !== undefined && copy.updated_at === undefined) {
    copy.updated_at = copy.UpdatedAt;
  }

  return copy as T;
}

/**
 * Executa requisição autenticada ao NocoDB
 */
async function nocoRequest(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${NOCODB_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "xc-token": NOCODB_TOKEN,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[NocoDB Error] ${options.method || "GET"} ${url} -> status ${res.status}:`, text);
    throw new Error(`NocoDB Error ${res.status}: ${text}`);
  }

  // Se resposta vazia (ex: 204 ou DELETE)
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return null;
}

// ==========================================
// CLIENTES
// ==========================================

/**
 * Converte qualquer identificador de cliente (Id numérico, string de número, ou UUID antigo)
 * para o NocoDB Id numérico correspondente.
 */
export async function resolveNocoDBClientId(input: any): Promise<number | null> {
  if (input === null || input === undefined) return null;
  if (typeof input === "object") {
    input = input.Id ?? input.id;
  }

  if (typeof input === "number") return input;

  const str = String(input).trim();
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  if (clientIdCache.has(str)) {
    return clientIdCache.get(str)!;
  }

  try {
    const where = encodeURIComponent(`(uuid_antigo,eq,${str})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records?where=${where}&limit=1`
    );
    const client = data.list?.[0];
    if (client?.Id) {
      clientIdCache.set(str, client.Id);
      return client.Id;
    }
  } catch (err) {
    console.warn("Erro ao resolver clienteId no NocoDB:", err);
  }

  return null;
}

/**
 * Retorna todos os clientes do NocoDB
 */
export async function getNocoDBClientes(options?: { activeOnly?: boolean }): Promise<any[]> {
  try {
    let whereClause = "";
    if (options?.activeOnly) {
      whereClause = `?where=${encodeURIComponent("(active,eq,true)")}&limit=1000&sort=-Id`;
    } else {
      whereClause = `?limit=1000&sort=-Id`;
    }

    const data = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records${whereClause}`);
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBClientes:", err);
    return [];
  }
}

/**
 * Retorna um cliente por ID (numérico ou UUID antigo)
 */
export async function getNocoDBClienteById(id: string | number): Promise<any | null> {
  if (!id) return null;
  const isNum = !isNaN(Number(id));

  try {
    if (isNum) {
      const rec = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records/${id}`);
      return rec ? normalizeRecord(rec) : null;
    }

    const resolvedId = await resolveNocoDBClientId(id);
    if (resolvedId) {
      const rec = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records/${resolvedId}`);
      return rec ? normalizeRecord(rec) : null;
    }

    // Tenta por uuid_antigo diretamente
    const where = encodeURIComponent(`(uuid_antigo,eq,${id})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records?where=${where}&limit=1`
    );
    return data.list?.[0] ? normalizeRecord(data.list[0]) : null;
  } catch (err) {
    console.error("Erro em getNocoDBClienteById:", err);
    return null;
  }
}

/**
 * Cria um novo cliente no NocoDB
 */
export async function createNocoDBCliente(data: any): Promise<any> {
  const payload: any = {
    nome: data.nome,
    slug: data.slug,
    email: data.email?.trim().toLowerCase(),
    senha: data.senha || data.password || "",
    active: data.active !== undefined ? Boolean(data.active) : true,
    tabela_leads: data.tabela_leads || null,
    tabela_bloqueios: data.tabela_bloqueios || null,
    tabela_memoria: data.tabela_memoria || null,
    tabela_estoque: data.tabela_estoque || null,
    supabase_url: data.supabase_url || null,
    supabase_anon_key: data.supabase_anon_key || null,
    supabase_service_role_key: data.supabase_service_role_key || null,
    whatsapp_token: data.whatsapp_token || null,
    tipo_atendimento: data.tipo_atendimento || "com_ia",
    nome_instancia: data.nome_instancia || null,
  };

  if (data.uuid_antigo) {
    payload.uuid_antigo = data.uuid_antigo;
  }

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

/**
 * Atualiza um cliente existente no NocoDB
 */
export async function updateNocoDBCliente(id: string | number, data: any): Promise<boolean> {
  const resolvedId = await resolveNocoDBClientId(id);
  if (!resolvedId) return false;

  const payload: any = {
    Id: resolvedId,
  };

  if (data.nome !== undefined) payload.nome = data.nome;
  if (data.slug !== undefined) payload.slug = data.slug;
  if (data.email !== undefined) payload.email = data.email?.trim().toLowerCase();
  if (data.senha !== undefined || data.password !== undefined) payload.senha = data.senha || data.password;
  if (data.active !== undefined) payload.active = Boolean(data.active);
  if (data.tabela_leads !== undefined) payload.tabela_leads = data.tabela_leads;
  if (data.tabela_bloqueios !== undefined) payload.tabela_bloqueios = data.tabela_bloqueios;
  if (data.tabela_memoria !== undefined) payload.tabela_memoria = data.tabela_memoria;
  if (data.tabela_estoque !== undefined) payload.tabela_estoque = data.tabela_estoque;
  if (data.supabase_url !== undefined) payload.supabase_url = data.supabase_url;
  if (data.supabase_anon_key !== undefined) payload.supabase_anon_key = data.supabase_anon_key;
  if (data.supabase_service_role_key !== undefined) payload.supabase_service_role_key = data.supabase_service_role_key;
  if (data.whatsapp_token !== undefined) payload.whatsapp_token = data.whatsapp_token;
  if (data.tipo_atendimento !== undefined) payload.tipo_atendimento = data.tipo_atendimento;
  if (data.nome_instancia !== undefined) payload.nome_instancia = data.nome_instancia;

  await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return true;
}

/**
 * Exclui um cliente no NocoDB
 */
export async function deleteNocoDBCliente(id: string | number): Promise<boolean> {
  const resolvedId = await resolveNocoDBClientId(id);
  if (!resolvedId) return false;

  await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.CLIENTES}/records`, {
    method: "DELETE",
    body: JSON.stringify({ Id: resolvedId }),
  });

  return true;
}

// ==========================================
// FUNIS & ETAPAS
// ==========================================

/**
 * Converte qualquer identificador de etapa para o NocoDB Id numérico
 */
export async function resolveNocoDBEtapaId(input: any): Promise<number | null> {
  if (input === null || input === undefined) return null;
  if (typeof input === "object") input = input.Id ?? input.id;
  if (typeof input === "number") return input;

  const str = String(input).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);

  if (etapaIdCache.has(str)) return etapaIdCache.get(str)!;

  try {
    const where = encodeURIComponent(`(uuid_antigo,eq,${str})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.ETAPAS_FUNIL}/records?where=${where}&limit=1`
    );
    const etapa = data.list?.[0];
    if (etapa?.Id) {
      etapaIdCache.set(str, etapa.Id);
      return etapa.Id;
    }
  } catch (err) {
    console.warn("Erro ao resolver etapaId no NocoDB:", err);
  }

  return null;
}

/**
 * Busca o funil de um cliente
 */
export async function getNocoDBFunil(clienteId: string | number): Promise<any | null> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return null;

  try {
    const where = encodeURIComponent(`(sistema-dash-ia_clientes_id,eq,${nocoClientId})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.FUNIS}/records?where=${where}&limit=1`
    );
    const funil = data.list?.[0];
    return funil ? normalizeRecord(funil) : null;
  } catch (err) {
    console.error("Erro em getNocoDBFunil:", err);
    return null;
  }
}

/**
 * Cria um funil para o cliente
 */
export async function createNocoDBFunil(
  clienteId: string | number,
  nome = "Funil Principal",
  meta_followup = 5
): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) throw new Error("Cliente não encontrado para criar funil");

  const payload = {
    nome,
    meta_followup: Number(meta_followup) || 5,
    "sistema-dash-ia_clientes_id": nocoClientId,
  };

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.FUNIS}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

/**
 * Atualiza dados do funil (nome, meta_followup)
 */
export async function updateNocoDBFunil(
  clienteId: string | number,
  data: { nome?: string; meta_followup?: number }
): Promise<boolean> {
  const funil = await getNocoDBFunil(clienteId);
  if (!funil?.Id) return false;

  const payload: any = { Id: funil.Id };
  if (data.nome !== undefined) payload.nome = data.nome;
  if (data.meta_followup !== undefined) payload.meta_followup = Number(data.meta_followup);

  await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.FUNIS}/records`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return true;
}

/**
 * Busca todas as etapas de um funil ordenadas por ordem
 */
export async function getNocoDBEtapasFunil(funilId: string | number): Promise<any[]> {
  const isNum = !isNaN(Number(funilId));
  const fId = isNum ? Number(funilId) : funilId;

  try {
    const where = encodeURIComponent(`(sistema-dash-ia_funis_id,eq,${fId})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.ETAPAS_FUNIL}/records?where=${where}&sort=ordem&limit=1000`
    );
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBEtapasFunil:", err);
    return [];
  }
}

/**
 * Cria uma nova etapa no funil
 */
export async function createNocoDBEtapa(data: {
  funil_id: string | number;
  nome: string;
  cor?: string;
  tipo?: string;
  ordem: number;
}): Promise<any> {
  const payload = {
    "sistema-dash-ia_funis_id": Number(data.funil_id),
    nome: data.nome,
    cor: data.cor || "#3b82f6",
    tipo: data.tipo || "manual",
    ordem: Number(data.ordem) || 1,
  };

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.ETAPAS_FUNIL}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

/**
 * Atualiza etapa (nome, cor, ordem, tipo)
 */
export async function updateNocoDBEtapa(
  etapaId: string | number,
  data: Partial<{ nome: string; cor: string; tipo: string; ordem: number }>
): Promise<boolean> {
  const resolvedId = await resolveNocoDBEtapaId(etapaId);
  if (!resolvedId) return false;

  const payload: any = { Id: resolvedId };
  if (data.nome !== undefined) payload.nome = data.nome;
  if (data.cor !== undefined) payload.cor = data.cor;
  if (data.tipo !== undefined) payload.tipo = data.tipo;
  if (data.ordem !== undefined) payload.ordem = Number(data.ordem);

  await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.ETAPAS_FUNIL}/records`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return true;
}

/**
 * Exclui uma etapa do funil
 */
export async function deleteNocoDBEtapa(etapaId: string | number): Promise<boolean> {
  const resolvedId = await resolveNocoDBEtapaId(etapaId);
  if (!resolvedId) return false;

  await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.ETAPAS_FUNIL}/records`, {
    method: "DELETE",
    body: JSON.stringify({ Id: resolvedId }),
  });

  return true;
}

/**
 * Reordena etapas
 */
export async function reorderNocoDBEtapas(
  etapas: Array<{ id: string | number; ordem: number }>
): Promise<boolean> {
  for (const item of etapas) {
    const resolvedId = await resolveNocoDBEtapaId(item.id);
    if (resolvedId) {
      await updateNocoDBEtapa(resolvedId, { ordem: item.ordem });
    }
  }
  return true;
}

/**
 * Cria funil padrão com as 8 etapas oficiais no NocoDB
 */
export async function criarFunilPadraoNocoDB(clienteId: string | number): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return null;

  // 1. Cria ou reutiliza funil
  let funil = await getNocoDBFunil(nocoClientId);
  if (!funil) {
    funil = await createNocoDBFunil(nocoClientId, "Funil Principal", 5);
  }

  // 2. Cria as etapas oficiais se ainda não existirem
  const etapasExistentes = await getNocoDBEtapasFunil(funil.Id);
  if (etapasExistentes.length === 0) {
    const etapasPadrao = [
      { nome: "Em atendimento | Recontratar", cor: "#6366f1", ordem: 1, tipo: "em_atendimento" },
      { nome: "Visita - Agendada", cor: "#fed428", ordem: 2, tipo: "visita_agendada" },
      { nome: "Visita - Realizada", cor: "#9ab6c1", ordem: 3, tipo: "visita_realizada" },
      { nome: "Oportunidade - Ficha Aprovada | Troca | Entrada", cor: "#56ccb4", ordem: 4, tipo: "oportunidade" },
      { nome: "Ficha Reprovada", cor: "#ffc5c7", ordem: 5, tipo: "ficha_reprovada" },
      { nome: "Perdido | Qualificado", cor: "#9568cf", ordem: 6, tipo: "perdido_qualificado" },
      { nome: "Perdido | Desqualificado | Sem resposta", cor: "#83e421", ordem: 7, tipo: "perdido_desqualificado" },
      { nome: "Cliente", cor: "#64c4ff", ordem: 8, tipo: "cliente" },
    ];

    for (const ep of etapasPadrao) {
      await createNocoDBEtapa({
        funil_id: funil.Id,
        nome: ep.nome,
        cor: ep.cor,
        ordem: ep.ordem,
        tipo: ep.tipo,
      });
    }
  }

  return funil;
}

// ==========================================
// POSIÇÕES MANUAIS & HISTÓRICO DE LEADS
// ==========================================

/**
 * Busca posições manuais de leads salvas para um cliente
 */
export async function getNocoDBLeadPosicoes(
  clienteId: string | number,
  options?: { since?: Date }
): Promise<any[]> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return [];

  try {
    let where = `(sistema-dash-ia_clientes_id,eq,${nocoClientId})`;
    if (options?.since) {
      const iso = options.since.toISOString();
      where += `~and(movido_manualmente_em,ge,${iso})`;
    }

    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.LEAD_POSICOES}/records?where=${encodeURIComponent(where)}&limit=10000`
    );
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBLeadPosicoes:", err);
    return [];
  }
}

/**
 * Cria ou atualiza a posição manual de um lead
 */
export async function upsertNocoDBLeadPosicao(
  clienteId: string | number,
  leadId: string | number,
  etapaId: string | number,
  notas?: string
): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  const nocoEtapaId = await resolveNocoDBEtapaId(etapaId);
  if (!nocoClientId || !nocoEtapaId) return null;

  const leadIdStr = String(leadId).trim();

  // Verifica se já existe registro dessa posição para este lead
  const where = encodeURIComponent(
    `(sistema-dash-ia_clientes_id,eq,${nocoClientId})~and(lead_id,eq,${leadIdStr})`
  );
  const existing = await nocoRequest(
    `/api/v2/tables/${SISTEMA_TABLES.LEAD_POSICOES}/records?where=${where}&limit=1`
  );
  const record = existing.list?.[0];

  const nowIso = new Date().toISOString();

  if (record) {
    const payload: any = {
      Id: record.Id,
      "sistema-dash-ia_etapas_funil_id": nocoEtapaId,
      movido_manualmente_em: nowIso,
    };
    if (notas !== undefined) payload.notas = notas;

    const updated = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEAD_POSICOES}/records`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return normalizeRecord(updated);
  } else {
    const payload: any = {
      "sistema-dash-ia_clientes_id": nocoClientId,
      "sistema-dash-ia_etapas_funil_id": nocoEtapaId,
      lead_id: leadIdStr,
      movido_manualmente_em: nowIso,
      notas: notas || null,
    };

    const created = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEAD_POSICOES}/records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return normalizeRecord(created);
  }
}

/**
 * Busca histórico de movimentações ou anotações de leads
 */
export async function getNocoDBLeadHistorico(
  clienteId: string | number,
  leadId?: string | number
): Promise<any[]> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return [];

  try {
    let where = `(sistema-dash-ia_clientes_id,eq,${nocoClientId})`;
    if (leadId !== undefined && leadId !== null) {
      where += `~and(lead_id,eq,${String(leadId).trim()})`;
    }

    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.LEAD_HISTORICO}/records?where=${encodeURIComponent(where)}&sort=-created_at&limit=1000`
    );
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBLeadHistorico:", err);
    return [];
  }
}

/**
 * Adiciona um evento no histórico de lead
 */
export async function addNocoDBLeadHistorico(data: {
  cliente_id: string | number;
  lead_id: string | number;
  tipo_lead?: string;
  etapa_origem_id?: string | number | null;
  etapa_destino_id?: string | number | null;
  vendedor_nome?: string;
  evento: string;
  descricao?: string;
  created_at?: string;
}): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(data.cliente_id);
  if (!nocoClientId) return null;

  const payload: any = {
    "sistema-dash-ia_clientes_id": nocoClientId,
    lead_id: String(data.lead_id).trim(),
    tipo_lead: data.tipo_lead || "ia",
    etapa_origem_id: data.etapa_origem_id ? String(data.etapa_origem_id) : null,
    etapa_destino_id: data.etapa_destino_id ? String(data.etapa_destino_id) : null,
    vendedor_nome: data.vendedor_nome || "Sistema",
    evento: data.evento,
    descricao: data.descricao || "",
    created_at: data.created_at || new Date().toISOString(),
  };

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEAD_HISTORICO}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

// ==========================================
// LEADS MANUAIS
// ==========================================

/**
 * Busca leads manuais de um cliente
 */
export async function getNocoDBLeadsManuais(clienteId: string | number): Promise<any[]> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return [];

  try {
    const where = encodeURIComponent(`(sistema-dash-ia_clientes_id,eq,${nocoClientId})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.LEADS_MANUAIS}/records?where=${where}&limit=5000&sort=-Id`
    );
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBLeadsManuais:", err);
    return [];
  }
}

/**
 * Cria lead manual no NocoDB
 */
export async function createNocoDBLeadManual(data: any): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(data.cliente_id);
  const nocoEtapaId = data.etapa_id ? await resolveNocoDBEtapaId(data.etapa_id) : null;

  const payload: any = {
    "sistema-dash-ia_clientes_id": nocoClientId,
    "sistema-dash-ia_etapas_funil_id": nocoEtapaId,
    nome: data.nome,
    telefone: data.telefone || null,
    veiculo_interessado: data.veiculo_interessado || null,
    vendedor: data.vendedor || null,
    lead_finalizado: Boolean(data.lead_finalizado),
    notas: data.notas || null,
  };

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEADS_MANUAIS}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

/**
 * Atualiza lead manual no NocoDB
 */
export async function updateNocoDBLeadManual(id: string | number, data: any): Promise<any> {
  const isNum = !isNaN(Number(id));
  const leadId = isNum ? Number(id) : id;

  const payload: any = { Id: leadId };

  if (data.nome !== undefined) payload.nome = data.nome;
  if (data.telefone !== undefined) payload.telefone = data.telefone;
  if (data.veiculo_interessado !== undefined) payload.veiculo_interessado = data.veiculo_interessado;
  if (data.vendedor !== undefined) payload.vendedor = data.vendedor;
  if (data.lead_finalizado !== undefined) payload.lead_finalizado = Boolean(data.lead_finalizado);
  if (data.notas !== undefined) payload.notas = data.notas;
  if (data.etapa_id !== undefined) {
    payload["sistema-dash-ia_etapas_funil_id"] = await resolveNocoDBEtapaId(data.etapa_id);
  }

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEADS_MANUAIS}/records`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

/**
 * Exclui lead manual no NocoDB
 */
export async function deleteNocoDBLeadManual(id: string | number): Promise<boolean> {
  const isNum = !isNaN(Number(id));
  const leadId = isNum ? Number(id) : id;

  await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEADS_MANUAIS}/records`, {
    method: "DELETE",
    body: JSON.stringify({ Id: leadId }),
  });

  return true;
}

// ==========================================
// TAGS & LEAD TAGS
// ==========================================

/**
 * Busca todas as tags de um cliente
 */
export async function getNocoDBTags(clienteId: string | number): Promise<any[]> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return [];

  try {
    const where = encodeURIComponent(`(sistema-dash-ia_clientes_id,eq,${nocoClientId})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.TAGS}/records?where=${where}&sort=nome&limit=1000`
    );
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBTags:", err);
    return [];
  }
}

/**
 * Cria tag para um cliente
 */
export async function createNocoDBTag(
  clienteId: string | number,
  data: { nome: string; cor?: string }
): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) throw new Error("Cliente não encontrado");

  const payload = {
    "sistema-dash-ia_clientes_id": nocoClientId,
    nome: data.nome,
    cor: data.cor || "#3b82f6",
  };

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.TAGS}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

/**
 * Exclui tag
 */
export async function deleteNocoDBTag(tagId: string | number): Promise<boolean> {
  const isNum = !isNaN(Number(tagId));
  const tId = isNum ? Number(tagId) : tagId;

  await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.TAGS}/records`, {
    method: "DELETE",
    body: JSON.stringify({ Id: tId }),
  });

  return true;
}

/**
 * Busca associações lead_tags de um cliente
 */
export async function getNocoDBLeadTags(
  clienteId: string | number,
  leadId?: string | number
): Promise<any[]> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return [];

  try {
    let where = `(sistema-dash-ia_clientes_id,eq,${nocoClientId})`;
    if (leadId !== undefined && leadId !== null) {
      where += `~and(lead_id,eq,${String(leadId).trim()})`;
    }

    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.LEAD_TAGS}/records?where=${encodeURIComponent(where)}&limit=10000`
    );
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBLeadTags:", err);
    return [];
  }
}

/**
 * Adiciona tag ao lead
 */
export async function addNocoDBLeadTag(
  clienteId: string | number,
  leadId: string | number,
  tagId: string | number
): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return null;

  const leadIdStr = String(leadId).trim();
  const nocoTagId = Number(tagId);

  // Evitar duplicados
  const where = encodeURIComponent(
    `(sistema-dash-ia_clientes_id,eq,${nocoClientId})~and(lead_id,eq,${leadIdStr})~and(sistema-dash-ia_tags_id,eq,${nocoTagId})`
  );
  const existing = await nocoRequest(
    `/api/v2/tables/${SISTEMA_TABLES.LEAD_TAGS}/records?where=${where}&limit=1`
  );
  if (existing.list?.[0]) {
    return normalizeRecord(existing.list[0]);
  }

  const payload = {
    "sistema-dash-ia_clientes_id": nocoClientId,
    "sistema-dash-ia_tags_id": nocoTagId,
    lead_id: leadIdStr,
  };

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEAD_TAGS}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}

/**
 * Remove tag do lead
 */
export async function removeNocoDBLeadTag(
  clienteId: string | number,
  leadId: string | number,
  tagId: string | number
): Promise<boolean> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return false;

  const leadIdStr = String(leadId).trim();
  const nocoTagId = Number(tagId);

  const where = encodeURIComponent(
    `(sistema-dash-ia_clientes_id,eq,${nocoClientId})~and(lead_id,eq,${leadIdStr})~and(sistema-dash-ia_tags_id,eq,${nocoTagId})`
  );
  const existing = await nocoRequest(
    `/api/v2/tables/${SISTEMA_TABLES.LEAD_TAGS}/records?where=${where}&limit=1`
  );
  const record = existing.list?.[0];
  if (record?.Id) {
    await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.LEAD_TAGS}/records`, {
      method: "DELETE",
      body: JSON.stringify({ Id: record.Id }),
    });
    return true;
  }
  return false;
}

// ==========================================
// ANÁLISES IA
// ==========================================

/**
 * Busca relatórios de análise de IA para um cliente
 */
export async function getNocoDBAnalises(
  clienteId: string | number,
  limit = 10
): Promise<any[]> {
  const nocoClientId = await resolveNocoDBClientId(clienteId);
  if (!nocoClientId) return [];

  try {
    const where = encodeURIComponent(`(sistema-dash-ia_clientes_id,eq,${nocoClientId})`);
    const data = await nocoRequest(
      `/api/v2/tables/${SISTEMA_TABLES.ANALISES}/records?where=${where}&sort=-created_at&limit=${limit}`
    );
    const list = data.list || [];
    return list.map(normalizeRecord);
  } catch (err) {
    console.error("Erro em getNocoDBAnalises:", err);
    return [];
  }
}

/**
 * Salva uma nova análise de IA para o cliente no NocoDB
 */
export async function saveNocoDBAnalise(data: any): Promise<any> {
  const nocoClientId = await resolveNocoDBClientId(data.cliente_id);
  if (!nocoClientId) throw new Error("Cliente não encontrado para salvar análise");

  const payload: any = {
    "sistema-dash-ia_clientes_id": nocoClientId,
    periodo: data.periodo || "30d",
    resumo_geral: typeof data.resumo_geral === "string" ? data.resumo_geral : JSON.stringify(data.resumo_geral),
    leads_quentes: data.leads_quentes || null,
    alertas_atrito: data.alertas_atrito || null,
    diagnostico_canais: data.diagnostico_canais || null,
    insights_estoque: data.insights_estoque || null,
    metricas: data.metricas || null,
    created_at: data.created_at || new Date().toISOString(),
  };

  const result = await nocoRequest(`/api/v2/tables/${SISTEMA_TABLES.ANALISES}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRecord(result);
}
