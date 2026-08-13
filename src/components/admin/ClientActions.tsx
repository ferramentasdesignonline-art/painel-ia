"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreVertical, Edit, Power, PowerOff, Trash2, LogIn } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type ClientData = {
  id: string
  active: boolean
}

export function ClientActions({ client }: { client: ClientData }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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
      <form action={`/api/admin/impersonate`} method="POST">
        <input type="hidden" name="client_id" value={client.id} />
        <button type="submit" className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded text-xs font-semibold flex items-center">
          <LogIn className="w-3 h-3 mr-1" /> Acessar Conta
        </button>
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger className="p-1.5 hover:bg-gray-100 rounded-md transition-colors" disabled={loading}>
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 font-poppins">
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
