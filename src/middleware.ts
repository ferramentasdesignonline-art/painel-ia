import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: "",
            ...options,
          })
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error("Middleware Auth Error:", authError.message)
  }

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  
  // Log para sabermos o que está acontecendo no terminal
  console.log(`[Middleware] Rota: ${request.nextUrl.pathname} | Logado: ${!!user}`)

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Check if user is a Master Admin
    const { data: adminData } = await supabase
      .from('sistema-dash-ia-admins')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    const isMasterAdmin = !!adminData
    const isAdminPath = request.nextUrl.pathname.startsWith('/admin')

    // If on Auth Page and already logged in
    if (isAuthPage) {
      return NextResponse.redirect(new URL(isMasterAdmin ? '/admin/dashboard' : '/dashboard', request.url))
    }

    // Protect Admin Routes
    if (isAdminPath && !isMasterAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Automatically redirect Master Adin to their dashboard if they hit client paths without impersonating
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
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
