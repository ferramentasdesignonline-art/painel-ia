import { NextResponse } from 'next/server';
import { getActiveClientConfig, getUserRole } from '@/lib/auth/helpers';
import { saveBankCredential } from '@/lib/credere/api';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { code: string } }) {
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

    const body = await request.json();

    const result = await saveBankCredential(storeId, params.code, body, version);

    // Sincroniza e atualiza o JSON de simulação no cadastro do cliente automaticamente
    try {
      const { syncClientSimulationJson } = await import('@/lib/credere/simulation-template');
      await syncClientSimulationJson(clientConfig.id, storeId);
    } catch (syncErr) {
      console.warn('Aviso ao sincronizar JSON de simulação após salvar credencial:', syncErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Credenciais salvas com sucesso. Estamos aguardando a validação do banco.',
      data: result,
    }, { status: 200 });
  } catch (err: any) {
    console.error(`Erro ao salvar credenciais do banco ${params.code}:`, err);

    if (err?.status === 403) {
      return NextResponse.json({
        error: 'Permissão pendente na Credere: O token precisa do escopo "bank_credentials" habilitado no portal Credere.',
        requires_scope: true,
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: err.message || 'Erro ao salvar credenciais na Credere' },
      { status: err.status || 500 }
    );
  }
}
