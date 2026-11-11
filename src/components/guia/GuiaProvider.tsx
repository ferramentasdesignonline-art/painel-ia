"use client"

import React, { createContext, useContext, useState, useMemo, useCallback } from "react"
import { usePathname } from "next/navigation"
import { GuiaItem, GUIA_ITEMS, getGuiaItemsForClient, getGuiaItemByPathname } from "@/lib/guia/guia-dados"

interface GuiaContextType {
  isOpen: boolean
  activeItem: GuiaItem | null
  availableItems: GuiaItem[]
  openGuia: (itemIdOrRoute?: string) => void
  closeGuia: () => void
  selectItem: (itemId: string) => void
}

const GuiaContext = createContext<GuiaContextType | null>(null)

export function GuiaProvider({
  children,
  tipoAtendimento,
  hasEstoque,
  hasBancos,
}: {
  children: React.ReactNode
  tipoAtendimento?: string
  hasEstoque?: boolean
  hasBancos?: boolean
}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // Módulos disponíveis para o cliente atual
  const availableItems = useMemo(() => {
    return getGuiaItemsForClient({ tipoAtendimento, hasEstoque, hasBancos })
  }, [tipoAtendimento, hasEstoque, hasBancos])

  // Item ativo baseado na rota atual ou na seleção manual
  const activeItem = useMemo(() => {
    if (selectedItemId) {
      const found = availableItems.find(i => i.id === selectedItemId)
      if (found) return found
    }
    return getGuiaItemByPathname(pathname, availableItems) || availableItems[0] || null
  }, [selectedItemId, pathname, availableItems])

  const openGuia = useCallback((itemIdOrRoute?: string) => {
    if (itemIdOrRoute) {
      const found = availableItems.find(i => i.id === itemIdOrRoute || i.route === itemIdOrRoute)
      if (found) {
        setSelectedItemId(found.id)
      } else {
        setSelectedItemId(null)
      }
    } else {
      setSelectedItemId(null)
    }
    setIsOpen(true)
  }, [availableItems])

  const closeGuia = useCallback(() => {
    setIsOpen(false)
  }, [])

  const selectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId)
  }, [])

  return (
    <GuiaContext.Provider
      value={{
        isOpen,
        activeItem,
        availableItems,
        openGuia,
        closeGuia,
        selectItem,
      }}
    >
      {children}
    </GuiaContext.Provider>
  )
}

export function useGuia() {
  const context = useContext(GuiaContext)
  if (!context) {
    throw new Error("useGuia deve ser usado dentro de um GuiaProvider")
  }
  return context
}
