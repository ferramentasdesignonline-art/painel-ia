"use client"

import { LogOut, Menu } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/Sidebar"
import { logout } from "@/app/(auth)/logout/actions"

export function Header({ clientName, clientEmail }: { clientName?: string, clientEmail?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-20 shrink-0 items-center gap-x-4 border-b border-gray-100 bg-white/80 backdrop-blur-md px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <button className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 border-none">
              <Sidebar className="flex w-full" />
            </SheetContent>
          </Sheet>
          
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-gray-500">
            <span>Portal</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900">Dashboard</span>
          </div>
        </div>
        
        <div className="flex items-center gap-x-4 lg:gap-x-5">
          {/* Dealer Name (Not Clickable) */}
          <div className="hidden md:flex flex-col items-end mr-1">
            <span className="text-sm font-semibold text-gray-900">{clientName || "Concessionária"}</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Plano Premium</span>
          </div>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="flex items-center p-1 rounded-full hover:bg-gray-50 transition-colors cursor-pointer ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                <Avatar className="h-9 w-9 border-2 border-white shadow-sm font-poppins">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs">{clientName ? clientName.substring(0, 2).toUpperCase() : 'CC'}</AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 font-poppins" align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-4 font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-gray-900 leading-none">{clientName || "Concessionária"}</p>
                    <p className="text-xs text-gray-500">{clientEmail || "contato@..."}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => logout()}
                className="text-red-600 focus:text-red-600 cursor-pointer flex items-center py-2.5 font-medium"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sair do sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
