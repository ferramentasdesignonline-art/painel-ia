import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { get(name: string) { return cookieStore.get(name)?.value } },
      }
    )

    const clientConfig = await getActiveClientConfig(supabaseSession)
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: tags, error } = await supabaseAdmin
      .from('sistema-dash-ia_tags')
      .select('*')
      .eq('cliente_id', clientConfig.id)
      .order('nome')

    if (error) throw error;

    return NextResponse.json({ tags }, { status: 200 })
  } catch (error) {
    console.error("Tags GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { nome, cor } = await request.json()
    if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })

    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { get(name: string) { return cookieStore.get(name)?.value } },
      }
    )

    const clientConfig = await getActiveClientConfig(supabaseSession)
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: tag, error } = await supabaseAdmin
      .from('sistema-dash-ia_tags')
      .insert({
        cliente_id: clientConfig.id,
        nome,
        cor: cor || 'bg-gray-100 text-gray-700 border-gray-200'
      })
      .select()
      .single()

    if (error) throw error;

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    console.error("Tags POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
