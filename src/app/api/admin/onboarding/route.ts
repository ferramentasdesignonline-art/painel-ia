import { NextResponse } from "next/server"
import { getNocoDBOnboardings, createNocoDBOnboarding } from "@/lib/nocodb/sistema"
import crypto from "crypto"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const list = await getNocoDBOnboardings()
    return NextResponse.json({ onboardings: list })
  } catch (err: any) {
    console.error("Erro ao listar onboardings:", err)
    return NextResponse.json({ error: err.message || "Erro ao listar" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome_cliente } = body

    if (!nome_cliente || !nome_cliente.trim()) {
      return NextResponse.json({ error: "Nome da concessionária é obrigatório" }, { status: 400 })
    }

    const cleanSlug = nome_cliente
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")

    const randomSuffix = crypto.randomBytes(4).toString("hex")
    const token = `${cleanSlug || "cliente"}-${randomSuffix}`

    const created = await createNocoDBOnboarding({
      nome_cliente: nome_cliente.trim(),
      token,
    })

    return NextResponse.json({ success: true, onboarding: created })
  } catch (err: any) {
    console.error("Erro ao criar link de onboarding:", err)
    return NextResponse.json({ error: err.message || "Erro ao criar" }, { status: 500 })
  }
}
