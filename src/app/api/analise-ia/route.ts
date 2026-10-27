import { NextResponse } from "next/server"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { runAnalise } from "@/lib/analise-ia-engine"
import { getNocoDBAnalises, saveNocoDBAnalise } from "@/lib/nocodb/sistema"

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // análise completa pode levar alguns minutos

export async function GET() {
  try {
    const clientConfig = await getActiveClientConfig()
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 1. NocoDB
    try {
      const analises = await getNocoDBAnalises(clientConfig.id, 1)
      if (analises && analises.length > 0) {
        return NextResponse.json({ analise: analises[0] })
      }
    } catch (nocoErr) {
      console.warn("Aviso ao buscar análise no NocoDB:", nocoErr)
    }

    // 2. Supabase Fallback
    try {
      const { createClient } = require("@supabase/supabase-js")
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: analise, error } = await admin
        .from("sistema-dash-ia_analises")
        .select("*")
        .eq("cliente_id", clientConfig.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({ analise: analise || null })
    } catch (sbErr) {
      return NextResponse.json({ analise: null })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const clientConfig = await getActiveClientConfig()
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const openAiKey = (process.env.OPENAI_API_KEY || "").trim()
    if (!openAiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada no servidor (Vercel)." }, { status: 500 })
    }

    const payload = await runAnalise(clientConfig, openAiKey)

    // 1. Salvar no NocoDB
    let savedNoco: any = null
    try {
      savedNoco = await saveNocoDBAnalise(payload)
    } catch (nocoErr) {
      console.warn("Aviso ao salvar análise no NocoDB:", nocoErr)
    }

    // 2. Sincronizar com Supabase se aplicável
    let savedSb: any = null
    try {
      const { createClient } = require("@supabase/supabase-js")
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: saved } = await admin
        .from("sistema-dash-ia_analises").insert(payload).select().single()
      savedSb = saved
    } catch (sbErr) {
      console.warn("Aviso ao sincronizar análise no Supabase:", sbErr)
    }

    const finalAnalise = savedNoco || savedSb || payload
    return NextResponse.json({ success: true, analise: finalAnalise })
  } catch (err: any) {
    console.error("Erro POST /api/analise-ia:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
