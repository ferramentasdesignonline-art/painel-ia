import { NextResponse } from "next/server"
import { getNocoDBOnboardingByToken, updateNocoDBOnboarding } from "@/lib/nocodb/sistema"
import { WACLOUD_CONFIG } from "@/lib/wacloud/config"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const onboarding = await getNocoDBOnboardingByToken(params.token)
    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding não encontrado ou expirado" }, { status: 404 })
    }

    return NextResponse.json({ onboarding })
  } catch (err: any) {
    console.error("Erro ao buscar onboarding por token:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const onboarding = await getNocoDBOnboardingByToken(params.token)
    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding não encontrado" }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    // 1. Ação para gerar Instância e QR Code
    if (action === "create_instance") {
      const { nome_instancia } = body
      if (!nome_instancia) {
        return NextResponse.json({ error: "Nome da instância é obrigatório" }, { status: 400 })
      }

      const { createWacloudInstance } = await import("@/lib/wacloud/uazapi")
      const result = await createWacloudInstance(nome_instancia.trim())
      const instanceToken = result?.instance?.token

      let qrcode: string | null = null
      if (instanceToken) {
        try {
          const qrRes = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/instance/connect`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              token: instanceToken,
            },
          })
          if (qrRes.ok) {
            const qrData = await qrRes.json()
            qrcode = qrData.base64 || qrData.instance?.qrcode || null
          }
        } catch (e) {
          console.warn("Aviso ao gerar QR code:", e)
        }
      }

      await updateNocoDBOnboarding(onboarding.Id || onboarding.id, {
        instancia_whatsapp: nome_instancia.trim(),
      })

      return NextResponse.json({
        success: true,
        token: instanceToken,
        qrcode,
      })
    }

    // 2. Ação para checar status da conexão
    if (action === "check_status") {
      const { token: instToken } = body
      if (!instToken) {
        return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
      }

      const res = await fetch(`${WACLOUD_CONFIG.uazapiBaseUrl}/instance/status`, {
        method: "GET",
        headers: { Accept: "application/json", token: instToken },
      })
      const data = await res.json()
      const connected = Boolean(data?.status?.connected)

      if (connected) {
        await updateNocoDBOnboarding(onboarding.Id || onboarding.id, {
          whatsapp_conectado: true,
        })
      }

      return NextResponse.json({
        connected,
        raw: data,
      })
    }

    // 3. Ação para submeter o formulário completo
    if (action === "submit") {
      const {
        nome_empresa,
        nome_ia,
        instagram,
        endereco,
        horarios,
        sistema_estoque,
        acesso_crm,
        simulacao_bancos,
        bancos,
        whatsapp_avisos,
        instancia_whatsapp,
        whatsapp_conectado,
      } = body

      if (!nome_empresa?.trim()) {
        return NextResponse.json({ error: "Nome da concessionária é obrigatório." }, { status: 400 })
      }

      if (!nome_ia?.trim()) {
        return NextResponse.json({ error: "Nome da atendente IA é obrigatório." }, { status: 400 })
      }

      if (!whatsapp_avisos?.trim()) {
        return NextResponse.json({ error: "WhatsApp de avisos é obrigatório." }, { status: 400 })
      }

      if (!whatsapp_conectado) {
        return NextResponse.json({ error: "É obrigatório conectar o WhatsApp para concluir o onboarding." }, { status: 400 })
      }

      const respostas = {
        nome_empresa,
        nome_ia,
        instagram,
        endereco,
        horarios,
        sistema_estoque,
        acesso_crm,
        simulacao_bancos,
        bancos,
        whatsapp_avisos,
        instancia_whatsapp,
      }

      const updated = await updateNocoDBOnboarding(onboarding.Id || onboarding.id, {
        status: "concluido",
        nome_ia: nome_ia || null,
        whatsapp_avisos: whatsapp_avisos || null,
        instancia_whatsapp: instancia_whatsapp || null,
        whatsapp_conectado: true,
        respostas_json: respostas,
        concluido_em: new Date().toISOString(),
      })

      return NextResponse.json({ success: true, onboarding: updated })
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
  } catch (err: any) {
    console.error("Erro na rota pública de onboarding:", err)
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 })
  }
}
