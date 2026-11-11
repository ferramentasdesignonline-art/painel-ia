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
  SEMIA_CONTATOS: "mkl3zt6yi1t3t7s",
  SEMIA_MENSAGENS: "m3a9kycoynmp6dv",
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

    // 4. Fallback: Se não encontrou ou não tem token, busca na tabela de clientes do Sistema Dash IA
    try {
      const { getNocoDBClientes } = await import('@/lib/nocodb/sistema');
      const allClients = await getNocoDBClientes();
      const matchedClient = allClients.find(
        (c) =>
          (c.nome_instancia && c.nome_instancia.trim().toLowerCase() === str.toLowerCase()) ||
          String(c.id) === str ||
          String(c.Id) === str
      );
      if (matchedClient?.whatsapp_token) {
        return {
          id: matchedClient.id || matchedClient.Id,
          nome_instancia: matchedClient.nome_instancia || str,
          token: matchedClient.whatsapp_token,
          status: 'connected',
          ativo: true,
          cliente_id: matchedClient.id || matchedClient.Id,
        };
      }
    } catch {
      // ignore
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

/**
 * Reconcilia e sincroniza as etiquetas de uma instância no NocoDB com o WhatsApp/Uazapi:
 * - Insere novas etiquetas criadas no WhatsApp
 * - Atualiza nomes e cores alterados
 * - Remove etiquetas que foram excluídas no WhatsApp
 */
export async function reconciliarWacloudEtiquetas(
  nomeInstancia: string,
  uazapiLabels: any[]
): Promise<any[]> {
  if (!nomeInstancia || !Array.isArray(uazapiLabels)) return [];
  try {
    const existing = await getWacloudEtiquetas(nomeInstancia);
    const existingMap = new Map<string, any>();
    for (const row of existing) {
      if (row.uazapi_label_id) existingMap.set(String(row.uazapi_label_id), row);
    }

    const uazMap = new Map<string, any>();
    for (const u of uazapiLabels) {
      const id = String(u.labelid || u.id || "");
      if (id) uazMap.set(id, u);
    }

    // 1. Identificar excluídas
    const toDelete: any[] = [];
    for (const [id, row] of existingMap.entries()) {
      if (!uazMap.has(id)) {
        toDelete.push({ Id: row.Id || row.id });
      }
    }
    if (toDelete.length > 0) {
      await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.ETIQUETAS}/records`, {
        method: "DELETE",
        body: JSON.stringify(toDelete),
      }).catch(err => console.warn("Erro ao deletar etiquetas obsoletas:", err));
    }

    // 2. Identificar novas e a atualizar
    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const [id, u] of uazMap.entries()) {
      const nome = u.name || "Sem Nome";
      const cor = u.colorHex || "#6366f1";
      if (!existingMap.has(id)) {
        toInsert.push({
          nome_instancia: nomeInstancia,
          uazapi_label_id: id,
          nome,
          cor_hex: cor,
          created_at: new Date().toISOString(),
        });
      } else {
        const row = existingMap.get(id);
        if (row.nome !== nome || row.cor_hex !== cor) {
          toUpdate.push({
            Id: row.Id || row.id,
            nome,
            cor_hex: cor,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 50) {
        await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.ETIQUETAS}/records`, {
          method: "POST",
          body: JSON.stringify(toInsert.slice(i, i + 50)),
        }).catch(err => console.warn("Erro ao inserir novas etiquetas:", err));
      }
    }

    if (toUpdate.length > 0) {
      for (let i = 0; i < toUpdate.length; i += 50) {
        await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.ETIQUETAS}/records`, {
          method: "PATCH",
          body: JSON.stringify(toUpdate.slice(i, i + 50)),
        }).catch(err => console.warn("Erro ao atualizar etiquetas:", err));
      }
    }

    return await getWacloudEtiquetas(nomeInstancia);
  } catch (err) {
    console.error("Erro em reconciliarWacloudEtiquetas:", err);
    return [];
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
  const cleanPhone = String(telefone).replace(/@.*$/, '').replace(/\D/g, "");
  try {
    const where = encodeURIComponent(
      `(nome_instancia,eq,${nomeInstancia})~and(telefone_contato,eq,${cleanPhone})`
    );
    const data = await nocoRequest(
      `/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records?where=${where}&limit=5`
    );
    const list = data.list || [];
    if (list.length > 1) {
      // Se tiver mais de um, mantém o primeiro e remove os duplicados
      const [first, ...rest] = list;
      const idsToDelete = rest.map((r: any) => ({ Id: r.Id || r.id }));
      nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records`, {
        method: "DELETE",
        body: JSON.stringify(idsToDelete),
      }).catch(() => {});
      return normalizeWacloudRecord(first);
    }
    return list[0] ? normalizeWacloudRecord(list[0]) : null;
  } catch (err) {
    console.error("Erro em getWacloudContato:", err);
    return null;
  }
}

/**
 * Insere ou atualiza múltiplos contatos no NocoDB em lote (batch), com proteção absoluta contra duplicação:
 * 1. Mapeia todos os contatos existentes por telefone limpo
 * 2. Remove qualquer duplicata existente
 * 3. Divide em toPatch (já existem) e toInsert (novos)
 * 4. Executa em lote (batch) de forma rápida e segura
 */
