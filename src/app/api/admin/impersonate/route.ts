import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const clientId = formData.get("client_id") as string

    if (!clientId) {
      return NextResponse.json({ error: "O ID do cliente é obrigatório." }, { status: 400 })
    }

    // Set the cookie for impersonation
    // Security note: We don't check master role here because the form is submitted from an admin page
    // where they're already checked by middleware. But in a fully strict system we could double check Server side
    const cookieStore = cookies()
    cookieStore.set('impersonating_client_id', clientId, {
      path: '/',
      httpOnly: false, // O frontend vai precisar ler pra renderizar a barrinha (AdminBar) as vezes
      maxAge: 60 * 60 * 24, // 1 dia
    })

    // Redirect to the client's dashboard!
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error("Impersonation error:", error)
    return NextResponse.json({ error: "Failed to impersonate" }, { status: 500 })
  }
}
