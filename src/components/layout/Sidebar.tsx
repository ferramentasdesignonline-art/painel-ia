"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Calendar, Car, ShieldBan, LogOut, Trophy, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/app/(auth)/logout/actions"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Funil de Leads", href: "/funil", icon: Trophy },
  { name: "Bloqueios", href: "/bloqueios", icon: ShieldBan },
  { name: "Conexão WhatsApp", href: "/whatsapp", icon: MessageCircle },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-72 bg-[#0a0a0b] border-r border-[#1e1e20] text-gray-400">
      <div className="flex h-20 shrink-0 items-center px-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-500/20">
            <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white font-poppins">Design Online - IA</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
        <nav className="space-y-1.5 flex-1">
          {navigation.map((item) => {
            const isActive = item.href === "/dashboard" 
              ? pathname === "/dashboard" 
              : pathname.startsWith(item.href)
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
                    : "text-gray-400 hover:bg-white/[0.03] hover:text-gray-200"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3.5 flex-shrink-0 h-5 w-5 transition-colors",
                    isActive ? "text-indigo-400" : "text-gray-500 group-hover:text-gray-300"
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="px-4 py-8 border-t border-[#1e1e20]">
        <button
          onClick={() => logout()}
          className="w-full group flex items-center px-4 py-3 text-sm font-medium rounded-xl text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
        >
          <LogOut className="text-red-500/80 group-hover:text-red-500 mr-3.5 flex-shrink-0 h-5 w-5" />
          Sair do sistema
        </button>
      </div>
    </div>
  )
}
