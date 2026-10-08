import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { getActiveClientConfig } from "@/lib/auth/helpers"

export async function POST(request: Request) {
  try {
    const { lead_id, tag_id } = await request.json()
    if (!lead_id || !tag_id) return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 })

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

    const { error } = await supabaseAdmin
      .from('sistema-dash-ia_lead_tags')
      .insert({
        cliente_id: clientConfig.id,
        lead_id: lead_id.toString(),
        tag_id
      })

    if (error && error.code !== '23505') { // ignore unique constraint if already tagged
      throw error;
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

    const { error } = await supabaseAdmin
      .from('sistema-dash-ia_lead_tags')
      .delete()
      .eq('cliente_id', clientConfig.id)
      .eq('lead_id', lead_id.toString())
      .eq('tag_id', tag_id)

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Lead Tags DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
