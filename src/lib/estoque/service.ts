import { createClient } from "@supabase/supabase-js"

export interface VeiculoEstoque {
  id?: string | number
  Id?: number
  chave_externa?: string
  marca: string
  modelo: string
  versao?: string
  ano?: number | string
  cor?: string
  quilometragem?: string | number
  combustivel?: string
  cambio?: string
  valor_venda?: string | number
  fotos?: string[]
  opcionais?: string[] | string
  subcategoria?: string
  tipo?: string
  atualizado_em?: string
  ativo?: boolean
}

const NOCODB_URL = process.env.NOCODB_URL || "https://evolution-nocodb.4lap5g.easypanel.host"
const NOCODB_TOKEN = process.env.NOCODB_API_TOKEN || "9Qz7ETxba8JnXq3B0e9ybHaSiDar6hLqYBIIkg7u"
const BASE_ID = "p8xylnrppf72yx9"

// Cache de mapeamento de nome de tabela para tableId no NocoDB
let tableMapCache: Record<string, string> | null = null

async function getNocoDBTableMap(): Promise<Record<string, string>> {
  if (tableMapCache) return tableMapCache

  const map: Record<string, string> = {
    cr_motors_estoque: "m086uokz593yt9z",
    cr_motors_estoque_inativo: "mj7zycrk1wiehet",
  }

  try {
    const res = await fetch(`${NOCODB_URL}/api/v2/meta/bases/${BASE_ID}/tables`, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.list)) {
        for (const t of data.list) {
          if (t.table_name && t.id) map[t.table_name.toLowerCase()] = t.id
          if (t.title && t.id) map[t.title.toLowerCase()] = t.id
        }
      }
    }
  } catch (err) {
    console.error("Erro ao listar tabelas NocoDB:", err)
  }

  tableMapCache = map
  return map
}

function normalizeVehicle(raw: any, ativo: boolean): VeiculoEstoque {
  let fotos: string[] = []
  if (raw.fotos) {
    if (Array.isArray(raw.fotos)) {
      fotos = raw.fotos
    } else if (typeof raw.fotos === "object" && Array.isArray(raw.fotos.fotos)) {
      fotos = raw.fotos.fotos
    } else if (typeof raw.fotos === "string") {
      try {
        const parsed = JSON.parse(raw.fotos)
        fotos = Array.isArray(parsed) ? parsed : parsed.fotos || []
      } catch {
        fotos = [raw.fotos]
      }
    }
  }

  let opcionais = raw.opcionais
  if (opcionais && typeof opcionais === "object" && !Array.isArray(opcionais)) {
    opcionais = opcionais.opcionais || opcionais.fotos || Object.values(opcionais)
  }

  return {
    id: raw.Id || raw.id,
    Id: raw.Id || raw.id,
    chave_externa: raw.chave_externa || "",
    marca: raw.marca || "",
    modelo: raw.modelo || "",
    versao: raw.versao || "",
    ano: raw.ano || "",
    cor: raw.cor || "",
    quilometragem: raw.quilometragem || "",
    combustivel: raw.combustivel || "",
    cambio: raw.cambio || "",
    valor_venda: raw.valor_venda || "",
    fotos,
    opcionais,
    subcategoria: raw.subcategoria || "",
    tipo: raw.tipo || "",
    atualizado_em: raw.atualizado_em || "",
    ativo,
  }
}

