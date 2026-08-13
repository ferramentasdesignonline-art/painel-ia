import { redirect } from "next/navigation"

export default function Home() {
  // O middleware cuidará do redirecionamento baseado na sessão, 
  // mas forçar um redirecionamento inicial aqui garante que o usuário 
  // nunca veja a página de "Welcome" do Next.js.
  redirect("/login")
}
