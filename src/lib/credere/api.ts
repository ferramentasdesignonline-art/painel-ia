/**
 * src/lib/credere/api.ts
 *
 * Módulo de comunicação seguro e backend-only com a API oficial da Credere.
 * Preserva tokens, isola lojas e sanitiza respostas.
 */

import {
  BankCatalogItem,
  BankWithStatus,
  CredereStore,
  CredereSummary,
  CredereBankFieldsResponse,
  CredereSimulation,
  CredereSimulationsPaging,
} from './types';

const CREDERE_API_URL = (process.env.CREDERE_API_URL || 'https://app.meucredere.com.br/api/v1').replace(/\/+$/, '');
const CREDERE_API_TOKEN = process.env.CREDERE_API_TOKEN || '8ocRnUvk0sJ7634b3_ra5FBoktUKvknC4sqyaGrx5f4';

/**
 * Catálogo base oficial de instituições bancárias parceiras da Credere.
 * Códigos preservados como strings (inclusive zeros à esquerda como "033").
 */
export const OFFICIAL_BANKS_CATALOG: BankCatalogItem[] = [
  { code: '623', name: 'Banco Pan S.A.', tradename: 'Pan', display_name: 'Banco Pan', color: '#0083CA' },
  { code: '655', name: 'Banco Votorantim S.A.', tradename: 'BV', display_name: 'BV Financeira', color: '#0B2046' },
  { code: '033', name: 'Banco Santander (Brasil) S.A.', tradename: 'Santander', display_name: 'Santander', color: '#CC0000' },
  { code: '394', name: 'Banco Bradesco Financiamentos S.A.', tradename: 'Bradesco', display_name: 'Bradesco', color: '#CC092F' },
  { code: '341', name: 'Itaú Unibanco S.A.', tradename: 'Itaú', display_name: 'Itaú Financiamentos', color: '#EC7000' },
  { code: '342', name: 'Creditas Sociedade de Crédito Direto', tradename: 'Creditas', display_name: 'Creditas Auto', color: '#00B140' },
  { code: '422', name: 'Banco Safra S.A.', tradename: 'Safra', display_name: 'Safra Financeira', color: '#1B2C42' },
  { code: '336', name: 'Banco C6 S.A.', tradename: 'C6 Bank', display_name: 'C6 Bank Auto', color: '#242424' },
  { code: 'M22', name: 'Banco Honda S.A.', tradename: 'Honda', display_name: 'Banco Honda', color: '#D40000' },
  { code: 'M14', name: 'Banco Volkswagen S.A.', tradename: 'Volkswagen', display_name: 'Banco Volkswagen', color: '#001E50' },
  { code: 'YHA', name: 'Banco Yamaha Motor do Brasil S.A.', tradename: 'Yamaha', display_name: 'Banco Yamaha', color: '#003DA5' },
  { code: 'fontecred', name: 'Fontecred Soluções Financeiras', tradename: 'Fontecred', display_name: 'Fontecred', color: '#1E3A8A' },
  { code: 'moneyplus', name: 'AutoBanking / Money Plus', tradename: 'AutoBanking', display_name: 'AutoBanking', color: '#059669' },
  { code: 'kuna', name: 'Kuna Capital Financeira', tradename: 'Kuna Capital', display_name: 'Kuna Capital', color: '#7C3AED' },
  { code: 'carbank', name: 'Carbank Soluções Automotivas', tradename: 'Carbank', display_name: 'Carbank', color: '#D97706' },
];

/**
 * Executa requisições autenticadas à API da Credere
 */
async function credereFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${CREDERE_API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Authorization': `Bearer ${CREDERE_API_TOKEN}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let cleanMessage = errorText || `Erro na API Credere (${res.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed?.error?.message) {
        cleanMessage = parsed.error.message;
        if (parsed.error.details && typeof parsed.error.details === 'object') {
          const detailsList = Object.entries(parsed.error.details).map(([field, errs]: any) => {
            const msg = Array.isArray(errs) ? errs.map((e: any) => e.error || e.message || String(e)).join(', ') : String(errs);
            return `${field}: ${msg}`;
          });
          if (detailsList.length > 0) {
            cleanMessage += ` (${detailsList.join('; ')})`;
          }
        }
      }
    } catch {}

    const errObj = {
      status: res.status,
      statusText: res.statusText,
      url,
      message: cleanMessage,
      raw: errorText,
    };
    throw errObj;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  return null;
}

