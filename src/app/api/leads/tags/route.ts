import { NextResponse } from "next/server"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { addNocoDBLeadTag, removeNocoDBLeadTag } from "@/lib/nocodb/sistema"

export async function POST(request: Request) {
  try {
    const { lead_id, tag_id } = await request.json()
    if (!lead_id || !tag_id) return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 })

    const clientConfig = await getActiveClientConfig()
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 1. NocoDB
    try {
      await addNocoDBLeadTag(clientConfig.id, lead_id, tag_id)
    } catch (nocoErr) {
      console.warn("Aviso ao vincular tag no NocoDB:", nocoErr)
    }

    // 2. Supabase
    try {
      const { createClient } = require("@supabase/supabase-js")
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      await supabaseAdmin
        .from('sistema-dash-ia_lead_tags')
        .insert({
          cliente_id: clientConfig.id,
          lead_id: lead_id.toString(),
          tag_id
        })
    } catch (sbErr) {
      // Ignora erro de chave duplicada ou conexão
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Lead Tags POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { lead_id, tag_id } = await request.json()
    if (!lead_id || !tag_id) return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 })

    const clientConfig = await getActiveClientConfig()
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 1. NocoDB
    try {
      await removeNocoDBLeadTag(clientConfig.id, lead_id, tag_id)
    } catch (nocoErr) {
      console.warn("Aviso ao remover tag no NocoDB:", nocoErr)
    }

    // 2. Supabase
    try {
      const { createClient } = require("@supabase/supabase-js")
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      await supabaseAdmin
        .from('sistema-dash-ia_lead_tags')
        .delete()
        .eq('cliente_id', clientConfig.id)
        .eq('lead_id', lead_id.toString())
        .eq('tag_id', tag_id)
    } catch (sbErr) {
      // Ignora
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Lead Tags DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
