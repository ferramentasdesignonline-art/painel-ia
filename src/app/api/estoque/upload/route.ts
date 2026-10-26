import { NextResponse } from "next/server"
import { uploadToR2 } from "@/lib/r2"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getActiveClientConfig } from "@/lib/auth/helpers"

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
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      // Check single file fallback
      const singleFile = formData.get("file") as File | null
      if (singleFile) {
        files.push(singleFile)
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    const folder = `estoque/${clientConfig.slug || clientConfig.id}`
    const urls: string[] = []

    for (const file of files) {
      // Validate image types
      if (!file.type.startsWith("image/")) {
        continue
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const url = await uploadToR2(buffer, file.name, file.type, folder)
      urls.push(url)
    }

    return NextResponse.json({ success: true, urls })
  } catch (error: any) {
    console.error("Erro no upload R2:", error)
    return NextResponse.json({ error: error.message || "Erro no upload" }, { status: 500 })
  }
}
