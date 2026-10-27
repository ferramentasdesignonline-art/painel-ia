import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { updateNocoDBCliente, deleteNocoDBCliente } from "@/lib/nocodb/sistema"

export async function POST(req: Request) {
  try {
    const { id, acao } = await req.json()

    if (!id || !acao) {
      return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 })
    }

    if (acao === 'activate') {
      try { await updateNocoDBCliente(id, { active: true }) } catch (e) { console.warn("NocoDB activate err:", e) }
    } else if (acao === 'deactivate') {
      try { await updateNocoDBCliente(id, { active: false }) } catch (e) { console.warn("NocoDB deactivate err:", e) }
    } else if (acao === 'delete') {
      try { await deleteNocoDBCliente(id) } catch (e) { console.warn("NocoDB delete err:", e) }
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
    }

    // Compatibilidade com Supabase
    try {
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
        await supabase.from('sistema-dash-ia_clientes').update({ active: true }).eq('id', id)
      } else if (acao === 'deactivate') {
        await supabase.from('sistema-dash-ia_clientes').update({ active: false }).eq('id', id)
      } else if (acao === 'delete') {
        await supabase.from('sistema-dash-ia_clientes').delete().eq('id', id)
      }
    } catch (sbErr) {
      console.warn("Supabase action fallback warn:", sbErr)
    }

    return NextResponse.json({ success: true })

  } catch (e: any) {
    console.error("Erro na API de ação de cliente:", e)
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 })
  }
}
