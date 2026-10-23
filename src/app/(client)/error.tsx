"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Erro na aplicação:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[450px] p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm max-w-2xl mx-auto my-12">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Ops! Algo deu errado ao carregar a página</h2>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        Identificamos um problema temporário ao carregar estas informações. Clique no botão abaixo para tentar recarregar.
      </p>
      <Button
        onClick={() => reset()}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 shadow-md shadow-indigo-200"
      >
        <RefreshCw className="w-4 h-4" />
        Recarregar página
      </Button>
    </div>
  )
}
