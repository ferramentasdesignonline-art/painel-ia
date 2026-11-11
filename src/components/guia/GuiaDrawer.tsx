"use client"

import React, { useState } from "react"
import { useGuia } from "./GuiaProvider"
import {
  X,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  LayoutDashboard,
  Users,
  Trophy,
  MessageSquare,
  MessageCircle,
  Landmark,
  Calculator,
  Car,
  ShieldBan,
  ChevronDown,
  ChevronRight,
  Info,
  ExternalLink,
  Flame,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  Users,
  Trophy,
  MessageSquare,
  MessageCircle,
  Landmark,
  Calculator,
  Car,
  ShieldBan,
  Sparkles,
}

export function GuiaDrawer() {
  const { isOpen, closeGuia, activeItem, availableItems, selectItem } = useGuia()
  const [activeTab, setActiveTab] = useState<"passo-a-passo" | "recursos" | "status" | "faq">("passo-a-passo")
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null)

  if (!isOpen || !activeItem) return null

  const IconComponent = ICON_MAP[activeItem.iconName] || BookOpen

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={closeGuia}
      />

      {/* Drawer Panel */}
      <aside className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col z-10 font-poppins border-l border-gray-100 animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <BookOpen className="w-3.5 h-3.5" />
                Guia & Tutorial
              </span>
              {activeItem.badge && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-gray-200">
                  {activeItem.badge}
                </span>
              )}
            </div>
            <button
              onClick={closeGuia}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Fechar guia"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <IconComponent className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">{activeItem.title}</h2>
              <p className="text-sm text-gray-300 mt-1 leading-snug">{activeItem.tagline}</p>
            </div>
          </div>

          {/* Module Selector Bar (Shows only client's enabled modules) */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Alternar para outra tela da sua loja:
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {availableItems.map((item) => {
                const ItemIcon = ICON_MAP[item.iconName] || BookOpen
                const isSelected = item.id === activeItem.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      selectItem(item.id)
                      setActiveTab("passo-a-passo")
                      setExpandedFaqIndex(null)
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                      isSelected
                        ? "bg-indigo-600 text-white font-semibold shadow-xs"
                        : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <ItemIcon className="w-3.5 h-3.5" />
                    <span>{item.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Inside Current Module */}
        <div className="flex border-b border-gray-100 bg-gray-50/80 px-6 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("passo-a-passo")}
            className={cn(
              "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
              activeTab === "passo-a-passo"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Passo a Passo
          </button>
          <button
            onClick={() => setActiveTab("recursos")}
            className={cn(
              "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
              activeTab === "recursos"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            <Info className="w-3.5 h-3.5" />
            Como Funciona
          </button>
          {activeItem.statusMeaning && activeItem.statusMeaning.length > 0 && (
            <button
              onClick={() => setActiveTab("status")}
              className={cn(
                "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                activeTab === "status"
                  ? "border-indigo-600 text-indigo-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Significado dos Status
            </button>
          )}
          <button
            onClick={() => setActiveTab("faq")}
            className={cn(
              "py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
              activeTab === "faq"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Dúvidas & Dicas
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-950 text-sm leading-relaxed">
            <span className="font-bold text-indigo-900 block mb-1">🎯 Objetivo principal:</span>
            {activeItem.summary}
          </div>

          {/* TAB: PASSO A PASSO */}
          {activeTab === "passo-a-passo" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Guia Rápido de Utilização
              </h3>
              <div className="space-y-3">
                {activeItem.stepByStep.map((s) => (
                  <div
                    key={s.step}
                    className="p-4 rounded-xl border border-gray-200/80 bg-white hover:border-indigo-200 transition-colors shadow-2xs"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {s.step}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{s.title}</h4>
                        <p className="text-gray-600 text-xs mt-1 leading-relaxed">{s.description}</p>
                        {s.tip && (
                          <div className="mt-2.5 p-2 rounded-lg bg-amber-50/80 border border-amber-200/60 text-amber-900 text-xs flex items-start gap-2">
                            <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Dica prática:</strong> {s.tip}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: COMO FUNCIONA (RECURSOS) */}
          {activeTab === "recursos" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                O que você encontra nesta tela
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {activeItem.keyFeatures.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200 transition-all shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{f.title}</h4>
                        <p className="text-gray-600 text-xs mt-1 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SIGNIFICADO DOS STATUS */}
          {activeTab === "status" && activeItem.statusMeaning && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Entendendo os Status e Alertas
              </h3>
              <div className="space-y-3">
                {activeItem.statusMeaning.map((st, idx) => {
                  const colorClass =
                    st.color === "green"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : st.color === "red"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : st.color === "amber"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : st.color === "blue"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-gray-100 text-gray-700 border-gray-200"

                  const badgeClass =
                    st.color === "green"
                      ? "bg-green-600"
                      : st.color === "red"
                      ? "bg-red-600"
                      : st.color === "amber"
                      ? "bg-amber-500"
                      : st.color === "blue"
                      ? "bg-blue-600"
                      : "bg-gray-500"

                  return (
                    <div
                      key={idx}
                      className={cn("p-4 rounded-xl border transition-all", colorClass)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn("w-2.5 h-2.5 rounded-full", badgeClass)} />
                        <span className="font-bold text-sm">{st.label}</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">{st.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB: DÚVIDAS & DICAS */}
          {activeTab === "faq" && (
            <div className="space-y-6">
              {/* Dicas de Ouro */}
              {activeItem.proTips.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Dicas de Ouro para Vender Mais
                  </h3>
                  <div className="space-y-2">
                    {activeItem.proTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-amber-950 text-xs flex items-start gap-2.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-medium">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Perguntas Frequentes */}
              {activeItem.faqs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-indigo-500" />
                    Perguntas Frequentes (FAQ)
                  </h3>
                  <div className="space-y-2">
                    {activeItem.faqs.map((faq, idx) => {
                      const isExpanded = expandedFaqIndex === idx
                      return (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                        >
                          <button
                            onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                            className="w-full p-3.5 text-left text-xs font-bold text-gray-800 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <span>{faq.question}</span>
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-2",
                                isExpanded && "rotate-180 text-indigo-600"
                              )}
                            />
                          </button>
                          {isExpanded && (
                            <div className="px-3.5 pb-3.5 pt-1 text-xs text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/40">
                              {faq.answer}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>Design Online • Central de Ajuda da Loja</span>
          <button
            onClick={closeGuia}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Entendido, fechar guia
          </button>
        </div>
      </aside>
    </div>
  )
}
