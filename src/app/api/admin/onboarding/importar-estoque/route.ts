import { NextResponse } from "next/server"
import { getNocoDBOnboardings } from "@/lib/nocodb/sistema"
import { criarVeiculo } from "@/lib/estoque/service"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { onboarding_id, tabela_estoque } = body

    if (!onboarding_id) {
      return NextResponse.json({ error: "ID do onboarding é obrigatório" }, { status: 400 })
    }

    if (!tabela_estoque || !tabela_estoque.trim()) {
      return NextResponse.json({ error: "Nome da tabela de estoque é obrigatório" }, { status: 400 })
    }

    const allOnboardings = await getNocoDBOnboardings()
    const onboarding = allOnboardings.find((o: any) => String(o.Id || o.id) === String(onboarding_id))

    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding não encontrado" }, { status: 404 })
    }

    const respostas = onboarding.respostas_json || {}
    const veiculos = respostas.veiculos_iniciais || []

    if (!Array.isArray(veiculos) || veiculos.length === 0) {
      return NextResponse.json({ 
        error: "Este onboarding não possui veículos iniciais cadastrados pelo cliente." 
      }, { status: 400 })
    }

    const cleanTabela = tabela_estoque.trim().toLowerCase()
    let sucessos = 0
    const erros: string[] = []

    for (const v of veiculos) {
      try {
        await criarVeiculo(cleanTabela, {
          marca: v.marca || "Não informada",
          modelo: v.modelo || "Não informado",
          versao: v.versao || "",
          ano: v.ano ? Number(v.ano) || v.ano : "",
          cor: v.cor || "",
          quilometragem: v.quilometragem || v.km || "",
          combustivel: v.combustivel || "Flex",
          cambio: v.cambio || "Automático",
          valor_venda: v.valor_venda || v.valor || "",
          fotos: Array.isArray(v.fotos) ? v.fotos : [],
          opcionais: Array.isArray(v.opcionais) ? v.opcionais : [],
          ativo: true,
        })
        sucessos++
      } catch (err: any) {
        console.error(`Erro ao importar veículo ${v.marca} ${v.modelo}:`, err)
        erros.push(`${v.marca} ${v.modelo}: ${err.message || "Erro ao salvar"}`)
      }
    }

    if (sucessos === 0 && erros.length > 0) {
      return NextResponse.json({ 
        error: `Falha ao importar veículos: ${erros.join("; ")}` 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      importados: sucessos,
      erros: erros.length > 0 ? erros : undefined,
      message: `${sucessos} veículo(s) importado(s) com sucesso na tabela "${cleanTabela}"!`
    })
  } catch (err: any) {
    console.error("Erro na importação de estoque do onboarding:", err)
    return NextResponse.json({ error: err.message || "Erro interno ao importar veículos" }, { status: 500 })
  }
}