/**
 * Consulta todas as lojas vinculadas à conta Credere (com paginação completa)
 * Utilizado pelo Painel Master para associar o lojista ao seu respectivo store_id
 */
export async function listCredereStores(): Promise<CredereStore[]> {
  try {
    const allStoresRaw: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${CREDERE_API_URL}/stores?page=${page}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${CREDERE_API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Erro na API Credere ao listar lojas (página ${page}): ${errText}`);
      }

      const data = await res.json();
      const pageStores = data?.stores || [];

      if (!Array.isArray(pageStores) || pageStores.length === 0) {
        hasMore = false;
        break;
      }

      allStoresRaw.push(...pageStores);

      // Interpreta paginação do header 'paging' da Credere (Pagy)
      const pagingHeader = res.headers.get('paging');
      if (pagingHeader) {
        try {
          const paging = JSON.parse(pagingHeader);
          if (!paging.next || page >= paging.pages) {
            hasMore = false;
            break;
          }
        } catch {
          // Se falhar o parse do JSON de paging, continua se veio registros
        }
      } else {
        // Se a API não mandou paging e veio menos de 10, terminou
        if (pageStores.length < 10) {
          hasMore = false;
          break;
        }
      }

      page++;
      if (page > 50) break; // Proteção contra loops infinitos
    }

    const mappedStores: CredereStore[] = allStoresRaw.map((s: any) => ({
      id: Number(s.id),
      name: s.name || s.display_name || `Loja ${s.id}`,
      display_name: s.display_name || s.name,
      cnpj: s.cnpj,
      uf: s.uf,
      city: s.city,
      active: Boolean(s.active && s.account_active !== false),
    }));

    // Ordenação alfabética pelo nome da loja para facilitar a localização
    mappedStores.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    return mappedStores;
  } catch (err: any) {
    console.error('[Credere API] Erro ao listar lojas:', err.message || err);
    throw err;
  }
}

/**
 * Consulta os bancos integrados de uma loja específica e combina com o catálogo oficial
 */
export async function getStoreBanks(storeId: string | number): Promise<{
  bancos: BankWithStatus[];
  resumo: CredereSummary;
  ultima_sincronizacao: string;
}> {
  const cleanStoreId = String(storeId).trim();
  if (!cleanStoreId) {
    throw new Error('ID da loja Credere não informado');
  }

  let credereBanks: any[] = [];
  try {
    const data = await credereFetch(`/stores/${cleanStoreId}/integrated_banks`);
    if (data?.banks && Array.isArray(data.banks)) {
      credereBanks = data.banks;
    }
  } catch (err: any) {
    console.error(`[Credere API] Erro ao buscar integrated_banks para loja ${cleanStoreId}:`, err);
    throw err;
  }

  // Mapa dos bancos retornados pela Credere indexados pelo código (string)
  const credereMap = new Map<string, any>();
  for (const b of credereBanks) {
    if (b.code) {
      credereMap.set(String(b.code).trim(), b);
    }
  }

  const finalBanks: BankWithStatus[] = [];
  const processedCodes = new Set<string>();

  // 1. Processar bancos do catálogo oficial
  for (const catalogItem of OFFICIAL_BANKS_CATALOG) {
    const code = catalogItem.code;
    processedCodes.add(code);

    const credereData = credereMap.get(code);
    let status: 'okay' | 'unauthorized' | 'not_analyzed' | 'inactive' | 'none' = 'none';
    let statusLabel = 'Não conectado';
    let bankCred = null;
    let lastChecked = null;

    if (credereData?.bank_credential) {
      const bc = credereData.bank_credential;
      bankCred = {
        bank_integration_version: bc.bank_integration_version || 'v2',
        active: bc.active !== false,
        status: bc.status || 'not_analyzed',
        status_updated_at: bc.status_updated_at || null,
        is_shared: Boolean(bc.is_shared || bc.shared_from_store),
        shared_from_store: bc.shared_from_store || null,
      };

      lastChecked = bc.status_updated_at || null;

      if (bc.active === false) {
        status = 'inactive';
        statusLabel = 'Inativo';
      } else if (bc.status === 'okay') {
        status = 'okay';
        statusLabel = 'Conectado';
      } else if (bc.status === 'unauthorized') {
        status = 'unauthorized';
        statusLabel = 'Credencial inválida';
      } else if (bc.status === 'not_analyzed') {
        status = 'not_analyzed';
        statusLabel = 'Em verificação';
      } else {
        status = 'not_analyzed';
        statusLabel = 'Em verificação';
      }
    }

    finalBanks.push({
      ...catalogItem,
      name: credereData?.name || catalogItem.name,
      tradename: credereData?.tradename || catalogItem.tradename,
      display_name: credereData?.display_name || catalogItem.display_name,
      status,
      statusLabel,
      bank_credential: bankCred,
      last_checked_at: lastChecked,
    });
  }

  // 2. Incorporar novos bancos que vieram da Credere mas não estavam no catálogo local
  for (const [code, credereData] of Array.from(credereMap.entries())) {
    // Ignorar bancos descontinuados (ex.: Omni)
    if (code.toUpperCase() === 'OMNI' || (credereData.name || '').toLowerCase().includes('omni')) {
      continue;
    }

    if (!processedCodes.has(code)) {
      const bc = credereData.bank_credential;
      let status: 'okay' | 'unauthorized' | 'not_analyzed' | 'inactive' | 'none' = 'none';
      let statusLabel = 'Não conectado';
      let bankCred = null;

      if (bc) {
        bankCred = {
          bank_integration_version: bc.bank_integration_version || 'v1',
          active: bc.active !== false,
          status: bc.status || 'not_analyzed',
          status_updated_at: bc.status_updated_at || null,
          is_shared: Boolean(bc.is_shared),
        };
        if (bc.active === false) {
          status = 'inactive';
          statusLabel = 'Inativo';
        } else if (bc.status === 'okay') {
          status = 'okay';
          statusLabel = 'Conectado';
        } else if (bc.status === 'unauthorized') {
          status = 'unauthorized';
          statusLabel = 'Credencial inválida';
        } else {
          status = 'not_analyzed';
          statusLabel = 'Em verificação';
        }
      }

      finalBanks.push({
        code,
        name: credereData.name || `Banco ${code}`,
        tradename: credereData.tradename || credereData.name || `Banco ${code}`,
        display_name: credereData.display_name || credereData.tradename,
        status,
        statusLabel,
        bank_credential: bankCred,
        last_checked_at: bc?.status_updated_at || null,
        active_in_catalog: true,
      });
    }
  }

  // Ordenação: primeiro Conectados, depois Credencial Inválida, Em verificação, e por fim Não conectados
  const statusWeight: Record<string, number> = {
    okay: 1,
    unauthorized: 2,
    not_analyzed: 3,
    inactive: 4,
    none: 5,
  };

  finalBanks.sort((a, b) => {
    const wa = statusWeight[a.status] || 99;
    const wb = statusWeight[b.status] || 99;
    if (wa !== wb) return wa - wb;
    return a.tradename.localeCompare(b.tradename);
  });

  // Cálculo dos indicadores
  const resumo: CredereSummary = {
    conectados: finalBanks.filter((b) => b.status === 'okay').length,
    invalidos: finalBanks.filter((b) => b.status === 'unauthorized').length,
    em_verificacao: finalBanks.filter((b) => b.status === 'not_analyzed').length,
    inativos: finalBanks.filter((b) => b.status === 'inactive').length,
    sem_credencial: finalBanks.filter((b) => b.status === 'none').length,
    total: finalBanks.length,
  };

  return {
    bancos: finalBanks,
    resumo,
    ultima_sincronizacao: new Date().toISOString(),
  };
}

/**
 * Consulta campos necessários para cadastrar/atualizar credenciais de um banco
 */
export async function getBankFields(
  storeId: string | number,
  febrabanCode: string,
  version?: string
): Promise<CredereBankFieldsResponse> {
  const cleanStoreId = String(storeId).trim();
  const cleanCode = String(febrabanCode).trim();
  const queryParam = version ? `?bank_integration_version=${encodeURIComponent(version)}` : '';

  try {
    const data = await credereFetch(`/stores/${cleanStoreId}/bank_credentials/${cleanCode}/fields${queryParam}`);

    const versionsList: string[] = Array.isArray(data?.versions)
      ? data.versions.map((v: any) => v.bank_integration_version).filter(Boolean)
      : (data?.bank_integration_versions || []);

    // Bancos que operam prioritariamente em modo BPO (v2: Usuário e Senha)
    const BPO_BANKS = ['655', '394', '623', '033', 'M22'];
    const prefersBpo = BPO_BANKS.includes(cleanCode);

    // Determina a versão alvo (prioriza a versão solicitada, ou v2 se disponível para bancos BPO, ou a primeira)
    let targetVersion = version;
    if (!targetVersion) {
      if (prefersBpo && versionsList.includes('v2')) {
        targetVersion = 'v2';
      } else if (versionsList.includes('v2')) {
        targetVersion = 'v2';
      } else if (versionsList.length > 0) {
        targetVersion = versionsList[0];
      } else {
        targetVersion = 'v1';
      }
    }

    let fields = [];
    if (Array.isArray(data?.versions)) {
      const match = data.versions.find((v: any) => v.bank_integration_version === targetVersion) || data.versions[0];
      fields = match?.fields || [];
      if (match?.bank_integration_version) {
        targetVersion = match.bank_integration_version;
      }
    } else {
      fields = data?.fields || [];
    }

    // Ordena versões disponíveis para apresentar BPO (v2) primeiro quando disponível
    const sortedVersions = [...versionsList].sort((a, b) => {
      if (a === 'v2') return -1;
      if (b === 'v2') return 1;
      return a.localeCompare(b);
    });

    return {
      bank_integration_versions: sortedVersions.length > 0 ? sortedVersions : ['v2', 'v1'],
      current_version: targetVersion,
      fields,
    };
  } catch (err: any) {
    console.error(`[Credere API] Erro ao consultar fields do banco ${cleanCode}:`, err);
    throw err;
  }
}

/**
 * Envia ou atualiza credenciais bancárias de uma loja na Credere
 */
export async function saveBankCredential(
  storeId: string | number,
  febrabanCode: string,
  payload: any,
  version?: string
): Promise<any> {
  const cleanStoreId = String(storeId).trim();
  const cleanCode = String(febrabanCode).trim();
  const queryParam = version ? `?bank_integration_version=${encodeURIComponent(version)}` : '';

  // Formata o payload para o formato exigido pela API da Credere: { credential_data: { ... } }
  let credentialData = payload;
  if (payload && typeof payload === 'object') {
    if (payload.credential_data) {
      credentialData = payload.credential_data;
    } else if (payload.bank_credential?.credential_data) {
      credentialData = payload.bank_credential.credential_data;
    }
  }

  const finalBody = {
    credential_data: credentialData,
  };

  try {
    const data = await credereFetch(`/stores/${cleanStoreId}/bank_credentials/${cleanCode}${queryParam}`, {
      method: 'PUT',
      body: JSON.stringify(finalBody),
    });
    return data;
  } catch (err: any) {
    console.error(`[Credere API] Erro ao salvar credencial do banco ${cleanCode}:`, err);
    throw err;
  }
}

/**
 * Consulta as simulações de financiamento da loja na Credere
 * Endpoint oficial: GET /api/v1/proposal_simulations?store_id={store_id}
 */
export async function listStoreSimulations(
  storeId: string | number,
  options: {
    page?: number;
    per_page?: number;
    customer?: string;
    sort?: string;
    after?: string;
    before?: string;
    bank_code?: string;
  } = {}
): Promise<{
  simulations: CredereSimulation[];
  paging: CredereSimulationsPaging | null;
  total: number;
}> {
  const cleanStoreId = String(storeId).trim();
  const params = new URLSearchParams();
  // A API Credere aceita o filtro de loja como store_ids[]
  params.set('store_ids[]', cleanStoreId);
  params.set('store_id', cleanStoreId);

  if (options.page) params.set('page', String(options.page));
  if (options.per_page) params.set('per_page', String(options.per_page));
  if (options.customer) params.set('customer', options.customer);
  if (options.sort) params.set('sort', options.sort);
  if (options.after) params.set('after', options.after);
  if (options.before) params.set('before', options.before);
  if (options.bank_code) params.set('bank_codes[]', options.bank_code);

  const url = `${CREDERE_API_URL}/proposal_simulations?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CREDERE_API_TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Erro na API Credere ao listar simulações (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rawList: CredereSimulation[] = data.data || [];

  // Dupla proteção: garante que somente simulações pertencentes à loja solicitada sejam retornadas
  const simulations: CredereSimulation[] = rawList.filter((s: any) => {
    const sId = s.payload?.store_id || s.lead?.payload?.store_id;
    if (sId !== undefined && sId !== null) {
      return String(sId) === cleanStoreId;
    }
    return true;
  });

  let paging: CredereSimulationsPaging | null = null;
  const pagingHeader = res.headers.get('paging');
  if (pagingHeader) {
    try {
      paging = JSON.parse(pagingHeader);
    } catch {
      // ignore
    }
  }

  const total = paging?.count !== undefined ? paging.count : simulations.length;

  return {
    simulations,
    paging,
    total,
  };
}
