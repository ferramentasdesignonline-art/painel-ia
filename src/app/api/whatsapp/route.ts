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

    if (!clientConfig.whatsapp_token) {
      return NextResponse.json({ error: "WhatsApp token não configurado" }, { status: 400 })
    }

    const res = await fetch("https://designonline.uazapi.com/instance/status", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "token": clientConfig.whatsapp_token
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

    if (!clientConfig.whatsapp_token) {
      return NextResponse.json({ error: "WhatsApp token não configurado" }, { status: 400 })
    }

    const res = await fetch("https://designonline.uazapi.com/instance/connect", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": clientConfig.whatsapp_token
      }
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("WhatsApp Connect API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
