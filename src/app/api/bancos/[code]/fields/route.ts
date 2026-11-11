import { NextResponse } from 'next/server';
import { getActiveClientConfig, getUserRole } from '@/lib/auth/helpers';
import { getBankFields } from '@/lib/credere/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const { role } = await getUserRole();
    const { searchParams } = new URL(request.url);
    const clienteIdParam = searchParams.get('clienteId');

    let clientConfig = await getActiveClientConfig();

    if (role === 'master_admin' && clienteIdParam) {
      const { getNocoDBClienteById } = await import('@/lib/nocodb/sistema');
      const target = await getNocoDBClienteById(clienteIdParam);
      if (target) {
        clientConfig = target;
      }
    }

    if (!clientConfig) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const isEnabled = Boolean(
      clientConfig.modulo_bancos_habilitado === true || 
      clientConfig.modulo_bancos_habilitado === 'true' ||
      clientConfig.modulo_bancos_habilitado === 1
    );

    if (!isEnabled && role !== 'master_admin') {
      return NextResponse.json({ error: 'Módulo de Bancos desabilitado' }, { status: 403 });
    }

    const storeId = clientConfig.credere_store_id;
    if (!storeId) {
      return NextResponse.json({ error: 'Loja Credere não configurada' }, { status: 400 });
    }

    const version = searchParams.get('version') || undefined;

    const fieldsData = await getBankFields(storeId, params.code, version);
    return NextResponse.json(fieldsData, { status: 200 });
  } catch (err: any) {
    console.error(`Erro ao consultar campos do banco ${params.code}:`, err);

    // Se a Credere retornar 403 por falta do escopo bank_credentials no token atual
    if (err?.status === 403) {
      return NextResponse.json({
        error: 'Permissão pendente na Credere: O token da aplicação precisa do escopo "bank_credentials" habilitado no portal de parceiros Credere.',
        requires_scope: true,
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: err.message || 'Erro ao carregar campos da Credere' },
      { status: err.status || 500 }
    );
  }
}
