"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreVertical, Edit, Power, PowerOff, Trash2, LogIn, Copy, Check } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type ClientData = {
  id: string | number
  active: boolean
  nome?: string
  email?: string
  senha?: string
  slug?: string
}

export function ClientActions({ client }: { client: ClientData }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyLogin = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const loginUrl = `${origin}/login`
    const email = client.email || '(não informado)'
    const senha = client.senha || '(não cadastrada)'
    const nome = client.nome || 'Cliente'

    const textToCopy = `*Dados de Acesso ao Painel*

👤 *Cliente:* ${nome}
🔗 *Link de Acesso:* ${loginUrl}
📧 *E-mail:* ${email}
🔑 *Senha:* ${senha}`

    const markCopied = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(markCopied).catch(() => {
        fallbackCopy(textToCopy)
        markCopied()
      })
    } else {
      fallbackCopy(textToCopy)
      markCopied()
    }
  }

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.opacity = "0"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
    } catch (err) {
      console.error("Falha ao copiar:", err)
    }
  }

  const handleAction = async (acao: string) => {
    if (acao === 'delete' && !confirm("Tem certeza que deseja excluir este cliente? O cadastro será removido mas os dados de leads não serão afetados.")) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/clientes/acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, acao })
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert("Erro ao realizar ação")
      }
    } catch (e) {
      console.error(e)
      alert("Erro ao realizar ação")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Botão Copiar Login */}
      <button
        type="button"
        onClick={handleCopyLogin}
        title="Copiar link, email e senha de acesso ao painel"
        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
          copied
            ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs"
            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-700 font-bold">Copiado!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            <span>Copiar Login</span>
          </>
        )}
      </button>

      {/* Botão Acessar Conta (Impersonate) */}
      <form action={`/api/admin/impersonate`} method="POST">
        <input type="hidden" name="client_id" value={client.id} />
        <button
          type="submit"
          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors cursor-pointer"
        >
          <LogIn className="w-3 h-3 mr-1" /> Acessar Conta
        </button>
      </form>

      {/* Menu com Mais Opções */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
          disabled={loading}
        >
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 font-poppins">
          <DropdownMenuItem onClick={handleCopyLogin} className="cursor-pointer">
            <Copy className="w-4 h-4 mr-2 text-indigo-500" /> Copiar Dados de Login
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(`/admin/clientes/${client.id}`)} className="cursor-pointer">
            <Edit className="w-4 h-4 mr-2 text-blue-500" /> Editar Cliente
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {client.active ? (
            <DropdownMenuItem onClick={() => handleAction('deactivate')} className="cursor-pointer">
              <PowerOff className="w-4 h-4 mr-2 text-yellow-500" /> Desativar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => handleAction('activate')} className="cursor-pointer">
              <Power className="w-4 h-4 mr-2 text-green-500" /> Ativar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAction('delete')} className="cursor-pointer text-red-600 focus:text-red-700">
            <Trash2 className="w-4 h-4 mr-2" /> Excluir Cadastro
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