export async function batchUpsertWacloudContatos(
  nomeInstancia: string,
  contatos: any[]
): Promise<void> {
  if (!nomeInstancia || !Array.isArray(contatos) || contatos.length === 0) return;

  // Deduplicação em memória da lista de entrada
  const uniqueInputMap = new Map<string, any>();
  for (const c of contatos) {
    const rawTel = c.telefone_contato || c.telefone || c.wa_chatid || "";
    const clean = String(rawTel).replace(/@.*$/, "").replace(/\D/g, "");
    if (!clean) continue;
    uniqueInputMap.set(clean, { ...c, telefone_contato: clean });
  }

  // Busca contatos existentes dessa instância no NocoDB
  const existing = await getWacloudContatos({ nomeInstancia, limit: 2000 });
  const existingByPhone = new Map<string, any>();
  const duplicatesToDelete: any[] = [];

  for (const row of existing) {
    const rawTel = row.telefone_contato || "";
    const clean = String(rawTel).replace(/@.*$/, "").replace(/\D/g, "");
    if (!clean) continue;

    if (!existingByPhone.has(clean)) {
      existingByPhone.set(clean, row);
    } else {
      duplicatesToDelete.push({ Id: row.Id || row.id });
    }
  }

  // Deleta duplicatas encontradas no banco
  if (duplicatesToDelete.length > 0) {
    await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records`, {
      method: "DELETE",
      body: JSON.stringify(duplicatesToDelete),
    }).catch(err => console.warn("Erro ao deletar contatos duplicados:", err));
  }

  const toPatch: any[] = [];
  const toInsert: any[] = [];

  for (const [phone, data] of uniqueInputMap.entries()) {
    const nowIso = new Date().toISOString();
    const payload = {
      ...data,
      nome_instancia: nomeInstancia,
      telefone_contato: phone,
      atualizado_em: nowIso,
    };

    if (existingByPhone.has(phone)) {
      const existingRow = existingByPhone.get(phone);
      toPatch.push({
        ...payload,
        Id: existingRow.Id || existingRow.id,
      });
    } else {
      toInsert.push({
        ...payload,
        created_at: payload.created_at || nowIso,
      });
    }
  }

  // Executa PATCH em lote
  if (toPatch.length > 0) {
    for (let i = 0; i < toPatch.length; i += 50) {
      await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records`, {
        method: "PATCH",
        body: JSON.stringify(toPatch.slice(i, i + 50)),
      }).catch(err => console.warn("Erro em batch PATCH contatos:", err));
    }
  }

  // Executa POST em lote
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 50) {
      await nocoRequest(`/api/v2/tables/${WACLOUD_TABLES.CONTATOS}/records`, {
        method: "POST",
        body: JSON.stringify(toInsert.slice(i, i + 50)),
      }).catch(err => console.warn("Erro em batch POST contatos:", err));
    }
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
  const cleanPhone = String(telefone).replace(/@.*$/, '').replace(/\D/g, "");
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
  limit = 300,
  tableName?: string
): Promise<any[]> {
  const cleanPhone = telefone ? telefone.replace(/\D/g, "") : "";
  const tableId = tableName === 'semia_mensagens' || tableName === WACLOUD_TABLES.SEMIA_MENSAGENS
    ? (WACLOUD_TABLES.SEMIA_MENSAGENS || "m3a9kycoynmp6dv")
    : (tableName === 'wacloud_mensagens' ? WACLOUD_TABLES.MENSAGENS : (tableName || WACLOUD_TABLES.MENSAGENS));

  try {
    const filters: string[] = [];
    if (nomeInstancia) {
      const cleanInstancia = nomeInstancia.replace(/\s+/g, "");
      filters.push(`(nome_instancia,like,%${cleanInstancia}%)`);
    }
    if (cleanPhone) {
      const phoneDigits = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;
      filters.push(`(telefone_contato,like,%${phoneDigits}%)`);
    }

    const where = filters.length > 0 ? `where=${encodeURIComponent(filters.join("~and"))}&` : "";
    const sortField = tableId === (WACLOUD_TABLES.SEMIA_MENSAGENS || "m3a9kycoynmp6dv") ? "Id" : "timestamp_whatsapp";

    const data = await nocoRequest(
      `/api/v2/tables/${tableId}/records?${where}sort=${sortField}&limit=${limit}`
    );
    let list = data.list || [];
    if (list.length === 0 && tableId !== WACLOUD_TABLES.MENSAGENS) {
      // Fallback para tabela de mensagens geral caso não encontre
      const dataFallback = await nocoRequest(
        `/api/v2/tables/${WACLOUD_TABLES.MENSAGENS}/records?${where}sort=timestamp_whatsapp&limit=${limit}`
      );
      list = dataFallback.list || [];
    }
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
}, targetTable?: string): Promise<any> {
  const cleanPhone = String(data.telefone_contato).replace(/@.*$/, "").replace(/\D/g, "");
  const tableId = targetTable === 'semia_mensagens' || targetTable === WACLOUD_TABLES.SEMIA_MENSAGENS
    ? (WACLOUD_TABLES.SEMIA_MENSAGENS || "m3a9kycoynmp6dv")
    : WACLOUD_TABLES.MENSAGENS;

  // Previne duplicações de mensagens pelo message_id
  if (data.message_id) {
    try {
      const cleanInstancia = data.nome_instancia ? data.nome_instancia.replace(/\s+/g, "") : "";
      const whereCheck = encodeURIComponent(`(nome_instancia,like,%${cleanInstancia}%)~and(message_id,eq,${data.message_id})`);
      const existing = await nocoRequest(`/api/v2/tables/${tableId}/records?where=${whereCheck}&limit=1`);
      if (existing?.list?.length > 0) {
        return normalizeWacloudRecord(existing.list[0]);
      }
    } catch {}
  }

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

  const result = await nocoRequest(`/api/v2/tables/${tableId}/records`, {
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
