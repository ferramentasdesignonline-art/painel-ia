import { getWacloudSupabaseAdmin } from './supabase';
import { fetchUazapiLabels } from './uazapi';

function normalizeStr(str: string) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export type UazapiLabelItem = {
  id: string;
  labelid: string;
  name: string;
  colorHex: string;
  color?: number;
};

export async function getClientWhatsappLabelsData(clientConfig: any): Promise<{
  mapaWhatsappLabels: Map<string, string[]>;
  mapaNomes: Map<string, string>;
  mapaUazapiLabels: Map<string, UazapiLabelItem>;
}> {
  const mapaWhatsappLabels = new Map<string, string[]>();
  const mapaNomes = new Map<string, string>();
  const mapaUazapiLabels = new Map<string, UazapiLabelItem>();

  try {
    const wacloudAdmin = getWacloudSupabaseAdmin();

    const nomeNorm = normalizeStr(clientConfig.nome);
    const slugNorm = normalizeStr(clientConfig.slug || '');
    const instConfigNorm = normalizeStr(clientConfig.nome_instancia || clientConfig.whatsapp_instancia || '');

    const { data: instancias } = await wacloudAdmin
      .from('wacloud_instancias')
      .select('id, nome_instancia, token')
      .limit(50);

    let instanciaMatch = instConfigNorm
      ? instancias?.find(i => normalizeStr(i.nome_instancia) === instConfigNorm)
      : null;

    if (!instanciaMatch) {
      instanciaMatch = instancias?.find(i => {
        const instNorm = normalizeStr(i.nome_instancia);
        return instNorm === nomeNorm || instNorm === slugNorm;
      });
    }

    if (!instanciaMatch) {
      instanciaMatch = instancias?.find(i => {
        const instNorm = normalizeStr(i.nome_instancia);
        return instNorm.includes(nomeNorm) || nomeNorm.includes(instNorm);
      });
    }

    if (instanciaMatch) {
      const nomeInstancia = instanciaMatch.nome_instancia;

      // 1. Carregar contatos com etiquetas da instância
      let allContatosCloud: any[] = [];
      const pageSize = 1000;
      let page = 0;
      while (page < 10) {
        const { data: chunk, error: chunkErr } = await wacloudAdmin
          .from('wacloud_contatos')
          .select('telefone_contato, whatsapp_labels')
          .eq('nome_instancia', nomeInstancia)
          .neq('whatsapp_labels', '[]')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (chunkErr || !chunk || chunk.length === 0) break;
        allContatosCloud.push(...chunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      for (const cc of allContatosCloud) {
        if (cc.telefone_contato && Array.isArray(cc.whatsapp_labels) && cc.whatsapp_labels.length > 0) {
          const rawTel = String(cc.telefone_contato).replace(/\D/g, '');
          mapaWhatsappLabels.set(rawTel, cc.whatsapp_labels);
          if (rawTel.startsWith('55')) {
            mapaWhatsappLabels.set(rawTel.slice(2), cc.whatsapp_labels);
          } else {
            mapaWhatsappLabels.set(`55${rawTel}`, cc.whatsapp_labels);
          }
        }
      }

      // 2. Carregar definições oficiais de etiquetas via UAZAPI (se tiver token)
      const token = instanciaMatch.token || clientConfig.whatsapp_token;
      if (token) {
        try {
          const labelsList = await fetchUazapiLabels(token);
          for (const lbl of labelsList || []) {
            const rawKey = String(lbl.labelid || lbl.id);
            const cleanKey = rawKey.includes(':') ? rawKey.split(':')[1] : rawKey;
            
            mapaNomes.set(cleanKey, lbl.name);
            mapaNomes.set(rawKey, lbl.name);

            const item: UazapiLabelItem = {
              id: rawKey,
              labelid: cleanKey,
              name: lbl.name,
              colorHex: lbl.colorHex || '#6366f1',
              color: lbl.color,
            };

            mapaUazapiLabels.set(cleanKey, item);
            mapaUazapiLabels.set(rawKey, item);
          }
        } catch (uazErr) {
          console.warn('Erro ao carregar etiquetas da UAZAPI:', uazErr);
        }
      }

      // 3. Complementar com banco wacloud_etiquetas_instancia
      const { data: dbLabels } = await wacloudAdmin
        .from('wacloud_etiquetas_instancia')
        .select('*')
        .eq('nome_instancia', nomeInstancia);

      for (const lbl of dbLabels || []) {
        const cleanKey = String(lbl.uazapi_label_id);
        if (!mapaNomes.has(cleanKey)) {
          mapaNomes.set(cleanKey, lbl.nome);
        }
        if (!mapaUazapiLabels.has(cleanKey)) {
          mapaUazapiLabels.set(cleanKey, {
            id: cleanKey,
            labelid: cleanKey,
            name: lbl.nome,
            colorHex: lbl.cor_hex || '#6366f1',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Erro em getClientWhatsappLabelsData:', err);
  }

  return { mapaWhatsappLabels, mapaNomes, mapaUazapiLabels };
}
