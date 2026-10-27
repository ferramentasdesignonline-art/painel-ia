import { getWacloudSupabaseAdmin } from './supabase';
import { fetchUazapiChats, fetchUazapiLabels } from './uazapi';
import { createClient } from '@supabase/supabase-js';

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

// Cache em memória para controlar o Lazy-Sync por cliente (TTL de 15 minutos)
const syncTimestamps = new Map<string, number>();
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

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

    const token = instanciaMatch?.token || clientConfig.whatsapp_token;
    const nomeInstancia = instanciaMatch?.nome_instancia || clientConfig.nome_instancia || clientConfig.whatsapp_instancia;

    // 1. Carregar definições oficiais de etiquetas via UAZAPI (se tiver token)
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

      // 2. Lazy-Sync Automático sob demanda (apenas 1 vez a cada 15 min quando o Dashboard/Leads for acessado)
      const cacheKey = String(clientConfig.id || clientConfig.slug || clientConfig.nome || 'default');
      const lastSync = syncTimestamps.get(cacheKey) || 0;
      const now = Date.now();
      const shouldSync = (now - lastSync) > SYNC_INTERVAL_MS;

      if (shouldSync) {
        syncTimestamps.set(cacheKey, now);
        try {
          // Puxa os 150 chats mais recentes com wa_label ativo
          const chatResult = await fetchUazapiChats(token, 0, 150);
          const rawChats = chatResult.chats || [];
          const labeledChats = rawChats.filter((c: any) => 
            Array.isArray(c?.wa_label) && c.wa_label.length > 0 && !c?.wa_isGroup
          );

          // Alimenta o mapa em memória imediatamente
          for (const c of labeledChats) {
            const cleanPhone = String(c.wa_chatid || '').split('@')[0].replace(/\D/g, '');
            if (cleanPhone) {
              mapaWhatsappLabels.set(cleanPhone, c.wa_label);
              if (cleanPhone.startsWith('55')) {
                mapaWhatsappLabels.set(cleanPhone.slice(2), c.wa_label);
              } else {
                mapaWhatsappLabels.set(`55${cleanPhone}`, c.wa_label);
              }
            }
          }

          // Se o cliente tem IA e tabela de leads própria (ex: auto_prosperita_leads, domine_leads, titanium_leads):
          // Atualiza em lote diretamente na coluna whatsapp_labels do Supabase do cliente
          if (clientConfig.tabela_leads && clientConfig.supabase_url !== 'nocodb' && labeledChats.length > 0) {
            const clientDb = createClient(
              clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
              clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Atualiza leads de forma assíncrona/batch
            Promise.allSettled(
              labeledChats.map((c: any) => {
                const cleanPhone = String(c.wa_chatid || '').split('@')[0].replace(/\D/g, '');
                const tailPhone = cleanPhone.slice(-8);
                return clientDb
                  .from(clientConfig.tabela_leads)
                  .update({ whatsapp_labels: c.wa_label })
                  .ilike('telefone', `%${tailPhone}%`);
              })
            ).catch(dbErr => console.warn('Aviso: sync whatsapp_labels na tabela de leads:', dbErr));
          } else if (nomeInstancia && labeledChats.length > 0) {
            // Cliente sem IA (leads ficam em wacloud_contatos)
            Promise.allSettled(
              labeledChats.map((c: any) => {
                const cleanPhone = String(c.wa_chatid || '').split('@')[0].replace(/\D/g, '');
                const tailPhone = cleanPhone.slice(-8);
                return wacloudAdmin
                  .from('wacloud_contatos')
                  .update({ whatsapp_labels: c.wa_label, atualizado_em: new Date().toISOString() })
                  .eq('nome_instancia', nomeInstancia)
                  .ilike('telefone_contato', `%${tailPhone}%`);
              })
            ).catch(dbErr => console.warn('Aviso: sync whatsapp_labels em wacloud_contatos:', dbErr));
          }
        } catch (syncErr) {
          console.warn('Aviso no Lazy-Sync da Uazapi:', syncErr);
        }
      }
    }

    // 3. Complementar com contatos do banco wacloud_contatos (para preencher qualquer contato que não estava no lote recente)
    if (nomeInstancia) {
      const { data: chunk } = await wacloudAdmin
        .from('wacloud_contatos')
        .select('telefone_contato, whatsapp_labels')
        .eq('nome_instancia', nomeInstancia)
        .neq('whatsapp_labels', '[]')
        .limit(2000);

      for (const cc of chunk || []) {
        if (cc.telefone_contato && Array.isArray(cc.whatsapp_labels) && cc.whatsapp_labels.length > 0) {
          const rawTel = String(cc.telefone_contato).replace(/\D/g, '');
          if (!mapaWhatsappLabels.has(rawTel)) {
            mapaWhatsappLabels.set(rawTel, cc.whatsapp_labels);
            if (rawTel.startsWith('55')) {
              mapaWhatsappLabels.set(rawTel.slice(2), cc.whatsapp_labels);
            } else {
              mapaWhatsappLabels.set(`55${rawTel}`, cc.whatsapp_labels);
            }
          }
        }
      }
    }

    // 4. Complementar com banco wacloud_etiquetas_instancia
    if (nomeInstancia) {
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
