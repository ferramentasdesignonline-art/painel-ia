import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 })
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

    const { data: client, error } = await supabase
      .from('sistema-dash-ia_clientes')
      .select('whatsapp_token')
      .eq('id', clientId)
      .single()

    if (error || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    if (!client.whatsapp_token) {
      return NextResponse.json({ error: "No token" }, { status: 400 })
    }

    const res = await fetch("https://designonline.uazapi.com/instance/status", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "token": client.whatsapp_token
      }
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Admin WhatsApp Status API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
