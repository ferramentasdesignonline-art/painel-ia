import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getActiveClientConfig } from '@/lib/auth/helpers';
import { getWacloudSupabaseAdmin } from '@/lib/wacloud/supabase';
import { WACLOUD_CONFIG } from '@/lib/wacloud/config';
import { fetchUazapiLabels } from '@/lib/wacloud/uazapi';

export const dynamic = 'force-dynamic';

function normalizeStr(str: string) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/**
 * GET /api/leads/etiquetas
 * Retorna todas as etiquetas do WhatsApp da instância vinculada ao cliente atual
 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
    );

    const clientConfig = await getActiveClientConfig(supabaseSession);
    if (!clientConfig) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const wacloudAdmin = getWacloudSupabaseAdmin();

    // 1. Localizar a instância correspondente ao cliente
    const { data: instancias } = await wacloudAdmin
      .from('wacloud_instancias')
      .select('id, nome_instancia, token')
      .limit(50);

    const nomeNorm = normalizeStr(clientConfig.nome);
    const slugNorm = normalizeStr(clientConfig.slug || '');
    const instConfigNorm = normalizeStr(clientConfig.nome_instancia || clientConfig.whatsapp_instancia || '');

    let instanciaMatch = instancias?.find(i => {
      const iNorm = normalizeStr(i.nome_instancia);
      return iNorm === instConfigNorm || iNorm === nomeNorm || iNorm === slugNorm;
    });

    if (!instanciaMatch) {
      instanciaMatch = instancias?.find(i => {
        const iNorm = normalizeStr(i.nome_instancia);
        return iNorm.includes(nomeNorm) || nomeNorm.includes(iNorm);
      });
    }

    const token = instanciaMatch?.token || clientConfig.whatsapp_token;
    const nomeInstancia = instanciaMatch?.nome_instancia || clientConfig.nome_instancia || clientConfig.whatsapp_instancia;

    const mapaEtiquetas = new Map<string, { id: string; labelid: string; nome: string; cor: string }>();

    // 2. Buscar da Uazapi via token se disponível
    if (token) {
      try {
        const uazapiLabels = await fetchUazapiLabels(token);
        for (const lbl of uazapiLabels || []) {
          const cleanId = String(lbl.labelid || lbl.id).includes(':') 
            ? String(lbl.labelid || lbl.id).split(':')[1] 
            : String(lbl.labelid || lbl.id);
          
          mapaEtiquetas.set(cleanId, {
            id: String(lbl.id || cleanId),
            labelid: cleanId,
            nome: lbl.name,
            cor: lbl.colorHex || '#fed428',
          });
        }
      } catch (err) {
        console.warn('Erro ao buscar etiquetas do Uazapi:', err);
      }
    }

    // 3. Complementar com banco de dados wacloud_etiquetas_instancia
    if (nomeInstancia) {
      const { data: dbLabels } = await wacloudAdmin
        .from('wacloud_etiquetas_instancia')
        .select('*')
        .eq('nome_instancia', nomeInstancia);

      for (const lbl of dbLabels || []) {
        const cleanId = String(lbl.uazapi_label_id);
        if (!mapaEtiquetas.has(cleanId)) {
          mapaEtiquetas.set(cleanId, {
            id: cleanId,
            labelid: cleanId,
            nome: lbl.nome,
            cor: lbl.cor_hex || '#fed428',
          });
        }
      }
    }

    const etiquetas = Array.from(mapaEtiquetas.values()).sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json({ etiquetas });
  } catch (err: any) {
    console.error('Erro em GET /api/leads/etiquetas:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST /api/leads/etiquetas
 * Adiciona ou remove uma etiqueta de um lead no WhatsApp e no banco
 */
