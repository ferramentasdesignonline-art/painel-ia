/**
 * src/lib/nocodb/wacloud.ts
 *
 * Módulo de acesso ao NocoDB para as tabelas do WaCloud / WhatsApp Web
 * Base NocoDB: WaCloud (pptytc2m1fi6efe)
 */

const NOCODB_URL = (process.env.NOCODB_URL || "https://evolution-nocodb.4lap5g.easypanel.host").replace(/\/+$/, "");
const NOCODB_TOKEN = process.env.NOCODB_API_TOKEN || "9Qz7ETxba8JnXq3B0e9ybHaSiDar6hLqYBIIkg7u";

export const WACLOUD_BASE_ID = "pptytc2m1fi6efe";

export const WACLOUD_TABLES = {
  INSTANCIAS: "m0dobqnvfeoyrfi",
  ETIQUETAS: "mqqlrkk95w7bvzr",
  MENSAGENS: "m7anpj8xtcer722",
  CONTATOS: "m7tbyvo3kzsajzs",
};

/**
 * Normaliza um registro do NocoDB para expor propriedades em minúsculas
 */
export function normalizeWacloudRecord<T = any>(record: any): T {
  if (!record || typeof record !== "object") return record;
  const copy: any = { ...record };

  if (copy.Id !== undefined && copy.id === undefined) {
    copy.id = copy.Id;
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
 * Executa requisição autenticada ao NocoDB para a base WaCloud
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
    console.error(`[NocoDB WaCloud Error] ${options.method || "GET"} ${url} -> status ${res.status}:`, text);
    throw new Error(`NocoDB WaCloud Error ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return null;
}

// ==========================================
// INSTÂNCIAS (wacloud_instancias)
// ==========================================

/**
 * Retorna lista de instâncias cadastradas
 */
export async function getWacloudInstancias(options?: {
  activeOnly?: boolean;
  clienteId?: string | number;
}): Promise<any[]> {
  try {
    const filters: string[] = [];
    if (options?.activeOnly) {
      filters.push("(ativo,eq,true)");
    }
    if (options?.clienteId) {
      filters.push(`(cliente_id,eq,${options.clienteId})`);
    }

    const whereQuery = filters.length > 0 ? `?where=${encodeURIComponent(filters.join("~and"))}&limit=1000` : `?limit=1000`;
    const data = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.INSTANCIAS}/records${whereQuery}`);
    const list = data.list || [];
    return list.map(normalizeWacloudRecord);
  } catch (err) {
    console.error("Erro em getWacloudInstancias:", err);
    return [];
  }
}

/**
 * Busca instância por ID (numérico / UUID antigo) ou por nome da instância
 */
