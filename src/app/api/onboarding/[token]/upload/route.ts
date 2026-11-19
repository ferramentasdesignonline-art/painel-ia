import { NextResponse } from "next/server"
import { uploadToR2 } from "@/lib/r2"
import { getNocoDBOnboardingByToken } from "@/lib/nocodb/sistema"

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params?.token
    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    const onboarding = await getNocoDBOnboardingByToken(token)
    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding não encontrado" }, { status: 404 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      const single = formData.get("file") as File | null
      if (single) files.push(single)
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    const folder = `onboarding/${token}`
    const urls: string[] = []

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue
      const buffer = Buffer.from(await file.arrayBuffer())
      const url = await uploadToR2(buffer, file.name, file.type, folder)
      urls.push(url)
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: "Nenhuma imagem válida processada" }, { status: 400 })
    }

    return NextResponse.json({ success: true, urls })
  } catch (err: any) {
    console.error("Erro no upload de fotos do onboarding:", err)
    return NextResponse.json({ error: err.message || "Erro no upload" }, { status: 500 })
  }
}
