"use client"

import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { Building2 } from "lucide-react"

export function AdminHeader() {
  return (
    <header className="md:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-indigo-900 bg-indigo-950 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <Sheet>
        <SheetTrigger asChild>
          <button className="p-2 -ml-2 text-indigo-200 hover:bg-indigo-900 rounded-md">
            <Menu className="h-6 w-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-none bg-indigo-950">
          <AdminSidebar className="flex w-full" />
        </SheetContent>
      </Sheet>
      <div className="flex flex-1 items-center gap-2">
        <Building2 className="w-5 h-5 text-indigo-300" />
        <span className="font-bold text-lg text-white">Master Admin</span>
      </div>
    </header>
  )
}
