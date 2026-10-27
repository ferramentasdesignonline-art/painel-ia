import { WACLOUD_CONFIG } from './config';
import { getWacloudSupabaseAdmin } from './supabase';

/**
 * Cria a instância na Uazapi, configura o webhook e salva em wacloud_instancias.
 * Se clienteId for informado, a instância fica vinculada ao cliente do SaaS.
 */
export async function createWacloudInstance(nomeInstancia: string, clienteId?: string) {
  const uazapiRes = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', admintoken: WACLOUD_CONFIG.uazapiAdminToken },
    body: JSON.stringify({ name: nomeInstancia }),
  });
  const uazapiData = await uazapiRes.json().catch(() => null);

  if (!uazapiRes.ok || !uazapiData?.instance?.name) {
    console.error('Uazapi create error:', uazapiData);
    throw new Error('Erro ao criar instância na Uazapi');
  }

  const instanceToken = uazapiData.instance.token;

  const webhookRes = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: instanceToken },
    body: JSON.stringify({
      enabled: true,
      url: WACLOUD_CONFIG.webhookUrl,
      events: ['messages'],
      excludeMessages: ['wasSentByApi', 'isGroupYes'],
    }),
  });
  if (!webhookRes.ok) {
    console.warn('Erro ao configurar webhook:', await webhookRes.json().catch(() => null));
  }

  // 1. Salvar no NocoDB (WaCloud)
  let nocoRow: any = null;
  try {
    const { createWacloudInstancia } = await import('@/lib/nocodb/wacloud');
    nocoRow = await createWacloudInstancia({
      nome_instancia: nomeInstancia,
      status: 'criada',
      token: instanceToken,
      cliente_id: clienteId || null,
      ativo: true,
    });
  } catch (nocoErr) {
    console.warn("Aviso ao salvar instância no NocoDB:", nocoErr);
  }

  // 2. Sincronizar no Supabase
  let sbRow: any = null;
  try {
    const supabase = getWacloudSupabaseAdmin();
    const { data } = await supabase
      .from('wacloud_instancias')
      .insert({
        nome_instancia: nomeInstancia,
        status: 'criada',
        token: instanceToken,
        ...(clienteId ? { cliente_id: clienteId, ativo: true } : {}),
      })
      .select()
      .single();
    sbRow = data;
  } catch (sbErr) {
    console.warn("Aviso ao salvar instância no Supabase:", sbErr);
  }

  return { instance: uazapiData.instance, row: nocoRow || sbRow };
}

/** Busca uma página de chats na Uazapi (ordenados do mais recente para o mais antigo). */
export async function fetchUazapiChats(token: string, offset: number, limit = 50, extraParams: Record<string, any> = {}) {
  const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/find`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      token,
    },
    body: JSON.stringify({ sort: '-wa_lastMsgTimestamp', limit, offset, wa_isGroup: false, ...extraParams }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Uazapi chat/find falhou (${res.status}): ${JSON.stringify(data)}`);
  }
  return data as {
    chats: any[];
    pagination?: { limit: number; offset: number; totalRecords: number };
  };
}

/** Busca uma página de mensagens de um chat na Uazapi */
export async function fetchUazapiMessages(token: string, chatid: string, offset: number, limit = 50) {
  const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/message/find`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      token,
    },
    body: JSON.stringify({ chatid, limit, offset }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Uazapi message/find falhou (${res.status}): ${JSON.stringify(data)}`);
  }
  return data as {
    messages: any[];
    hasMore: boolean;
    limit: number;
    offset: number;
    nextOffset: number | null;
    returnedMessages: number;
  };
}
export async function fetchUazapiLabels(token: string) {
  const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/labels`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      token,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.warn(`Uazapi labels falhou (${res.status})`);
    return [];
  }
  const data = await res.json().catch(() => []);
  return data as any[];
}
