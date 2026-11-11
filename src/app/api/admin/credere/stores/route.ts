import { NextResponse } from 'next/server';
import { listCredereStores, getStoreBanks } from '@/lib/credere/api';
import { normalizeFebrabanCode } from '@/lib/credere/simulation-template';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeIdParam = searchParams.get('storeId');

    const stores = await listCredereStores();

    if (storeIdParam) {
      const cleanStoreId = storeIdParam.trim();
      const currentStore = stores.find(s => String(s.id) === cleanStoreId);

      const storeBanksData = await getStoreBanks(cleanStoreId);
      const configuredCodes = (storeBanksData.bancos || [])
        .filter(b => b.status !== 'none')
        .map(b => normalizeFebrabanCode(b.code));

      return NextResponse.json({
        store: currentStore || null,
        bancos: storeBanksData.bancos,
        configured_febraban_codes: Array.from(new Set(configuredCodes)),
        resumo: storeBanksData.resumo,
      }, { status: 200 });
    }

    return NextResponse.json({ stores }, { status: 200 });
  } catch (err: any) {
    console.error('Erro ao consultar API da Credere:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao consultar Credere' },
      { status: err.status || 500 }
    );
  }
}
