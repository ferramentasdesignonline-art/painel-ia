import { NextResponse } from 'next/server';
import { getActiveClientConfig, getUserRole } from '@/lib/auth/helpers';
import { getStoreBanks } from '@/lib/credere/api';

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

    // Verifica se o módulo de bancos está habilitado para este cliente
    const isEnabled = Boolean(
      clientConfig.modulo_bancos_habilitado === true || 
      clientConfig.modulo_bancos_habilitado === 'true' ||
      clientConfig.modulo_bancos_habilitado === 1
    );

    if (!isEnabled && role !== 'master_admin') {
      return NextResponse.json(
        { error: 'O módulo de Bancos não está habilitado para esta loja. Entre em contato com o administrador.' },
        { status: 403 }
      );
    }

    // Verifica se o credere_store_id está configurado
    const storeId = clientConfig.credere_store_id;
    if (!storeId) {
      return NextResponse.json(
        { 
          pendente: true,
          error: 'Integração pendente: ID da loja Credere (store_id) não foi configurado pelo administrador.',
          cliente_nome: clientConfig.nome || 'Lojista',
          modulo_habilitado: isEnabled,
        },
        { status: 200 }
      );
    }

    // Consulta a API oficial da Credere
    const result = await getStoreBanks(storeId);

    return NextResponse.json({
      success: true,
      store_id: storeId,
      cliente_nome: clientConfig.nome,
      modulo_habilitado: isEnabled,
      bancos: result.bancos,
      resumo: result.resumo,
      ultima_sincronizacao: result.ultima_sincronizacao,
    });
  } catch (err: any) {
    console.error('Erro na rota GET /api/bancos:', err);
    return NextResponse.json(
      { 
        error: err.message || 'Não foi possível consultar a Credere neste momento. Tente novamente.',
        status: err.status || 500,
      },
      { status: 500 }
    );
  }
}