export async function getWacloudInstanciaByIdOrName(idOrName: string | number): Promise<any | null> {
  if (!idOrName) return null;

  const str = String(idOrName).trim();
  const isNum = /^\d+$/.test(str);

  try {
    // 1. Se for ID numérico
    if (isNum) {
      const rec = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.INSTANCIAS}/records/${str}`);
      return rec ? normalizeWacloudRecord(rec) : null;
    }

    // 2. Tenta por nome da instância
    const whereNome = encodeURIComponent(`(nome_instancia,eq,${str})`);
    const dataNome = await nocoRequest(
      `/api/v2/tables/${WACLOUD_TABLES.INSTANCIAS}/records?where=${whereNome}&limit=1`
    );
    if (dataNome.list?.[0]) {
      return normalizeWacloudRecord(dataNome.list[0]);
    }

    // 3. Tenta por uuid_antigo
    const whereUuid = encodeURIComponent(`(uuid_antigo,eq,${str})`);
    const dataUuid = await nocoRequest(
      `/api/v2/tables/${WACLOUD_TABLES.INSTANCIAS}/records?where=${whereUuid}&limit=1`
    );
    if (dataUuid.list?.[0]) {
      return normalizeWacloudRecord(dataUuid.list[0]);
    }
  } catch (err) {
    console.error(`Erro ao buscar instância ${idOrName} no NocoDB:`, err);
  }

  return null;
}

/**
 * Cria ou salva uma instância no NocoDB
 */
export async function createWacloudInstancia(data: {
  nome_instancia: string;
  token: string;
  status?: string;
  cliente_id?: string | number | null;
  ativo?: boolean;
}): Promise<any> {
  const payload: any = {
    nome_instancia: data.nome_instancia,
    token: data.token,
    status: data.status || "criada",
    ativo: data.ativo !== undefined ? Boolean(data.ativo) : true,
    created_at: new Date().toISOString(),
  };

  if (data.cliente_id) {
    payload.cliente_id = String(data.cliente_id);
  }

  const result = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.INSTANCIAS}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeWacloudRecord(result);
}

/**
 * Atualiza status, token ou vínculo da instância no NocoDB
 */
export async function updateWacloudInstancia(
  idOrName: string | number,
  data: Partial<{
    status: string;
    token: string;
    ativo: boolean;
    cliente_id: string | number | null;
    nome_instancia: string;
  }>
): Promise<boolean> {
  const inst = await getWacloudInstanciaByIdOrName(idOrName);
  if (!inst?.Id) return false;

  const payload: any = { Id: inst.Id };
  if (data.status !== undefined) payload.status = data.status;
  if (data.token !== undefined) payload.token = data.token;
  if (data.ativo !== undefined) payload.ativo = Boolean(data.ativo);
  if (data.cliente_id !== undefined) payload.cliente_id = data.cliente_id ? String(data.cliente_id) : null;
  if (data.nome_instancia !== undefined) payload.nome_instancia = data.nome_instancia;

  await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.INSTANCIAS}/records`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return true;
}

// ==========================================
// ETIQUETAS (wacloud_etiquetas_instancia)
// ==========================================

/**
 * Busca etiquetas salvas no banco para uma instância
 */
export async function getWacloudEtiquetas(nomeInstancia?: string): Promise<any[]> {
  try {
    const where = nomeInstancia ? `?where=${encodeURIComponent(`(nome_instancia,eq,${nomeInstancia})`)}&limit=1000` : `?limit=1000`;
    const data = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.ETIQUETAS}/records${where}`);
    const list = data.list || [];
    return list.map(normalizeWacloudRecord);
  } catch (err) {
    console.error("Erro em getWacloudEtiquetas:", err);
    return [];
  }
}

/**
 * Salva etiqueta no NocoDB (evita duplicidade por uazapi_label_id)
 */
export async function saveWacloudEtiqueta(
  nomeInstancia: string,
  label: { uazapi_label_id: string; nome: string; cor_hex?: string }
): Promise<any> {
  const where = encodeURIComponent(
    `(nome_instancia,eq,${nomeInstancia})~and(uazapi_label_id,eq,${label.uazapi_label_id})`
  );
  const existing = await nocoRequest(
    `/api/v2/tables/${WACLOUD_TABLES.ETIQUETAS}/records?where=${where}&limit=1`
  );
  const record = existing.list?.[0];

  if (record) {
    const updated = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.ETIQUETAS}/records`, {
      method: "PATCH",
      body: JSON.stringify({
        Id: record.Id,
        nome: label.nome,
        cor_hex: label.cor_hex || "#94a3b8",
      }),
    });
    return normalizeWacloudRecord(updated);
  } else {
    const created = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.ETIQUETAS}/records`, {
      method: "POST",
      body: JSON.stringify({
        nome_instancia: nomeInstancia,
        uazapi_label_id: label.uazapi_label_id,
        nome: label.nome,
        cor_hex: label.cor_hex || "#94a3b8",
        created_at: new Date().toISOString(),
      }),
    });
    return normalizeWacloudRecord(created);
  }
}

// ==========================================
// CONTATOS / CONVERSAS (wacloud_contatos)
// ==========================================

/**
 * Busca contatos (conversas) ordenados por último timestamp
 */
export async function getWacloudContatos(options?: string | {
  nomeInstancia?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    const opts = typeof options === 'string' ? { nomeInstancia: options } : options;
    const filters: string[] = [];
    if (opts?.nomeInstancia) {
      filters.push(`(nome_instancia,eq,${opts.nomeInstancia})`);
    }

    const where = filters.length > 0 ? `where=${encodeURIComponent(filters.join("~and"))}&` : "";
    const limit = opts?.limit || 1000;
    const offset = opts?.offset || 0;

    const data = await nocoRequest(
      `/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records?${where}sort=-ultimo_timestamp&limit=${limit}&offset=${offset}`
    );
    const list = data.list || [];
    return list.map(normalizeWacloudRecord);
  } catch (err) {
    console.error("Erro em getWacloudContatos:", err);
    return [];
  }
}

/**
 * Busca um contato específico pelo telefone e nome de instância
 */
export async function getWacloudContato(nomeInstancia: string, telefone: string): Promise<any | null> {
  const cleanPhone = telefone.replace(/\D/g, "");
  try {
    const where = encodeURIComponent(
      `(nome_instancia,eq,${nomeInstancia})~and(telefone_contato,eq,${cleanPhone})`
    );
    const data = await nocoRequest(
      `/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records?where=${where}&limit=1`
    );
    const item = data.list?.[0];
    return item ? normalizeWacloudRecord(item) : null;
  } catch (err) {
    console.error("Erro em getWacloudContato:", err);
    return null;
  }
}

/**
 * Insere ou atualiza um contato no NocoDB
 */
export async function upsertWacloudContato(
  nomeInstancia: string,
  telefone: string,
  data: any
): Promise<any> {
  const cleanPhone = telefone.replace(/\D/g, "");
  const existing = await getWacloudContato(nomeInstancia, cleanPhone);

  const payload: any = {
    ...data,
    nome_instancia: nomeInstancia,
    telefone_contato: cleanPhone,
    atualizado_em: new Date().toISOString(),
  };

  if (existing?.Id) {
    payload.Id = existing.Id;
    const updated = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return normalizeWacloudRecord(updated);
  } else {
    if (!payload.created_at) {
      payload.created_at = new Date().toISOString();
    }
    const created = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return normalizeWacloudRecord(created);
  }
}

/**
 * Atualiza campos de um contato (ex: etiquetas, veículo, agendamento)
 */
export async function updateWacloudContato(
  idOrPhone: string | number,
  nomeInstancia: string,
  data: any
): Promise<boolean> {
  let existing: any = null;

  const isNum = !isNaN(Number(idOrPhone));
  if (isNum) {
    try {
      existing = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records/${idOrPhone}`);
    } catch {}
  }

  if (!existing?.Id) {
    existing = await getWacloudContato(nomeInstancia, String(idOrPhone));
  }

  if (!existing?.Id) return false;

  const payload = {
    ...data,
    Id: existing.Id,
    atualizado_em: new Date().toISOString(),
  };

  await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return true;
}