export async function listarEstoqueCliente(tabelaEstoque: string) {
  const tableMap = await getNocoDBTableMap()
  const cleanName = (tabelaEstoque || "").toLowerCase().trim()
  const activeTableId = tableMap[cleanName] || (cleanName.startsWith("m0") ? cleanName : null)

  if (activeTableId) {
    // 1. Tabela ativa no NocoDB
    const resAtivos = await fetch(`${NOCODB_URL}/api/v2/tables/${activeTableId}/records?limit=250`, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    })
    const dataAtivos = resAtivos.ok ? await resAtivos.json() : { list: [] }
    const veiculosAtivos = (dataAtivos.list || []).map((r: any) => normalizeVehicle(r, true))

    // 2. Tabela de inativos no NocoDB (${cleanName}_inativo)
    const inativoName = `${cleanName}_inativo`
    const inativoTableId = tableMap[inativoName]

    let veiculosInativos: VeiculoEstoque[] = []
    if (inativoTableId) {
      const resInativos = await fetch(`${NOCODB_URL}/api/v2/tables/${inativoTableId}/records?limit=250`, {
        headers: { "xc-token": NOCODB_TOKEN },
        cache: "no-store",
      })
      const dataInativos = resInativos.ok ? await resInativos.json() : { list: [] }
      veiculosInativos = (dataInativos.list || []).map((r: any) => normalizeVehicle(r, false))
    }

    return {
      success: true,
      provider: "nocodb",
      ativos: veiculosAtivos,
      inativos: veiculosInativos,
    }
  }

  // Fallback para Supabase se não estiver no NocoDB
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ativos, error: errAtivos } = await supabase.from(cleanName).select("*")
  const { data: inativos } = await supabase.from(`${cleanName}_inativo`).select("*")

  return {
    success: true,
    provider: "supabase",
    ativos: (ativos || []).map((r: any) => normalizeVehicle(r, true)),
    inativos: (inativos || []).map((r: any) => normalizeVehicle(r, false)),
  }
}

export async function alternarStatusVeiculo(tabelaEstoque: string, id: number | string, tornarAtivo: boolean) {
  const tableMap = await getNocoDBTableMap()
  const cleanName = (tabelaEstoque || "").toLowerCase().trim()
  const activeTableId = tableMap[cleanName] || (cleanName.startsWith("m0") ? cleanName : null)
  const inativoName = `${cleanName}_inativo`
  const inativoTableId = tableMap[inativoName]

  if (activeTableId && inativoTableId) {
    const originTableId = tornarAtivo ? inativoTableId : activeTableId
    const targetTableId = tornarAtivo ? activeTableId : inativoTableId

    // 1. Buscar dados do registro na tabela de origem
    const resGet = await fetch(`${NOCODB_URL}/api/v2/tables/${originTableId}/records/${id}`, {
      headers: { "xc-token": NOCODB_TOKEN },
    })

    if (!resGet.ok) {
      throw new Error(`Veículo não encontrado na tabela de origem (${resGet.status})`)
    }

    const item = await resGet.json()

    // 2. Montar payload limpo para a tabela de destino
    const payload = {
      chave_externa: item.chave_externa || String(Date.now()),
      marca: item.marca || "",
      modelo: item.modelo || "",
      versao: item.versao || null,
      ano: item.ano ? Number(item.ano) : null,
      cor: item.cor || null,
      quilometragem: item.quilometragem ? String(item.quilometragem) : null,
      combustivel: item.combustivel || null,
      cambio: item.cambio || null,
      valor_venda: item.valor_venda || null,
      fotos: item.fotos || { fotos: [] },
      opcionais: item.opcionais || null,
      subcategoria: item.subcategoria || null,
      tipo: item.tipo || null,
      atualizado_em: new Date().toISOString().split("T")[0],
    }

    // 3. Inserir na tabela de destino
    const resInsert = await fetch(`${NOCODB_URL}/api/v2/tables/${targetTableId}/records`, {
      method: "POST",
      headers: {
        "xc-token": NOCODB_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!resInsert.ok) {
      const err = await resInsert.text()
      throw new Error(`Falha ao inserir na tabela de destino: ${err}`)
    }

    // 4. Remover da tabela de origem (cumprindo a regra do usuário)
    await fetch(`${NOCODB_URL}/api/v2/tables/${originTableId}/records`, {
      method: "DELETE",
      headers: {
        "xc-token": NOCODB_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ Id: Number(id) }]),
    })

    return { success: true, novoStatus: tornarAtivo }
  }

  throw new Error("Tabelas de estoque ativa/inativa não configuradas no provedor.")
}

