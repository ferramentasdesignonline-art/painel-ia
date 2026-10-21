import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getActiveClientConfig } from "@/lib/auth/helpers"

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
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

    const clientConfig = await getActiveClientConfig(supabase)
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let token = clientConfig.whatsapp_token
    if (!token) {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase')
      const wacloudAdmin = getWacloudSupabaseAdmin()
      const nomeInstancia = clientConfig.nome_instancia || clientConfig.nome
      const { data: inst } = await wacloudAdmin
        .from('wacloud_instancias')
        .select('token')
        .or(`nome_instancia.eq.${nomeInstancia},cliente_id.eq.${clientConfig.id}`)
        .limit(1)
        .maybeSingle()

      if (inst?.token) {
        token = inst.token
      }
    }

    if (!token) {
      return NextResponse.json({ error: "WhatsApp token não configurado" }, { status: 400 })
    }

    const res = await fetch("https://designonline.uazapi.com/instance/status", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "token": token
      }
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("WhatsApp Status API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
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

    const clientConfig = await getActiveClientConfig(supabase)
    if (!clientConfig) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let token = clientConfig.whatsapp_token
    if (!token) {
      const { getWacloudSupabaseAdmin } = await import('@/lib/wacloud/supabase')
      const wacloudAdmin = getWacloudSupabaseAdmin()
      const nomeInstancia = clientConfig.nome_instancia || clientConfig.nome
      const { data: inst } = await wacloudAdmin
        .from('wacloud_instancias')
        .select('token')
        .or(`nome_instancia.eq.${nomeInstancia},cliente_id.eq.${clientConfig.id}`)
        .limit(1)
        .maybeSingle()

      if (inst?.token) {
        token = inst.token
      }
    }

    if (!token) {
      return NextResponse.json({ error: "WhatsApp token não configurado" }, { status: 400 })
    }

    const res = await fetch("https://designonline.uazapi.com/instance/connect", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": token
      }
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("WhatsApp Connect API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