export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
    );

    const clientConfig = await getActiveClientConfig(supabaseSession);
    if (!clientConfig) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { leadId, telefone, labelId, action } = body;

    if (!telefone || !labelId || !['add', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 });
    }

    const cleanLabelId = String(labelId).includes(':') ? String(labelId).split(':')[1] : String(labelId);
    let rawPhone = String(telefone).replace(/\D/g, '');
    if (!rawPhone.startsWith('55') && rawPhone.length >= 10 && rawPhone.length <= 11) {
      rawPhone = `55${rawPhone}`;
    }

    const wacloudAdmin = getWacloudSupabaseAdmin();

    // Localizar a instância
    const { data: instancias } = await wacloudAdmin
      .from('wacloud_instancias')
      .select('id, nome_instancia, token')
      .limit(50);

    const nomeNorm = normalizeStr(clientConfig.nome);
    const slugNorm = normalizeStr(clientConfig.slug || '');
    const instConfigNorm = normalizeStr(clientConfig.nome_instancia || clientConfig.whatsapp_instancia || '');

    let instanciaMatch = instancias?.find(i => {
      const iNorm = normalizeStr(i.nome_instancia);
      return iNorm === instConfigNorm || iNorm === nomeNorm || iNorm === slugNorm;
    });

    if (!instanciaMatch) {
      instanciaMatch = instancias?.find(i => {
        const iNorm = normalizeStr(i.nome_instancia);
        return iNorm.includes(nomeNorm) || nomeNorm.includes(iNorm);
      });
    }

    const token = instanciaMatch?.token || clientConfig.whatsapp_token;
    const nomeInstancia = instanciaMatch?.nome_instancia || clientConfig.nome_instancia || clientConfig.whatsapp_instancia;

    // 1. Obter etiquetas atuais (preferencialmente direto da UAZAPI para não sobrescrever nem perder etiquetas existentes)
    let currentLabels: string[] = [];
    if (token) {
      try {
        const uazRes = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/find`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', token },
          body: JSON.stringify({ wa_chatid: `${rawPhone}@s.whatsapp.net` })
        });
        const uazData = await uazRes.json();
        const chat = uazData.chats?.[0];
        if (chat && Array.isArray(chat.wa_label)) {
          currentLabels = chat.wa_label.map((l: any) => String(l).includes(':') ? String(l).split(':')[1] : String(l));
        }
      } catch (err) {
        console.warn('Erro ao consultar chat na Uazapi:', err);
      }
    }

    const tailPhone = rawPhone.slice(-8);

    // Se a Uazapi não retornou labels, tenta pegar do banco
    if (currentLabels.length === 0) {
      if (clientConfig.tabela_leads && clientConfig.supabase_url !== 'nocodb') {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const clientDb = createClient(
            clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
            clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          const { data: leadRow } = await clientDb
            .from(clientConfig.tabela_leads)
            .select('whatsapp_labels')
            .ilike('telefone', `%${tailPhone}%`)
            .limit(1)
            .maybeSingle();

          if (leadRow && Array.isArray(leadRow.whatsapp_labels)) {
            currentLabels = leadRow.whatsapp_labels.map((l: any) => String(l).includes(':') ? String(l).split(':')[1] : String(l));
          }
        } catch (dbErr) {
          console.warn('Erro ao buscar lead no banco do cliente:', dbErr);
        }
      } else {
        const { data: contatoRow } = await wacloudAdmin
          .from('wacloud_contatos')
          .select('whatsapp_labels')
          .ilike('telefone_contato', `%${tailPhone}%`)
          .limit(1)
          .maybeSingle();

        if (contatoRow && Array.isArray(contatoRow.whatsapp_labels)) {
          currentLabels = contatoRow.whatsapp_labels.map((l: any) => String(l).includes(':') ? String(l).split(':')[1] : String(l));
        }
      }
    }

    // 2. Adicionar ou remover a etiqueta desejada
    const setLabels = new Set(currentLabels);
    if (action === 'add') {
      setLabels.add(cleanLabelId);
    } else {
      setLabels.delete(cleanLabelId);
    }
    const finalLabels = Array.from(setLabels);

    // 3. Chamar Uazapi /chat/labels para sincronizar direto no WhatsApp
    if (token) {
      try {
        await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/labels`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            token,
          },
          body: JSON.stringify({
            number: rawPhone,
            labelids: finalLabels,
          }),
        });
      } catch (uazapiErr) {
        console.warn('Erro ao sincronizar etiqueta com WhatsApp UAZAPI:', uazapiErr);
      }
    }

    // 4. Descobrir se há etiqueta de canal ativa no finalLabels
    let novoCanalOrigem: string | null = null;
    let novoCanalNome: string | null = null;
    let novoCanalCor: string | null = null;

    if (token) {
      try {
        const uazapiLabels = await fetchUazapiLabels(token);
        for (const lbl of uazapiLabels || []) {
          const cid = String(lbl.labelid || lbl.id).includes(':') 
            ? String(lbl.labelid || lbl.id).split(':')[1] 
            : String(lbl.labelid || lbl.id);
          if (finalLabels.includes(cid) && lbl.name.toLowerCase().startsWith('canal')) {
            novoCanalNome = lbl.name.replace(/^canal\s*\|\s*/i, '').trim();
            novoCanalCor = lbl.colorHex || '#6366f1';
            novoCanalOrigem = novoCanalNome.toLowerCase().replace(/\s+/g, '_');
            break;
          }
        }
      } catch (e) {
        // ignora
      }
    }

    // 5. Atualizar no banco correto
    if (clientConfig.tabela_leads && clientConfig.supabase_url !== 'nocodb') {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const clientDb = createClient(
          clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
          clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const updateData: any = { whatsapp_labels: finalLabels };
        if (novoCanalOrigem) updateData.origem_lead = novoCanalOrigem;
        await clientDb
          .from(clientConfig.tabela_leads)
          .update(updateData)
          .ilike('telefone', `%${tailPhone}%`);
      } catch (err) {
        console.warn('Erro ao atualizar whatsapp_labels no banco do cliente:', err);
      }
    } else {
      const updateData: any = { 
        whatsapp_labels: finalLabels, 
        atualizado_em: new Date().toISOString() 
      };
      if (novoCanalOrigem) updateData.origem_lead = novoCanalOrigem;
      
      let updateQuery = wacloudAdmin
        .from('wacloud_contatos')
        .update(updateData)
        .ilike('telefone_contato', `%${tailPhone}%`);

      if (nomeInstancia) {
        updateQuery = updateQuery.eq('nome_instancia', nomeInstancia);
      }
      await updateQuery;
    }

    return NextResponse.json({ 
      success: true, 
      whatsapp_labels: finalLabels,
      canal_origem: novoCanalOrigem,
      canal_label_name: novoCanalNome,
      canal_color: novoCanalCor
    });
  } catch (err: any) {
    console.error('Erro em POST /api/leads/etiquetas:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
