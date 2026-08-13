"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Store, Building2, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/app/(auth)/logout/actions"

const navigation = [
  { name: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Clientes (SaaS)", href: "/admin/clientes", icon: Store },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 bg-indigo-950 border-r border-indigo-900 text-indigo-100">
      <div className="flex h-16 shrink-0 items-center px-6 bg-indigo-900 border-b border-indigo-800">
        <Building2 className="w-6 h-6 mr-2 text-indigo-300" />
        <span className="font-bold text-lg text-white">Master Admin</span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? "bg-indigo-800 text-white"
                    : "text-indigo-200 hover:bg-indigo-800 hover:text-white",
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? "text-white" : "text-indigo-300 group-hover:text-white",
                    "mr-3 flex-shrink-0 h-5 w-5"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-indigo-900 space-y-1">
        <Link
          href="/admin/configuracoes"
          className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors"
        >
          <Settings className="text-indigo-300 group-hover:text-white mr-3 flex-shrink-0 h-5 w-5" />
          Configurações
        </Link>
        <button
          onClick={() => logout()}
          className="w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md text-red-300 hover:bg-red-950/40 hover:text-red-200 transition-colors"
        >
          <LogOut className="text-red-400 group-hover:text-red-300 mr-3 flex-shrink-0 h-5 w-5" />
          Sair
        </button>
      </div>
    </div>
  )
}
