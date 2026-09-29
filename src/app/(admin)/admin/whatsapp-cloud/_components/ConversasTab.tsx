"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, RefreshCcw, MessageSquare, User, FileText, Mic, Image, Video, Phone, Search } from "lucide-react"

interface Contato {
  telefone_contato: string
  nome_contato: string | null
  nome_instancia: string
  ultima_mensagem: string | null
  ultimo_tipo: string
  ultimo_timestamp: string
}

interface Mensagem {
  id: string
  nome_instancia: string
  telefone_contato: string
  nome_contato: string | null
  mensagem: string | null
  enviado_por_mim: boolean
  tipo_mensagem: string
  url_midia: string | null
  mimetype: string | null
  timestamp_whatsapp: string
  created_at: string
}

function getTypeIcon(tipo: string) {
  switch (tipo) {
    case 'audio': return <Mic className="w-3 h-3 inline-block mr-1" />
    case 'image': return <Image className="w-3 h-3 inline-block mr-1" />
    case 'video': return <Video className="w-3 h-3 inline-block mr-1" />
    case 'document': return <FileText className="w-3 h-3 inline-block mr-1" />
    default: return null
  }
}

function getTypeLabel(tipo: string, mensagem: string | null) {
  if (mensagem) return mensagem
  switch (tipo) {
    case 'audio': return '🎵 Áudio'
    case 'image': return '📷 Imagem'
    case 'video': return '🎥 Vídeo'
    case 'document': return '📄 Documento'
    default: return '(mensagem)'
  }
}

function formatTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatFullTime(ts: string) {
  return new Date(ts).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

function getInitials(name: string | null, phone: string) {
  if (name) return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return phone.slice(-2)
}

function getAvatarColor(str: string) {
  const colors = [
    'bg-indigo-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500',
    'bg-pink-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500'
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function ConversasTab() {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [contatosFiltrados, setContatosFiltrados] = useState<Contato[]>([])
  const [selectedContato, setSelectedContato] = useState<Contato | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [busca, setBusca] = useState("")
  const [filtroInstancia, setFiltroInstancia] = useState("")
  const [instancias, setInstancias] = useState<string[]>([])
  const chatRef = useRef<HTMLDivElement>(null)

  const fetchContatos = async () => {
    try {
      const url = filtroInstancia
        ? `/api/wacloud/conversas?instancia=${encodeURIComponent(filtroInstancia)}`
        : '/api/wacloud/conversas'
      const res = await fetch(url)
      const data = await res.json()
      const lista: Contato[] = data.contatos || []
      setContatos(lista)
      setContatosFiltrados(lista)

      // Extrair instancias únicas
      const uniqueInstancias = [...new Set(lista.map(c => c.nome_instancia))]
      setInstancias(uniqueInstancias)
    } catch (err) {
      console.error('Erro ao buscar contatos', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMensagens = async (contato: Contato) => {
    setLoadingMsgs(true)
    setMensagens([])
    try {
      const res = await fetch(
        `/api/wacloud/conversas/${encodeURIComponent(contato.telefone_contato)}?instancia=${encodeURIComponent(contato.nome_instancia)}`
      )
      const data = await res.json()
      setMensagens(data.mensagens || [])
    } catch (err) {
      console.error('Erro ao buscar mensagens', err)
    } finally {
      setLoadingMsgs(false)
    }
  }

  useEffect(() => { fetchContatos() }, [filtroInstancia])

  useEffect(() => {
    if (!busca.trim()) {
      setContatosFiltrados(contatos)
    } else {
      const q = busca.toLowerCase()
      setContatosFiltrados(
        contatos.filter(c =>
          (c.nome_contato || '').toLowerCase().includes(q) ||
          c.telefone_contato.includes(q)
        )
      )
    }
  }, [busca, contatos])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensagens])

  const handleSelectContato = (contato: Contato) => {
    setSelectedContato(contato)
    fetchMensagens(contato)
  }

  // Auto-refresh a cada 30s se uma conversa estiver aberta
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedContato) fetchMensagens(selectedContato)
      fetchContatos()
    }, 30000)
    return () => clearInterval(interval)
  }, [selectedContato, filtroInstancia])

  return (
    <div className="flex h-[calc(100vh-240px)] min-h-[500px] overflow-hidden rounded-xl border border-gray-200">
      {/* ===== PAINEL ESQUERDO - Lista de Contatos ===== */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm">Conversas</h3>
            <button
              onClick={fetchContatos}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
              title="Atualizar"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Busca */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar contato..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          {/* Filtro instância */}
          {instancias.length > 1 && (
            <select
              value={filtroInstancia}
              onChange={e => setFiltroInstancia(e.target.value)}
              className="w-full text-xs py-1.5 px-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-600"
            >
              <option value="">Todas as instâncias</option>
              {instancias.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : contatosFiltrados.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              Nenhuma conversa ainda
            </div>
          ) : (
            contatosFiltrados.map((contato) => {
              const key = `${contato.nome_instancia}:${contato.telefone_contato}`
              const selectedKey = selectedContato
                ? `${selectedContato.nome_instancia}:${selectedContato.telefone_contato}`
                : ''
              const isSelected = key === selectedKey
              const initials = getInitials(contato.nome_contato, contato.telefone_contato)
              const avatarColor = getAvatarColor(contato.telefone_contato)

              return (
                <button
                  key={key}
                  onClick={() => handleSelectContato(contato)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${
                    isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold ${avatarColor}`}>
                    {initials}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className="font-semibold text-gray-900 text-sm truncate pr-2">
                        {contato.nome_contato || contato.telefone_contato}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatTime(contato.ultimo_timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {getTypeIcon(contato.ultimo_tipo)}
                      {getTypeLabel(contato.ultimo_tipo, contato.ultima_mensagem)}
                    </p>
                    <span className="text-[10px] text-indigo-400 font-medium">{contato.nome_instancia}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ===== PAINEL DIREITO - Chat ===== */}
      <div className="flex-1 flex flex-col bg-[#efeae2]">
        {!selectedContato ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-16 h-16 mb-4 text-gray-300" />
            <p className="font-semibold text-gray-500">Selecione uma conversa</p>
            <p className="text-sm mt-1">Escolha um contato na lista ao lado</p>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <div className="bg-[#f0f2f5] px-4 py-3 border-b border-gray-200 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getAvatarColor(selectedContato.telefone_contato)}`}>
                {getInitials(selectedContato.nome_contato, selectedContato.telefone_contato)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">
                  {selectedContato.nome_contato || selectedContato.telefone_contato}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {selectedContato.telefone_contato} · <span className="text-indigo-500 font-medium">{selectedContato.nome_instancia}</span>
                </p>
              </div>
              <button
                onClick={() => selectedContato && fetchMensagens(selectedContato)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                title="Atualizar conversa"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Mensagens */}
            <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {loadingMsgs ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : mensagens.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">Nenhuma mensagem encontrada</div>
              ) : (
                mensagens.map((msg, idx) => {
                  const isMe = msg.enviado_por_mim
                  const showDate = idx === 0 || (
                    new Date(msg.timestamp_whatsapp).toDateString() !==
                    new Date(mensagens[idx - 1].timestamp_whatsapp).toDateString()
                  )

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="bg-white/80 text-gray-500 text-[11px] px-3 py-1 rounded-full shadow-sm">
                            {new Date(msg.timestamp_whatsapp).toLocaleDateString('pt-BR', {
                              weekday: 'long', day: '2-digit', month: 'long'
                            })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-3 py-2 shadow-sm relative ${
                            isMe
                              ? 'bg-[#d9fdd3] rounded-br-sm'
                              : 'bg-white rounded-bl-sm'
                          }`}
                        >
                          {/* Mídia */}
                          {msg.tipo_mensagem === 'image' && msg.url_midia && (
                            <img
                              src={msg.url_midia}
                              alt="Imagem"
                              className="rounded-xl mb-1 max-w-full max-h-48 object-cover cursor-pointer"
                              onClick={() => window.open(msg.url_midia!, '_blank')}
                            />
                          )}
                          {msg.tipo_mensagem === 'video' && msg.url_midia && (
                            <video
                              src={msg.url_midia}
                              controls
                              className="rounded-xl mb-1 max-w-full max-h-48"
                            />
                          )}
                          {msg.tipo_mensagem === 'audio' && msg.url_midia && (
                            <audio src={msg.url_midia} controls className="w-full mb-1" />
                          )}
                          {msg.tipo_mensagem === 'document' && msg.url_midia && (
                            <a
                              href={msg.url_midia}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 mb-1 hover:bg-gray-200 transition-colors text-sm text-gray-700"
                            >
                              <FileText className="w-4 h-4 text-indigo-500" />
                              Abrir documento
                            </a>
                          )}
                          {/* Texto */}
                          {msg.mensagem && (
                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                              {msg.mensagem}
                            </p>
                          )}
                          {!msg.mensagem && !msg.url_midia && (
                            <p className="text-sm text-gray-400 italic">
                              {getTypeLabel(msg.tipo_mensagem, null)}
                            </p>
                          )}
                          {/* Horário */}
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-green-700 text-right' : 'text-gray-400'}`}>
                            {formatFullTime(msg.timestamp_whatsapp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
