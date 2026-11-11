import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { getClientBloqueios } from "@/lib/supabase/queries"
import { isNocoDBClient, getClientBloqueiosNocoDB, addNocoDBBloqueio, removeNocoDBBloqueio } from "@/lib/nocodb/service"

function extrairTelefoneLimpo(numeroStr?: string | null): string {
  if (!numeroStr) return ''
  let clean = String(numeroStr).replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '')
  if (clean.startsWith('55') && clean.length >= 12) clean = clean.slice(2)
  return clean
}

function deduplicarBloqueios(lista: any[]): any[] {
  const vistos = new Set<string>()
  const unicos: any[] = []

  for (const b of lista) {
    if (b.bloqueio_existe === false) continue
    const limpo = extrairTelefoneLimpo(b.numero_cliente)
    if (!limpo) {
      unicos.push(b)
      continue
    }
    const key = limpo.slice(-8)
    if (!vistos.has(key)) {
      vistos.add(key)
      unicos.push(b)
    }
  }

  return unicos
}

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const clientConfig = await getActiveClientConfig(supabaseSession)
    
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (clientConfig.tipo_atendimento === 'sem_ia' || !clientConfig.tabela_bloqueios) {
      return NextResponse.json({ data: [] }, { status: 200 })
    }

    if (isNocoDBClient(clientConfig)) {
      const bloqueios = await getClientBloqueiosNocoDB(clientConfig.tabela_bloqueios)
      return NextResponse.json({ data: deduplicarBloqueios(bloqueios) }, { status: 200 })
    }

    const supabaseAdmin = createClient(clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!, clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const bloqueios = await getClientBloqueios(supabaseAdmin, clientConfig.tabela_bloqueios)

    return NextResponse.json({ data: deduplicarBloqueios(bloqueios) }, { status: 200 })
  } catch (error) {
    console.error("Bloqueios API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { telefone } = body

    if (!telefone) {
      return NextResponse.json({ error: "telefone é obrigatório" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const clientConfig = await getActiveClientConfig(supabaseSession)

    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isNocoDBClient(clientConfig)) {
      if (!clientConfig.tabela_bloqueios) {
        return NextResponse.json({ error: "Tabela de bloqueios não configurada" }, { status: 400 })
      }
      const limpo = telefone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '')
      const instanciaNome = clientConfig.whatsapp_instancia || clientConfig.nome.replace(/\s+/g, '')
      const numeroClientePadrao = `${instanciaNome} ${limpo}@s.whatsapp.net block`
      await addNocoDBBloqueio(clientConfig.tabela_bloqueios, numeroClientePadrao)
      return NextResponse.json({ success: true, message: "Bloqueio criado com sucesso" }, { status: 200 })
    }

    const supabaseAdmin = createClient(
      clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Formata o número para o padrão de bloqueio
    const limpo = telefone.replace(/@s\.whatsapp\.net/gi, '').replace(/@c\.us/gi, '').replace(/\D/g, '')
    const instanciaNome = clientConfig.whatsapp_instancia || clientConfig.nome.replace(/\s+/g, '')
    const numeroClientePadrao = `${instanciaNome} ${limpo}@s.whatsapp.net block`

    // Verifica se já existe
    const { data: existente } = await supabaseAdmin
      .from(clientConfig.tabela_bloqueios)
      .select('id')
      .or(`numero_cliente.eq.${numeroClientePadrao},numero_cliente.ilike.%${limpo}%`)
      .limit(1)

    if (!existente || existente.length === 0) {
      const { error: insertError } = await supabaseAdmin
        .from(clientConfig.tabela_bloqueios)
        .insert({
          numero_cliente: numeroClientePadrao,
          bloqueio_existe: true
        })

      if (insertError) {
        console.error("Erro ao inserir bloqueio:", insertError)
        return NextResponse.json({ error: "Erro ao criar bloqueio" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: "Bloqueio criado com sucesso" }, { status: 200 })
  } catch (error) {
    console.error("Bloqueios POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { numero_cliente } = body

    if (!numero_cliente) {
      return NextResponse.json({ error: "numero_cliente é obrigatório" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const clientConfig = await getActiveClientConfig(supabaseSession)

    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isNocoDBClient(clientConfig)) {
      if (!clientConfig.tabela_bloqueios) {
        return NextResponse.json({ error: "Tabela de bloqueios não configurada" }, { status: 400 })
      }
      const bloqueios = await getClientBloqueiosNocoDB(clientConfig.tabela_bloqueios)
      const limpo = String(numero_cliente).replace(/\D/g, '')
      const match = bloqueios.find((b: any) => {
        const bLimpo = String(b.numero_cliente || '').replace(/\D/g, '')
        return b.numero_cliente === numero_cliente || (limpo && bLimpo.includes(limpo))
      })
      if (match && match.id) {
        await removeNocoDBBloqueio(clientConfig.tabela_bloqueios, match.id)
      }
      return NextResponse.json({ success: true, message: "IA reativada com sucesso" }, { status: 200 })
    }

    const supabaseAdmin = createClient(clientConfig.supabase_url || process.env.NEXT_PUBLIC_SUPABASE_URL!, clientConfig.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const limpo = extrairTelefoneLimpo(numero_cliente)
    const tail8 = limpo ? limpo.slice(-8) : ''

    // Exclui todas as ocorrências do número (evita duplicatas órfãs continuarem bloqueando)
    let error: any = null
    if (tail8) {
      const res = await supabaseAdmin
        .from(clientConfig.tabela_bloqueios)
        .delete()
        .or(`numero_cliente.ilike.%${limpo}%,numero_cliente.ilike.%${tail8}%`)
      error = res.error
    } else {
      const res = await supabaseAdmin
        .from(clientConfig.tabela_bloqueios)
        .delete()
        .eq('numero_cliente', numero_cliente)
      error = res.error
    }

    if (error) {
      console.error("Erro ao excluir bloqueio:", error)
      return NextResponse.json({ error: "Erro ao reativar IA" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "IA reativada com sucesso" }, { status: 200 })
  } catch (error) {
    console.error("Bloqueios DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
