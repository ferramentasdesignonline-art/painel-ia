"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, LayoutDashboard, Users, Calendar, Car, ShieldBan, LogOut, Trophy, MessageCircle, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/app/(auth)/logout/actions"

const navigation = [
  { name: "Análise com IA", href: "/analise-ia", icon: Sparkles, badge: "Novo" },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Funil de Leads", href: "/funil", icon: Trophy },
  { name: "Estoque", href: "/estoque", icon: Car },
  { name: "WhatsApp Web", href: "/whatsapp-web", icon: MessageSquare },
  { name: "Bloqueios", href: "/bloqueios", icon: ShieldBan },
  { name: "Conexão WhatsApp", href: "/whatsapp", icon: MessageCircle },
]

export function Sidebar({ className, tipoAtendimento, hasEstoque }: { className?: string; tipoAtendimento?: string; hasEstoque?: boolean }) {
  const pathname = usePathname()

  const navItems = navigation.filter(item => {
    if (tipoAtendimento === 'sem_ia' && item.href === '/bloqueios') {
      return false
    }
    if (item.href === '/estoque' && !hasEstoque) {
      return false
    }
    return true
  })

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b] border-r border-[#1e1e20] text-gray-400 h-full", className || "hidden md:flex w-72")}>
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
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
            
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
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xs">
                    {item.badge}
                  </span>
                )}
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
