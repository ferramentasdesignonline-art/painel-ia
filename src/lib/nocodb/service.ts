const NOCODB_URL = (process.env.NOCODB_URL || "https://evolution-nocodb.4lap5g.easypanel.host").replace(/\/+$/, "")
const NOCODB_TOKEN = process.env.NOCODB_API_TOKEN || "9Qz7ETxba8JnXq3B0e9ybHaSiDar6hLqYBIIkg7u"

export function isNocoDBClient(clientConfig: any): boolean {
  if (!clientConfig) return false
  return Boolean(
    clientConfig.supabase_url === "nocodb" ||
    clientConfig.banco_provider === "nocodb" ||
    clientConfig.tabela_estoque?.includes("cr_motors") ||
    clientConfig.tabela_leads?.includes("cr_motors") ||
    clientConfig.tabela_estoque?.startsWith("m0")
  )
}

export type NocoDBTableMeta = {
  id: string
  base_id: string
}

let tableMapCache: Record<string, NocoDBTableMeta> | null = null

export async function getNocoDBTableMap(): Promise<Record<string, NocoDBTableMeta>> {
  if (tableMapCache) return tableMapCache

  const map: Record<string, NocoDBTableMeta> = {}

  try {
    const basesRes = await fetch(`${NOCODB_URL}/api/v2/meta/bases`, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    })
    const basesData = basesRes.ok ? await basesRes.json() : { list: [] }
    const bases = basesData.list || []

    for (const b of bases) {
      const res = await fetch(`${NOCODB_URL}/api/v2/meta/bases/${b.id}/tables`, {
        headers: { "xc-token": NOCODB_TOKEN },
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.list)) {
          for (const t of data.list) {
            const meta: NocoDBTableMeta = { id: t.id, base_id: b.id }
            if (t.table_name) map[t.table_name.toLowerCase().trim()] = meta
            if (t.title) map[t.title.toLowerCase().trim()] = meta
            if (t.id) map[t.id.toLowerCase().trim()] = meta
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

export async function getNocoDBTableId(tableName: string): Promise<string | null> {
  if (!tableName) return null
  const map = await getNocoDBTableMap()
  const clean = tableName.toLowerCase().trim()
  return map[clean]?.id || null
}

export async function getNocoDBLeadById(tableName: string, leadId: string | number): Promise<any | null> {
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) return null

  try {
    const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tableId}/records/${leadId}`, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    })
    if (res.ok) {
      const row = await res.json()
      const id = row.Id || row.id
      return {
        ...row,
        id,
        Id: id,
        phone: row.telefone ? String(row.telefone).replace(/@.*$/, "").replace(/\D/g, "") : null,
      }
    }
  } catch (err) {
    console.error("Erro getNocoDBLeadById:", err)
  }
  return null
}

export async function getNocoDBLeads(
  tableName: string,
  options?: { from?: string | null; to?: string | null; diasAtras?: number }
): Promise<any[]> {
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) return []

  const allLeads: any[] = []
  const pageSize = 1000
  let offset = 0
  const maxRows = 25000

  while (offset < maxRows) {
    try {
      const res = await fetch(
        `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=${pageSize}&offset=${offset}`,
        {
          headers: { "xc-token": NOCODB_TOKEN },
          cache: "no-store",
        }
      )

      if (!res.ok) break
      const data = await res.json()
      const list = data.list || []
      if (list.length === 0) break

      for (const row of list) {
        const id = row.Id || row.id
        allLeads.push({
          ...row,
          id,
          Id: id,
          phone: row.telefone ? String(row.telefone).replace(/@.*$/, "").replace(/\D/g, "") : null,
          created_at: row.created_at || row.CreatedAt || row.update_lead || row.UpdatedAt || row.ultima_mensagem || new Date().toISOString(),
          updated_at: row.updated_at || row.UpdatedAt || row.update_lead,
        })
      }

      if (data.pageInfo?.isLastPage || list.length < pageSize) break
      offset += pageSize
    } catch (e) {
      console.error("Erro ao paginar leads NocoDB:", e)
      break
    }
  }

  // Filtragem de data se solicitado
  if (options?.from || options?.to || options?.diasAtras) {
    const fromDate = options.from
      ? new Date(options.from)
      : options.diasAtras
      ? new Date(Date.now() - options.diasAtras * 24 * 60 * 60 * 1000)
      : null
    const toDate = options.to ? new Date(options.to) : null

    return allLeads.filter((l) => {
      const d = l.created_at ? new Date(l.created_at) : null
      if (!d || isNaN(d.getTime())) return true
      if (fromDate && d < fromDate) return false
      if (toDate && d > toDate) return false
      return true
    })
  }

  return allLeads
}

export async function getNocoDBBlockedNumbers(tableName: string): Promise<Set<string>> {
  const blocked = new Set<string>()
  if (!tableName) return blocked

  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) return blocked

  try {
    const res = await fetch(
      `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=5000`,
      {
        headers: { "xc-token": NOCODB_TOKEN },
        cache: "no-store",
      }
    )
    if (!res.ok) return blocked
    const data = await res.json()
    for (const b of data.list || []) {
      if (b.bloqueio_existe === false) continue
      const num = b.numero_cliente || b.telefone
      if (!num) continue
      const digits = String(num).replace(/\D/g, "")
      if (digits) {
        blocked.add(digits)
        if (digits.startsWith("55") && digits.length >= 12) {
          blocked.add(digits.slice(2))
        }
        if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
          blocked.add(`55${digits}`)
        }
      }
    }
  } catch (err) {
    console.error("Erro ao buscar bloqueios NocoDB:", err)
  }

  return blocked
}

export async function getClientBloqueiosNocoDB(tableName: string): Promise<any[]> {
  if (!tableName) return []
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) return []

  try {
    const res = await fetch(
      `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=5000`,
      {
        headers: { "xc-token": NOCODB_TOKEN },
        cache: "no-store",
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.list || [])
      .filter((b: any) => b.bloqueio_existe !== false)
      .map((b: any) => ({
        id: b.Id || b.id,
        numero_cliente: b.numero_cliente || b.telefone,
        created_at: b.created_at || b.CreatedAt,
        bloqueio_existe: true,
      }))
  } catch (e) {
    console.error("Erro getClientBloqueiosNocoDB:", e)
    return []
  }
}

export async function addNocoDBBloqueio(tableName: string, numero_cliente: string): Promise<any> {
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) throw new Error("Tabela de bloqueios não encontrada no NocoDB")

  const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tableId}/records`, {
    method: "POST",
    headers: {
      "xc-token": NOCODB_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      numero_cliente,
      bloqueio_existe: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erro ao salvar bloqueio no NocoDB: ${err}`)
  }
  return await res.json()
}

export async function removeNocoDBBloqueio(tableName: string, id: string | number): Promise<any> {
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) throw new Error("Tabela de bloqueios não encontrada no NocoDB")

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
    throw new Error(`Erro ao remover bloqueio no NocoDB: ${err}`)
  }
  return { success: true }
}

export async function updateNocoDBLead(tableName: string, leadId: string | number, data: any): Promise<any> {
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) throw new Error("Tabela de leads não encontrada no NocoDB")

  // Remove campos de auditoria e auto-gerados do NocoDB
  const cleanPayload = { ...data }
  delete cleanPayload.update_lead
  delete cleanPayload.proximo_followup_em
  delete cleanPayload.CreatedAt
  delete cleanPayload.UpdatedAt
  delete cleanPayload.created_at
  delete cleanPayload.updated_at
  delete cleanPayload.id

  cleanPayload.Id = Number(leadId)

  const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tableId}/records`, {
    method: "PATCH",
    headers: {
      "xc-token": NOCODB_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanPayload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erro ao atualizar lead no NocoDB: ${err}`)
  }
  return await res.json()
}

export async function getNocoDBChatMessages(tableName: string, telefone: string): Promise<any[]> {
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) return []

  const pureNumbers = telefone.replace(/\D/g, "")
  const tailPhone = pureNumbers.slice(-8)

  try {
    const url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?where=(session_id,like,%25${tailPhone}%25)&sort=id&limit=1000`
    const res = await fetch(url, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    })

    if (!res.ok) {
      console.error(`Erro ao buscar chat NocoDB ${tableName}:`, await res.text())
      return []
    }

    const data = await res.json()
    const list = data.list || []

    return list.map((row: any) => {
      let msgData = row.message
      if (typeof msgData === "string") {
        try {
          msgData = JSON.parse(msgData)
        } catch {
          msgData = { type: "human", content: row.message }
        }
      }

      let content = msgData?.content || ""
      if (typeof content !== "string") {
        content = JSON.stringify(content)
      }

      return {
        id: row.id ? row.id.toString() : `${row.session_id}-${row.Id || Math.random()}`,
        type: msgData?.type === "human" ? "human" : "ai",
        message: content,
        created_at: row.created_at || row.CreatedAt || "",
      }
    })
  } catch (err) {
    console.error(`Erro getNocoDBChatMessages ${tableName}:`, err)
    return []
  }
}

export async function addNocoDBChatMessage(tableName: string, sessionId: string, message: any): Promise<any> {
  const tableId = await getNocoDBTableId(tableName)
  if (!tableId) throw new Error("Tabela de memória não encontrada no NocoDB")

  const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tableId}/records`, {
    method: "POST",
    headers: {
      "xc-token": NOCODB_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
      message: message,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erro ao salvar mensagem no NocoDB: ${err}`)
  }
  return await res.json()
}
