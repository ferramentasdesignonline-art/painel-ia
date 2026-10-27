import { NextResponse } from "next/server"
import { getWacloudInstancias } from "@/lib/nocodb/wacloud"
import { getWacloudSupabaseAdmin } from "@/lib/wacloud/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // 1. Tenta buscar no NocoDB
    try {
      const instancias = await getWacloudInstancias()
      if (instancias && instancias.length > 0) {
        return NextResponse.json({ instancias }, { status: 200 })
      }
    } catch (nocoErr) {
      console.warn("Aviso ao buscar instâncias no NocoDB:", nocoErr)
    }

    // 2. Fallback Supabase
    const wacloud = getWacloudSupabaseAdmin()
    const { data: instancias, error } = await wacloud
      .from('wacloud_instancias')
      .select('id, nome_instancia, token, cliente_id')
      .order('nome_instancia', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ instancias: instancias || [] }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
