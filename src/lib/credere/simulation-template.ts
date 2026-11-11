/**
 * src/lib/credere/simulation-template.ts
 *
 * Gerador do JSON de simulação formatado com tags dinâmicas do n8n.
 */

export interface SimulacaoConfig {
  webhook_url?: string;
  licensing_uf?: string;
  licensing_city?: string;
  zero_km?: boolean;
  min_return?: number;
  max_return?: number;
  bank_febraban_codes?: string[];
}

/**
 * Normaliza o código FEBRABAN para o padrão esperado no fluxo do n8n.
 * Ex: Banco Daycoval (707) é enviado como 'daycoval'.
 */
export function normalizeFebrabanCode(code: string | number): string {
  const strCode = String(code).trim().toLowerCase();
  if (strCode === '707' || strCode === 'daycoval') {
    return 'daycoval';
  }
  return String(code).trim();
}

/**
 * Extrai os parâmetros salvos dentro do texto do JSON salvo na coluna config_simulacao.
 */
export function parseSimulationConfigFromJson(raw: any): SimulacaoConfig {
  if (!raw) return {};

  let jsonStr = '';
  if (typeof raw === 'object') {
    if (raw.simulation) {
      jsonStr = JSON.stringify(raw);
    } else {
      return raw;
    }
  } else if (typeof raw === 'string') {
    jsonStr = raw;
  }

  const webhookMatch = jsonStr.match(/"webhook_url":\s*"([^"]*)"/);
  const ufMatch = jsonStr.match(/"licensing_uf":\s*"([^"]*)"/);
  const cityMatch = jsonStr.match(/"licensing_city":\s*"([^"]*)"/);
  const zeroKmMatch = jsonStr.match(/"zero_km":\s*(true|false)/);
  const minReturnMatch = jsonStr.match(/"min_return":\s*(\d+)/);
  const maxReturnMatch = jsonStr.match(/"max_return":\s*(\d+)/);

  // Match bank_febraban_codes
  const bankCodesMatch = jsonStr.match(/"bank_febraban_codes":\s*\[([\s\S]*?)\]/);
  let bankCodes: string[] = [];
  if (bankCodesMatch && bankCodesMatch[1]) {
    const rawItems = bankCodesMatch[1].match(/"([^"]+)"/g);
    if (rawItems) {
      bankCodes = rawItems.map(item => item.replace(/"/g, '').trim());
    }
  }

  return {
    webhook_url: webhookMatch ? webhookMatch[1] : '',
    licensing_uf: ufMatch ? ufMatch[1] : 'MG',
    licensing_city: cityMatch ? cityMatch[1] : '',
    zero_km: zeroKmMatch ? zeroKmMatch[1] === 'true' : false,
    min_return: minReturnMatch ? Number(minReturnMatch[1]) : 3,
    max_return: maxReturnMatch ? Number(maxReturnMatch[1]) : 6,
    bank_febraban_codes: bankCodes,
  };
}

/**
 * Gera a string do JSON pronto para a automação do n8n pegar direto do banco.
 */
export function generateN8nSimulationJson(config: SimulacaoConfig): string {
  const uf = (config.licensing_uf || 'MG').toUpperCase().trim();
  const city = (config.licensing_city || '').trim();
  const zeroKm = Boolean(config.zero_km);
  const minReturn = Number(config.min_return !== undefined && config.min_return !== null ? config.min_return : 3);
  const maxReturn = Number(config.max_return !== undefined && config.max_return !== null ? config.max_return : 6);
  const webhookUrl = (config.webhook_url || '').trim();

  // Códigos de bancos FEBRABAN
  const rawCodes = config.bank_febraban_codes && config.bank_febraban_codes.length > 0
    ? config.bank_febraban_codes
    : ['394', '655', '336', '341', '623', '033', 'daycoval'];

  const normalizedCodes = Array.from(new Set(rawCodes.map(normalizeFebrabanCode)));
  const bankCodesLines = normalizedCodes.map(code => `      "${code}"`).join(',\n');

  // Faixas de parcelas padrão: 12x, 24x, 36x, 48x, 60x
  const installments = [12, 24, 36, 48, 60];
  const conditionsBlocks = installments.map(inst => `  {
    "installments": ${inst},
    "down_payment": {{ $('normaliza_informacoes').item.json.valor_entrada }},
    "include_financial_protection_insurance": true,
    "products_options": {
      "include_capitalization_bond": true,
      "include_asset_insurance": false
    },
    "quota_preference": "max",
    "return_preference": "max",
    "min_return": ${minReturn},
    "max_return": ${maxReturn}
  }`).join(',\n');

  return `{
  "simulation": {
    "webhook_url": "${webhookUrl}",
    "process_bank_suggested_conditions": false,
    "seller_cpf": "{{ $json.users[0].cpf }}",
    "retrieve_lead": {
      "cpf_cnpj": "{{ $('normaliza_informacoes').item.json.cpf_cnpj }}"
    },
    "bank_febraban_codes": [
${bankCodesLines}
    ],
    "commercial": false,
    "vehicle": {
      "credere_vehicle_model_id": "{{ $('pesquisa_veiculo').item.json.vehicle_model.id }}",
      "licensing_uf": "${uf}",
      "licensing_city": "${city}",
      "manufacture_year": {{ $('pesquisa_veiculo_estoque').item.json.ano }},
      "model_year": {{ $('pesquisa_veiculo_estoque').item.json.ano }},
      "asset_value": {{ $('valor_venda_veiculo').item.json.valor_venda }},
      "zero_km": ${zeroKm}
    },
    "conditions": [
${conditionsBlocks}
    ]
  }
}`;
}

/**
 * Atualiza automaticamente o JSON na coluna config_simulacao do cliente no NocoDB
 * buscando os bancos ativos em tempo real na Credere.
 */
export async function syncClientSimulationJson(clientId: string | number, storeId?: string | number): Promise<string | null> {
  try {
    const { getNocoDBClienteById, updateNocoDBCliente } = await import('@/lib/nocodb/sistema');
    const { getStoreBanks } = await import('@/lib/credere/api');

    const client = await getNocoDBClienteById(clientId);
    if (!client) return null;

    const resolvedStoreId = storeId || client.credere_store_id;
    if (!resolvedStoreId) return null;

    // 1. Busca os bancos configurados na Credere
    const storeBanksData = await getStoreBanks(resolvedStoreId);
    const configuredCodes = (storeBanksData.bancos || [])
      .filter(b => b.status !== 'none')
      .map(b => normalizeFebrabanCode(b.code));

    // 2. Extrai parâmetros existentes ou defaults
    const existingConfig = parseSimulationConfigFromJson(client.config_simulacao);

    const updatedConfig: SimulacaoConfig = {
      webhook_url: existingConfig.webhook_url || '',
      licensing_uf: existingConfig.licensing_uf || 'MG',
      licensing_city: existingConfig.licensing_city || '',
      zero_km: existingConfig.zero_km || false,
      min_return: existingConfig.min_return ?? 3,
      max_return: existingConfig.max_return ?? 6,
      bank_febraban_codes: Array.from(new Set(configuredCodes)),
    };

    const newJson = generateN8nSimulationJson(updatedConfig);

    await updateNocoDBCliente(clientId, {
      config_simulacao: newJson,
    });

    return newJson;
  } catch (err) {
    console.warn('Aviso ao sincronizar JSON de simulação do cliente:', err);
    return null;
  }
}
