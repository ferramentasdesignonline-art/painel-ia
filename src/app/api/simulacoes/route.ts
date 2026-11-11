import { NextResponse } from 'next/server';
import { getActiveClientConfig, getUserRole } from '@/lib/auth/helpers';
import { listStoreSimulations } from '@/lib/credere/api';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: Request) {
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
      return NextResponse.json(
        { error: 'Não autenticado ou nenhum cliente selecionado.' },
        { status: 401 }
      );
    }

    // Verifica se o módulo de bancos/simulações está habilitado para este cliente
    const isEnabled = Boolean(
      clientConfig.modulo_bancos_habilitado === true || 
      clientConfig.modulo_bancos_habilitado === 'true' ||
      clientConfig.modulo_bancos_habilitado === 1
    );

    if (!isEnabled && role !== 'master_admin') {
      return NextResponse.json(
        { error: 'O módulo de Bancos e Simulações não está habilitado para esta loja. Entre em contato com o administrador.' },
        { status: 403 }
      );
    }

    const storeId = clientConfig.credere_store_id;
    if (!storeId) {
      return NextResponse.json(
        {
          pendente: true,
          error: 'Integração pendente: ID da loja Credere (store_id) não foi configurado pelo administrador.',
          cliente_nome: clientConfig.nome || 'Lojista',
          modulo_habilitado: isEnabled,
          simulations: [],
          total: 0,
        },
        { status: 200 }
      );
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '15', 10);
    const customer = searchParams.get('customer') || undefined;
    const sort = searchParams.get('sort') || 'created_at_desc';
    const rawAfter = searchParams.get('after') || undefined;
    const rawBefore = searchParams.get('before') || undefined;
    const bankCode = searchParams.get('bank_code') || undefined;
    const status = searchParams.get('status') || 'todos'; // 'todos' | 'aprovadas' | 'reprovadas'

    // Formata datas para garantir intervalo de dia completo se vierem como YYYY-MM-DD
    const after = rawAfter ? (rawAfter.includes('T') ? rawAfter : `${rawAfter}T00:00:00Z`) : undefined;
    const before = rawBefore ? (rawBefore.includes('T') ? rawBefore : `${rawBefore}T23:59:59Z`) : undefined;

    // Quando filtrar por status, traz mais registros por página para alimentar o filtro
    const fetchPerPage = status !== 'todos' ? Math.max(perPage, 50) : perPage;

    const result = await listStoreSimulations(storeId, {
      page,
      per_page: fetchPerPage,
      customer,
      sort,
      after,
      before,
      bank_code: bankCode,
    });

    let filteredSimulations = result.simulations;

    if (status === 'aprovadas') {
      filteredSimulations = filteredSimulations.filter((s) =>
        (s.conditions || []).some((c) => c.available || (c.success && !c.reason))
      );
    } else if (status === 'reprovadas') {
      filteredSimulations = filteredSimulations.filter((s) =>
        !(s.conditions || []).some((c) => c.available || (c.success && !c.reason))
      );
    }

    return NextResponse.json({
      success: true,
      store_id: storeId,
      cliente_nome: clientConfig.nome,
      simulations: filteredSimulations,
      paging: result.paging,
      total: status !== 'todos' ? filteredSimulations.length : result.total,
    });
  } catch (err: any) {
    console.error('Erro na rota GET /api/simulacoes:', err);
    return NextResponse.json(
      {
        error: err.message || 'Falha ao consultar simulações na Credere.',
        status: err.status || 500,
      },
      { status: 500 }
    );
  }
}
