import { NextResponse } from "next/server"
import { getWacloudInstancias, createWacloudInstancia, updateWacloudInstancia } from "@/lib/nocodb/wacloud"
import { getNocoDBClientes } from "@/lib/nocodb/sistema"
import { fetchAllUazapiInstances } from "@/lib/wacloud/uazapi"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // 1. Busca instâncias diretamente da Uazapi (fonte da verdade de status e token)
    let uazInstances: any[] = []
    try {
      uazInstances = await fetchAllUazapiInstances()
    } catch (uazErr) {
      console.warn("Aviso ao buscar instâncias na Uazapi:", uazErr)
    }

    // 2. Busca instâncias cadastradas no NocoDB
    let nocoInstancias: any[] = []
    try {
      nocoInstancias = await getWacloudInstancias()
    } catch (nocoErr) {
      console.warn("Aviso ao buscar instâncias no NocoDB:", nocoErr)
    }

    // 3. Busca lista de clientes para associar nomes
    let clientesMap = new Map<string, string>()
    try {
      const clientes = await getNocoDBClientes()
      for (const c of clientes) {
        if (c.Id || c.id) {
          clientesMap.set(String(c.Id || c.id), c.nome)
        }
      }
    } catch (cliErr) {
      console.warn("Aviso ao buscar clientes:", cliErr)
    }

    // Mapa das instâncias do NocoDB por nome em minúsculas
    const nocoMap = new Map<string, any>()
    for (const inst of nocoInstancias) {
      if (inst.nome_instancia) {
        nocoMap.set(inst.nome_instancia.trim().toLowerCase(), inst)
      }
    }

    const resultadoMap = new Map<string, any>()

    // Processa instâncias da Uazapi
    for (const uaz of uazInstances) {
      if (!uaz?.name) continue
      const lowerName = uaz.name.trim().toLowerCase()
      const nocoInst = nocoMap.get(lowerName)

      const clienteId = nocoInst?.cliente_id || null
      const clienteNome = clienteId ? clientesMap.get(String(clienteId)) || null : null

      // Se a instância existe na Uazapi mas ainda não está gravada no NocoDB, salva em background
      if (!nocoInst && uaz.token) {
        (async () => {
          try {
            await createWacloudInstancia({
              nome_instancia: uaz.name,
              status: uaz.status || "connected",
              token: uaz.token,
              ativo: true,
            })
          } catch (_) {}
        })()
      } else if (nocoInst && uaz.token && nocoInst.token !== uaz.token) {
        // Se o token na Uazapi mudou, atualiza no NocoDB
        (async () => {
          try {
            await updateWacloudInstancia(nocoInst.Id || nocoInst.id, {
              token: uaz.token,
              status: uaz.status || nocoInst.status,
            })
          } catch (_) {}
        })()
      }

      resultadoMap.set(lowerName, {
        id: nocoInst?.Id || nocoInst?.id || uaz.id,
        nome_instancia: uaz.name,
        token: uaz.token,
        status: uaz.status || "disconnected",
        is_connected: uaz.status === "connected",
        owner: uaz.owner || null,
        profile_name: uaz.profileName || null,
        profile_pic_url: uaz.profilePicUrl || null,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
      })
    }

    // Adiciona instâncias do NocoDB que eventualmente não vieram na listagem da Uazapi
    for (const noco of nocoInstancias) {
      if (!noco?.nome_instancia) continue
      const lowerName = noco.nome_instancia.trim().toLowerCase()
      if (!resultadoMap.has(lowerName)) {
        const clienteId = noco.cliente_id || null
        const clienteNome = clienteId ? clientesMap.get(String(clienteId)) || null : null
        resultadoMap.set(lowerName, {
          id: noco.Id || noco.id,
          nome_instancia: noco.nome_instancia,
          token: noco.token || null,
          status: noco.status || "desconectado",
          is_connected: noco.status === "connected" || noco.status === "conectado",
          owner: null,
          profile_name: null,
          profile_pic_url: null,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
        })
      }
    }

    const listaFinal = Array.from(resultadoMap.values())
    // Ordenar: primeiro as conectadas, depois alfabético
    listaFinal.sort((a, b) => {
      if (a.is_connected && !b.is_connected) return -1
      if (!a.is_connected && b.is_connected) return 1
      return a.nome_instancia.localeCompare(b.nome_instancia)
    })

    return NextResponse.json({ instancias: listaFinal }, { status: 200 })
  } catch (err: any) {
    console.error("Erro na rota GET /api/admin/instancias:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