export async function criarVeiculo(tabelaEstoque: string, dados: Partial<VeiculoEstoque>) {
  const tableMap = await getNocoDBTableMap()
  const cleanName = (tabelaEstoque || "").toLowerCase().trim()
  const activeTableId = tableMap[cleanName] || (cleanName.startsWith("m0") ? cleanName : null)

  if (activeTableId) {
    const payload = {
      chave_externa: dados.chave_externa || String(Date.now()),
      marca: dados.marca || "",
      modelo: dados.modelo || "",
      versao: dados.versao || null,
      ano: dados.ano ? Number(dados.ano) : null,
      cor: dados.cor || null,
      quilometragem: dados.quilometragem ? String(dados.quilometragem) : null,
      combustivel: dados.combustivel || null,
      cambio: dados.cambio || null,
      valor_venda: dados.valor_venda || null,
      fotos: { fotos: dados.fotos || [] },
      opcionais: dados.opcionais ? { fotos: Array.isArray(dados.opcionais) ? dados.opcionais : [dados.opcionais] } : null,
      subcategoria: dados.subcategoria || null,
      tipo: dados.tipo || null,
      atualizado_em: new Date().toISOString().split("T")[0],
    }

    const res = await fetch(`${NOCODB_URL}/api/v2/tables/${activeTableId}/records`, {
      method: "POST",
      headers: {
        "xc-token": NOCODB_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Erro ao criar veículo: ${err}`)
    }

    return await res.json()
  }

  throw new Error("Tabela de estoque não configurada")
}

export async function editarVeiculo(tabelaEstoque: string, id: number | string, ativo: boolean, dados: Partial<VeiculoEstoque>) {
  const tableMap = await getNocoDBTableMap()
  const cleanName = (tabelaEstoque || "").toLowerCase().trim()
  const activeTableId = tableMap[cleanName]
  const inativoTableId = tableMap[`${cleanName}_inativo`]
  const tableId = ativo ? activeTableId : inativoTableId

  if (tableId) {
    const payload: any = {
      Id: Number(id),
      atualizado_em: new Date().toISOString().split("T")[0],
    }

    if (dados.marca !== undefined) payload.marca = dados.marca
    if (dados.modelo !== undefined) payload.modelo = dados.modelo
    if (dados.versao !== undefined) payload.versao = dados.versao
    if (dados.ano !== undefined) payload.ano = dados.ano ? Number(dados.ano) : null
    if (dados.cor !== undefined) payload.cor = dados.cor
    if (dados.quilometragem !== undefined) payload.quilometragem = String(dados.quilometragem)
    if (dados.combustivel !== undefined) payload.combustivel = dados.combustivel
    if (dados.cambio !== undefined) payload.cambio = dados.cambio
    if (dados.valor_venda !== undefined) payload.valor_venda = dados.valor_venda
    if (dados.fotos !== undefined) payload.fotos = { fotos: dados.fotos }
    if (dados.opcionais !== undefined) {
      payload.opcionais = { fotos: Array.isArray(dados.opcionais) ? dados.opcionais : [dados.opcionais] }
    }
    if (dados.subcategoria !== undefined) payload.subcategoria = dados.subcategoria
    if (dados.tipo !== undefined) payload.tipo = dados.tipo

    const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tableId}/records`, {
      method: "PATCH",
      headers: {
        "xc-token": NOCODB_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Erro ao editar veículo: ${err}`)
    }

    return await res.json()
  }

  throw new Error("Tabela de estoque não configurada")
}

export async function excluirVeiculo(tabelaEstoque: string, id: number | string, ativo: boolean) {
  const tableMap = await getNocoDBTableMap()
  const cleanName = (tabelaEstoque || "").toLowerCase().trim()
  const activeTableId = tableMap[cleanName]
  const inativoTableId = tableMap[`${cleanName}_inativo`]
  const tableId = ativo ? activeTableId : inativoTableId

  if (tableId) {
    const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tableId}/records`, {
      method: "DELETE",
      headers: {
        "xc-token": NOCODB_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ Id: Number(id) }]),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Erro ao excluir veículo: ${err}`)
    }

    return { success: true }
  }

  throw new Error("Tabela de estoque não configurada")
}
