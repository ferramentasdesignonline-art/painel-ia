"use client"

import { useState } from "react"
import { Smartphone, Users, MessageSquare } from "lucide-react"
import { GerenciarClientesTab } from "./_components/GerenciarClientesTab"
import { ConversasTab } from "./_components/ConversasTab"

export default function WhatsappCloudPage() {
  const [activeTab, setActiveTab] = useState<'gerenciar' | 'conversas'>('gerenciar')

  return (
    <div className="p-4 sm:p-8 font-poppins">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-2 flex items-center gap-3 tracking-tight">
          <Smartphone className="h-8 w-8 text-indigo-600" />
          WhatsApp Cloud
        </h1>
        <p className="text-gray-500 font-medium">
          Gerencie instâncias adicionais do WhatsApp e acompanhe todas as conversas centralizadas.
        </p>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('gerenciar')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'gerenciar'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Users className="h-4 w-4" />
          Gerenciar Clientes
        </button>
        <button
          onClick={() => setActiveTab('conversas')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'conversas'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Conversas
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        {activeTab === 'gerenciar' && <GerenciarClientesTab />}
        {activeTab === 'conversas' && <ConversasTab />}
      </div>
    </div>
  )
}
