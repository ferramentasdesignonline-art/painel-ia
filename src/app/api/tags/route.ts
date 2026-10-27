import { NextResponse } from "next/server"
import { getActiveClientConfig } from "@/lib/auth/helpers"
import { getNocoDBTags, createNocoDBTag } from "@/lib/nocodb/sistema"

export async function GET(request: Request) {
  try {
    const clientConfig = await getActiveClientConfig()
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 1. NocoDB
    try {
      const tags = await getNocoDBTags(clientConfig.id)
      if (tags && tags.length > 0) {
        return NextResponse.json({ tags }, { status: 200 })
      }
    } catch (nocoErr) {
      console.warn("Aviso ao buscar tags no NocoDB:", nocoErr)
    }

    // 2. Fallback Supabase
    try {
      const { createClient } = require("@supabase/supabase-js")
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

      return NextResponse.json({ tags: tags || [] }, { status: 200 })
    } catch (sbErr) {
      return NextResponse.json({ tags: [] }, { status: 200 })
    }
  } catch (error) {
    console.error("Tags GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { nome, cor } = await request.json()
    if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })

    const clientConfig = await getActiveClientConfig()
    if (!clientConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let tagNoco: any = null
    try {
      tagNoco = await createNocoDBTag(clientConfig.id, {
        nome,
        cor: cor || 'bg-gray-100 text-gray-700 border-gray-200'
      })
    } catch (nocoErr) {
      console.warn("Aviso ao criar tag no NocoDB:", nocoErr)
    }

    let tagSb: any = null
    try {
      const { createClient } = require("@supabase/supabase-js")
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

      tagSb = tag
    } catch (sbErr) {
      console.warn("Aviso ao criar tag no Supabase:", sbErr)
    }

    const finalTag = tagNoco || tagSb
    return NextResponse.json({ tag: finalTag }, { status: 201 })
  } catch (error) {
    console.error("Tags POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
