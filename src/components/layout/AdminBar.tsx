"use client"

import { LogOut } from "lucide-react"

interface AdminBarProps {
  clientName: string;
}

export function AdminBar({ clientName }: AdminBarProps) {
  const handleStopImpersonating = async () => {
    // Apaga o cookie e recarrega
    document.cookie = 'impersonating_client_id=; Max-Age=0; path=/';
    window.location.href = '/admin/dashboard';
  }

  return (
    <div className="w-full bg-red-600 text-white px-4 py-2 flex items-center justify-between shadow-md z-50 relative">
      <div className="flex items-center text-sm font-semibold">
        <span className="bg-red-800 px-2 py-1 rounded mr-3 uppercase text-xs tracking-wide">
          Modo Admin
        </span>
        Você está visualizando a conta de: <strong className="ml-1">{clientName}</strong>
      </div>
      
      <button 
        onClick={handleStopImpersonating}
        className="flex items-center text-sm bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded transition-colors"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Voltar ao Admin
      </button>
    </div>
  )
}
