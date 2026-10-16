import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { runAnalise } from "@/lib/analise-ia-engine"

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // análise completa pode levar alguns minutos

function getSessionClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const clientConfig = await getActiveClientConfig(getSessionClient())
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: analise, error } = await getAdmin()
      .from("sistema-dash-ia_analises")
      .select("*")
      .eq("cliente_id", clientConfig.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== "PGRST116") console.error("Erro ao buscar analise:", error)
    return NextResponse.json({ analise: analise || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const clientConfig = await getActiveClientConfig(getSessionClient())
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const openAiKey = (process.env.OPENAI_API_KEY || "").trim()
    if (!openAiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada no servidor (Vercel)." }, { status: 500 })
    }

    const payload = await runAnalise(clientConfig, openAiKey)

    const { data: saved, error: insertError } = await getAdmin()
      .from("sistema-dash-ia_analises").insert(payload).select().single()

    if (insertError) {
      console.error("Erro ao salvar analise:", insertError)
      return NextResponse.json({ success: true, analise: payload, warning: insertError.message })
    }
    return NextResponse.json({ success: true, analise: saved })
  } catch (err: any) {
    console.error("Erro POST /api/analise-ia:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