// ==========================================
// MENSAGENS (wacloud_mensagens)
// ==========================================

/**
 * Busca histórico de mensagens de um contato
 */
export async function getWacloudMensagens(
  telefone: string,
  nomeInstancia?: string,
  limit = 300
): Promise<any[]> {
  const cleanPhone = telefone.replace(/\D/g, "");
  try {
    let where = `(telefone_contato,eq,${cleanPhone})`;
    if (nomeInstancia) {
      where = `(nome_instancia,eq,${nomeInstancia})~and${where}`;
    }

    const data = await nocoRequest(
      `/api/v2/tables/${WACLOUD_TABLES.MENSAGENS}/records?where=${encodeURIComponent(where)}&sort=timestamp_whatsapp&limit=${limit}`
    );
    const list = data.list || [];
    return list.map(normalizeWacloudRecord);
  } catch (err) {
    console.error("Erro em getWacloudMensagens:", err);
    return [];
  }
}

/**
 * Salva uma nova mensagem no histórico do NocoDB
 */
export async function saveWacloudMensagem(data: {
  nome_instancia: string;
  telefone_contato: string;
  nome_contato?: string | null;
  mensagem?: string | null;
  enviado_por_mim?: boolean;
  tipo_mensagem?: string;
  url_midia?: string | null;
  mimetype?: string | null;
  message_id?: string | null;
  timestamp_whatsapp?: string;
  dados_anuncio?: any;
}): Promise<any> {
  const cleanPhone = data.telefone_contato.replace(/\D/g, "");
  const payload: any = {
    nome_instancia: data.nome_instancia,
    telefone_contato: cleanPhone,
    nome_contato: data.nome_contato || null,
    mensagem: data.mensagem || "",
    enviado_por_mim: Boolean(data.enviado_por_mim),
    tipo_mensagem: data.tipo_mensagem || "text",
    url_midia: data.url_midia || null,
    mimetype: data.mimetype || null,
    message_id: data.message_id || null,
    timestamp_whatsapp: data.timestamp_whatsapp || new Date().toISOString(),
    dados_anuncio: data.dados_anuncio || null,
    created_at: new Date().toISOString(),
  };

  const result = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.MENSAGENS}/records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeWacloudRecord(result);
}

/**
 * Salva lote de mensagens no histórico do NocoDB
 */
export async function saveWacloudMensagensBulk(mensagens: any[]): Promise<any[]> {
  if (!mensagens || mensagens.length === 0) return [];

  const payloads = mensagens.map((data) => ({
    nome_instancia: data.nome_instancia,
    telefone_contato: String(data.telefone_contato || "").replace(/\D/g, ""),
    nome_contato: data.nome_contato || null,
    mensagem: data.mensagem || "",
    enviado_por_mim: Boolean(data.enviado_por_mim),
    tipo_mensagem: data.tipo_mensagem || "text",
    url_midia: data.url_midia || null,
    mimetype: data.mimetype || null,
    message_id: data.message_id || null,
    timestamp_whatsapp: data.timestamp_whatsapp || new Date().toISOString(),
    dados_anuncio: data.dados_anuncio || null,
    created_at: data.created_at || new Date().toISOString(),
  }));

  try {
    const result = await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.MENSAGENS}/records`, {
      method: "POST",
      body: JSON.stringify(payloads),
    });
    const list = Array.isArray(result) ? result : [result];
    return list.map(normalizeWacloudRecord);
  } catch (err) {
    console.error("Erro ao salvar mensagens em lote no NocoDB:", err);
    return [];
  }
}
