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

interface TableMeta {
  id: string
  base_id: string
}

// Cache de mapeamento de nome de tabela para meta do NocoDB
let tableMapCache: Record<string, TableMeta> | null = null

async function getNocoDBTableMap(): Promise<Record<string, TableMeta>> {
  if (tableMapCache) return tableMapCache

  const map: Record<string, TableMeta> = {}

  try {
    // 1. Buscar todas as bases do NocoDB
    const basesRes = await fetch(`${NOCODB_URL}/api/v2/meta/bases`, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    })
    const basesData = basesRes.ok ? await basesRes.json() : { list: [] }
    const bases = basesData.list || []

    // 2. Para cada base, buscar suas tabelas
    for (const b of bases) {
      const res = await fetch(`${NOCODB_URL}/api/v2/meta/bases/${b.id}/tables`, {
        headers: { "xc-token": NOCODB_TOKEN },
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.list)) {
          for (const t of data.list) {
            const meta: TableMeta = { id: t.id, base_id: b.id }
            if (t.table_name) map[t.table_name.toLowerCase()] = meta
            if (t.title) map[t.title.toLowerCase()] = meta
            if (t.id) map[t.id.toLowerCase()] = meta
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro ao mapear tabelas NocoDB:", err)
  }

  tableMapCache = map
  return map
}

async function ensureInativoTable(baseId: string, cleanName: string): Promise<string> {
  const inativoName = `${cleanName}_inativo`

  const res = await fetch(`${NOCODB_URL}/api/v2/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      "xc-token": NOCODB_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      table_name: inativoName,
      title: inativoName,
      columns: [
        { column_name: "chave_externa", title: "chave_externa", uidt: "SingleLineText" },
        { column_name: "marca", title: "marca", uidt: "SingleLineText" },
        { column_name: "modelo", title: "modelo", uidt: "SingleLineText" },
        { column_name: "versao", title: "versao", uidt: "SingleLineText" },
        { column_name: "ano", title: "ano", uidt: "Number" },
        { column_name: "cor", title: "cor", uidt: "SingleLineText" },
        { column_name: "quilometragem", title: "quilometragem", uidt: "SingleLineText" },
        { column_name: "combustivel", title: "combustivel", uidt: "SingleLineText" },
        { column_name: "cambio", title: "cambio", uidt: "SingleLineText" },
        { column_name: "valor_venda", title: "valor_venda", uidt: "SingleLineText" },
        { column_name: "fotos", title: "fotos", uidt: "JSON" },
        { column_name: "opcionais", title: "opcionais", uidt: "JSON" },
        { column_name: "subcategoria", title: "subcategoria", uidt: "SingleLineText" },
        { column_name: "tipo", title: "tipo", uidt: "SingleLineText" },
        { column_name: "atualizado_em", title: "atualizado_em", uidt: "SingleLineText" },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Falha ao criar tabela de inativos: ${errText}`)
  }

  const created = await res.json()
  // Limpar cache para atualizar mapeamento
  tableMapCache = null
  return created.id
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
  const activeMeta = tableMap[cleanName]

  if (activeMeta) {
    // 1. Tabela ativa no NocoDB
    const resAtivos = await fetch(`${NOCODB_URL}/api/v2/tables/${activeMeta.id}/records?limit=250`, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    })
    const dataAtivos = resAtivos.ok ? await resAtivos.json() : { list: [] }
    const veiculosAtivos = (dataAtivos.list || []).map((r: any) => normalizeVehicle(r, true))

    // 2. Tabela de inativos no NocoDB (${cleanName}_inativo)
    const inativoName = `${cleanName}_inativo`
    const inativoMeta = tableMap[inativoName]

    let veiculosInativos: VeiculoEstoque[] = []
    if (inativoMeta) {
      const resInativos = await fetch(`${NOCODB_URL}/api/v2/tables/${inativoMeta.id}/records?limit=250`, {
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

  const { data: ativos } = await supabase.from(cleanName).select("*")
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
  const activeMeta = tableMap[cleanName]

  if (activeMeta) {
    const inativoName = `${cleanName}_inativo`
    let inativoMeta = tableMap[inativoName]

    // Se a tabela inativa ainda não existir no NocoDB, cria dinamicamente na mesma base
    if (!inativoMeta && activeMeta.base_id) {
      const inativoId = await ensureInativoTable(activeMeta.base_id, cleanName)
      inativoMeta = { id: inativoId, base_id: activeMeta.base_id }
    }

    if (!inativoMeta) {
      throw new Error("Não foi possível localizar ou criar a tabela de inativos no NocoDB.")
    }

    const originTableId = tornarAtivo ? inativoMeta.id : activeMeta.id
    const targetTableId = tornarAtivo ? activeMeta.id : inativoMeta.id

    // 1. Buscar dados do registro na tabela de origem
    const resGet = await fetch(`${NOCODB_URL}/api/v2/tables/${originTableId}/records/${id}`, {
      headers: { "xc-token": NOCODB_TOKEN },
    })

    if (!resGet.ok) {
      throw new Error(`Veículo não encontrado na tabela de origem (${resGet.status})`)
    }

    const item = await resGet.json()

    // 2. Montar payload para a tabela de destino
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

    // 4. Remover da tabela de origem
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

  throw new Error("Tabela de estoque não encontrada no NocoDB ou Supabase.")
}

export async function criarVeiculo(tabelaEstoque: string, dados: Partial<VeiculoEstoque>) {
  const tableMap = await getNocoDBTableMap()
  const cleanName = (tabelaEstoque || "").toLowerCase().trim()
  const activeMeta = tableMap[cleanName]

  if (activeMeta) {
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

    const res = await fetch(`${NOCODB_URL}/api/v2/tables/${activeMeta.id}/records`, {
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
  const activeMeta = tableMap[cleanName]
  const inativoMeta = tableMap[`${cleanName}_inativo`]
  const tableId = ativo ? activeMeta?.id : inativoMeta?.id

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
  const activeMeta = tableMap[cleanName]
  const inativoMeta = tableMap[`${cleanName}_inativo`]
  const tableId = ativo ? activeMeta?.id : inativoMeta?.id

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
