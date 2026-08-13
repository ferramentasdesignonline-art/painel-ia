import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { id, acao } = await req.json()

    if (!id || !acao) {
      return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    if (acao === 'activate') {
      const { error } = await supabase
        .from('sistema-dash-ia_clientes')
        .update({ active: true })
        .eq('id', id)
      
      if (error) throw error
    } else if (acao === 'deactivate') {
      const { error } = await supabase
        .from('sistema-dash-ia_clientes')
        .update({ active: false })
        .eq('id', id)
      
      if (error) throw error
    } else if (acao === 'delete') {
      const { error } = await supabase
        .from('sistema-dash-ia_clientes')
        .delete()
        .eq('id', id)

      if (error) throw error
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (e: any) {
    console.error("Erro na API de ação de cliente:", e)
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 })
  }
}
