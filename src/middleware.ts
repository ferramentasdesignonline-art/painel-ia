import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { verifySessionToken } from "@/lib/auth/session"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  
  if (request.nextUrl.pathname.startsWith('/api/wacloud')) {
    return response
  }

  // 1. Tenta autenticar pelo novo token de sessão JWT (NocoDB)
  const sessionCookie = request.cookies.get('painel_session')?.value
  let sessionUser: { id: string | number; email: string; role: 'master_admin' | 'client' } | null = null

  if (sessionCookie) {
    const verified = await verifySessionToken(sessionCookie)
    if (verified) {
      sessionUser = {
        id: verified.userId,
        email: verified.email,
        role: verified.role,
      }
    }
  }

  let isMasterAdmin = sessionUser?.role === 'master_admin'
  let isAuthenticated = !!sessionUser

  // 2. Fallback para Supabase Auth antigo se não houver painel_session
  if (!isAuthenticated) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: "", ...options })
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set({ name, value: "", ...options })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      isAuthenticated = true
      const { data: adminData } = await supabase
        .from('sistema-dash-ia-admins')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      isMasterAdmin = !!adminData
    }
  }

  // Se não estiver logado e não for a página de login -> redireciona para login
  if (!isAuthenticated && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthenticated) {
    const isAdminPath = request.nextUrl.pathname.startsWith('/admin')

    // Se estiver na página de login e já logado -> redireciona para a home certa
    if (isAuthPage) {
      return NextResponse.redirect(new URL(isMasterAdmin ? '/admin/dashboard' : '/dashboard', request.url))
    }

    // Protege rotas de Admin
    if (isAdminPath && !isMasterAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Se for Admin e tentar acessar /dashboard sem impersonar -> vai para /admin/dashboard
    if (!isAdminPath && isMasterAdmin && request.nextUrl.pathname.startsWith('/dashboard')) {
      const isImpersonating = request.cookies.get('impersonating_client_id')?.value
      if (!isImpersonating) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
