import { NextResponse } from "next/server"
import { getWacloudSupabaseAdmin } from "@/lib/wacloud/supabase"

export async function GET() {
  try {
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
