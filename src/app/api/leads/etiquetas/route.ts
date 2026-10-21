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

    // 1. Atualizar em wacloud_contatos
    let contatosQuery = wacloudAdmin
      .from('wacloud_contatos')
      .select('id, whatsapp_labels, telefone_contato')
      .or(`telefone_contato.eq.${rawPhone},telefone_contato.eq.${rawPhone.replace(/^55/, '')}`);

    if (nomeInstancia) {
      contatosQuery = contatosQuery.eq('nome_instancia', nomeInstancia);
    }

    const { data: contatos } = await contatosQuery;
    let newLabelsArray: string[] = [];

    if (contatos && contatos.length > 0) {
      for (const c of contatos) {
        const curLabels: string[] = Array.isArray(c.whatsapp_labels) ? [...c.whatsapp_labels] : [];
        if (action === 'add') {
          const exists = curLabels.some(l => {
            const lid = String(l).includes(':') ? String(l).split(':')[1] : String(l);
            return lid === cleanLabelId;
          });
          if (!exists) {
            curLabels.push(String(labelId));
          }
        } else {
          // remove
          const filtered = curLabels.filter(l => {
            const lid = String(l).includes(':') ? String(l).split(':')[1] : String(l);
            return lid !== cleanLabelId;
          });
          curLabels.length = 0;
          curLabels.push(...filtered);
        }

        newLabelsArray = curLabels;
        await wacloudAdmin
          .from('wacloud_contatos')
          .update({ whatsapp_labels: curLabels, atualizado_em: new Date().toISOString() })
          .eq('id', c.id);
      }
    } else {
      // Se não encontrou no wacloud_contatos, prepara lista simples
      newLabelsArray = action === 'add' ? [cleanLabelId] : [];
    }

    // 2. Chamar Uazapi /chat/labels para sincronizar direto no WhatsApp
    if (token) {
      try {
        const payloadLabels = newLabelsArray.map(l => String(l).includes(':') ? String(l).split(':')[1] : String(l));
        await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/chat/labels`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            token,
          },
          body: JSON.stringify({
            number: rawPhone,
            labelids: payloadLabels,
          }),
        });
      } catch (uazapiErr) {
        console.warn('Erro ao sincronizar etiqueta com WhatsApp UAZAPI:', uazapiErr);
      }
    }

    return NextResponse.json({ success: true, whatsapp_labels: newLabelsArray });
  } catch (err: any) {
    console.error('Erro em POST /api/leads/etiquetas:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
