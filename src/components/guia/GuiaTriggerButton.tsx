"use client"

import React from "react"
import { useGuia } from "./GuiaProvider"
import { Sparkles, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

export function GuiaHeaderButton({ className }: { className?: string }) {
  const { openGuia } = useGuia()

  return (
    <button
      onClick={() => openGuia()}
      className={cn(
        "flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200/90 text-indigo-700 hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-300 text-xs font-bold transition-all shadow-2xs group cursor-pointer",
        className
      )}
      title="Aprenda como funciona esta tela"
    >
      <Sparkles className="w-3.5 h-3.5 text-indigo-600 group-hover:rotate-12 transition-transform" />
      <span className="hidden sm:inline">Como funciona esta tela?</span>
      <span className="sm:hidden">Guia</span>
    </button>
  )
}

export function GuiaSidebarButton({ className }: { className?: string }) {
  const { openGuia } = useGuia()

  return (
    <button
      onClick={() => openGuia()}
      className={cn(
        "w-full group flex items-center px-4 py-3 text-sm font-medium rounded-xl text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 hover:bg-indigo-900/40 hover:text-white hover:border-indigo-500/40 transition-all duration-200 cursor-pointer shadow-xs",
        className
      )}
    >
      <BookOpen className="text-indigo-400 group-hover:text-indigo-300 mr-3.5 flex-shrink-0 h-5 w-5" />
      <span className="flex-1 text-left font-semibold">Guia do Sistema</span>
      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
        Ajuda
      </span>
    </button>
  )
}
