"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, RefreshCcw, MessageSquare, FileText, Mic, Image, Video, Phone, Search, ChevronLeft, Smartphone, Tag, X, Paperclip, Send } from "lucide-react"

interface Instancia {
  id: string
  nome_instancia: string
  status: string
  token: string | null
}

interface Contato {
  telefone_contato: string
  nome_contato: string | null
  nome_instancia: string
  ultima_mensagem: string | null
  ultimo_tipo: string
  ultimo_timestamp: string
  imagem_preview?: string | null
  nao_lidas?: number
  whatsapp_labels?: string[]
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

function getTypeLabel(tipo: string, mensagem: string | null) {
  if (mensagem && mensagem.trim() !== '') return mensagem;
  const t = tipo?.toLowerCase() || '';
  if (t.includes('audio')) return '🎵 Áudio';
  if (t.includes('image')) return '📷 Imagem';
  if (t.includes('video')) return '🎥 Vídeo';
  if (t.includes('document')) return '📄 Documento';
  if (t.includes('sticker')) return '😄 Figurinha';
  if (t.includes('location')) return '📍 Localização';
  if (t.includes('contact')) return '👤 Contato';
  if (t.includes('reaction')) return '👍 Reação';
  return '(mensagem)';
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

// ==========================================
// PASSO 1 — Seleção de Instância
// ==========================================
function SelecionarInstancia({ onSelecionar }: { onSelecionar: (instancia: Instancia) => void }) {
  const [instancias, setInstancias] = useState<Instancia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wacloud/instances')
      .then(r => r.json())
      .then(d => setInstancias(d.instances || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-240px)] min-h-[400px]">
      <div className="text-center mb-8">
        <Smartphone className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
        <h3 className="text-xl font-black text-gray-900">Selecione um Cliente</h3>
        <p className="text-gray-500 text-sm mt-1">Escolha qual instância você quer visualizar as conversas</p>
      </div>

      {loading ? (
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      ) : instancias.length === 0 ? (
        <div className="text-gray-400 text-center">
          <p>Nenhuma instância cadastrada.</p>
          <p className="text-sm mt-1">Crie um cliente na aba "Gerenciar Clientes".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-2xl">
          {instancias.map(inst => (
            <button
              key={inst.id}
              onClick={() => onSelecionar(inst)}
              className="bg-white border-2 border-gray-200 hover:border-indigo-500 hover:shadow-md rounded-2xl p-5 text-left transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm mb-3 ${getAvatarColor(inst.nome_instancia)}`}>
                {inst.nome_instancia.slice(0, 2).toUpperCase()}
              </div>
              <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{inst.nome_instancia}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                inst.status === 'conectado' || inst.status === 'criada'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {inst.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ==========================================
// PASSO 2 — Chat da Instância Selecionada
// ==========================================
function ChatInstancia({ instancia, onVoltar }: { instancia: Instancia; onVoltar: () => void }) {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [contatosFiltrados, setContatosFiltrados] = useState<Contato[]>([])
  const [selectedContato, setSelectedContato] = useState<Contato | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [busca, setBusca] = useState("")
  const [uazapiLabels, setUazapiLabels] = useState<any[]>([])
  const [showLabelsModal, setShowLabelsModal] = useState(false)
  const [editingLabels, setEditingLabels] = useState<string[]>([])
  const [savingLabels, setSavingLabels] = useState(false)
  
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const chatRef = useRef<HTMLDivElement>(null)

  const [syncProgress, setSyncProgress] = useState<{ imported: number; total: number; label: string } | null>(null)

  const fetchContatosDB = async () => {
    try {
      const res = await fetch(
        `/api/wacloud/conversas?instancia=${encodeURIComponent(instancia.nome_instancia)}&_t=${Date.now()}`, 
        { cache: 'no-store' }
      )
      const data = await res.json()
      const lista: Contato[] = data.contatos || []
      setContatos(lista)
      setContatosFiltrados(lista)
      if (data.labels) {
        setUazapiLabels(data.labels)
      }
      return lista
    } catch (err) {
      console.error('Erro ao buscar contatos', err)
      return []
    }
  }

  const syncContatos = async (isFull: boolean) => {
    setSyncProgress({ imported: 0, total: 0, label: isFull ? 'Sincronizando todo o histórico...' : 'Atualizando conversas...' })
    try {
      let offset: number | null = 0;
      let imported = 0;
      let total = 0;
      
      while (offset !== null) {
        const res = await fetch(`/api/wacloud/instances/${instancia.id}/sync-chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao sincronizar")
        
        imported += data.processed || 0
        total = data.total || total
        setSyncProgress({ imported, total, label: `Sincronizando ${imported} de ${total}...` })
        
        if (!isFull) break; // Quick sync (apenas offset 0)
        offset = data.next_offset
      }
    } catch (err) {
      console.error("Sync error:", err)
    } finally {
      setSyncProgress(null)
      await fetchContatosDB()
    }
  }

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true)
      const lista = await fetchContatosDB()
      setLoading(false)
      
      // Auto-sync
      if (lista.length === 0) {
        await syncContatos(true)
      } else {
        // roda em background pra não travar a UI
        syncContatos(false)
      }
    }
    loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSendMessage = async () => {
    if (!msgText.trim() || !selectedContato || sendingMsg) return;
    setSendingMsg(true);
    try {
      const chatid = selectedContato.telefone_contato.includes('@') ? selectedContato.telefone_contato : `${selectedContato.telefone_contato}@s.whatsapp.net`;
      const number = chatid.split('@')[0];
      
      const res = await fetch(`/api/wacloud/instances/${instancia.id}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text: msgText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar mensagem');
      
      // Optimistic add
      const novaMsg: Mensagem = {
        id: `temp-${Date.now()}`,
        nome_instancia: instancia.nome_instancia,
        telefone_contato: selectedContato.telefone_contato,
        nome_contato: 'Eu',
        mensagem: msgText.trim(),
        enviado_por_mim: true,
        tipo_mensagem: 'ExtendedTextMessage',
        url_midia: null,
        mimetype: null,
        timestamp_whatsapp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setMensagens([...mensagens, novaMsg]);
      setMsgText('');
    } catch (err: any) {
      alert("Erro ao enviar: " + err.message);
    } finally {
      setSendingMsg(false);
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContato) return;
    
    // We import supabase-js dynamically or use config
    setSendingMsg(true);
    setUploadProgress(10);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { WACLOUD_CONFIG } = await import('@/lib/wacloud/config');
      const supabase = createClient(WACLOUD_CONFIG.supabaseUrl, WACLOUD_CONFIG.supabaseAnonKey);
      
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      setUploadProgress(40);
      const { error: uploadError } = await supabase.storage
        .from('wacloud_midias')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
        
      if (uploadError) throw new Error("Erro no upload do Supabase: " + uploadError.message);
      
      setUploadProgress(70);
      const { data: { publicUrl } } = supabase.storage
        .from('wacloud_midias')
        .getPublicUrl(fileName);
        
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const chatid = selectedContato.telefone_contato.includes('@') ? selectedContato.telefone_contato : `${selectedContato.telefone_contato}@s.whatsapp.net`;
      const number = chatid.split('@')[0];

      setUploadProgress(90);
      const res = await fetch(`/api/wacloud/instances/${instancia.id}/send-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, type, file: publicUrl, text: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar mídia');
      
      // Optimistic add
      const novaMsg: Mensagem = {
        id: `temp-${Date.now()}`,
        nome_instancia: instancia.nome_instancia,
        telefone_contato: selectedContato.telefone_contato,
        nome_contato: 'Eu',
        mensagem: null,
        enviado_por_mim: true,
        tipo_mensagem: type,
        url_midia: publicUrl,
        mimetype: file.type,
        timestamp_whatsapp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setMensagens([...mensagens, novaMsg]);
      
    } catch (err: any) {
      alert("Erro ao enviar arquivo: " + err.message);
    } finally {
      setSendingMsg(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const saveLabels = async () => {
    if (!selectedContato) return;
    setSavingLabels(true);
    try {
      const chatid = selectedContato.telefone_contato.includes('@') ? selectedContato.telefone_contato : `${selectedContato.telefone_contato}@s.whatsapp.net`;
      const number = chatid.split('@')[0];
      const res = await fetch(`/api/wacloud/instances/${instancia.id}/chat-labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, labelids: editingLabels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar etiquetas');
      
      // Update local state
      const updatedContato = { ...selectedContato, whatsapp_labels: editingLabels };
      setSelectedContato(updatedContato);
      setContatos(contatos.map(c => c.telefone_contato === selectedContato.telefone_contato ? updatedContato : c));
      setContatosFiltrados(contatosFiltrados.map(c => c.telefone_contato === selectedContato.telefone_contato ? updatedContato : c));
      setShowLabelsModal(false);
    } catch (err: any) {
      alert("Erro ao salvar etiquetas: " + err.message);
    } finally {
      setSavingLabels(false);
    }
  }

  const [syncingMsgs, setSyncingMsgs] = useState(false)

  const fetchMensagens = async (contato: Contato) => {
    setLoadingMsgs(true)
    try {
      // Tenta buscar no banco primeiro
      const res = await fetch(
        `/api/wacloud/conversas/${encodeURIComponent(contato.telefone_contato)}?instancia=${encodeURIComponent(instancia.nome_instancia)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      let msgs = data.mensagens || []
      
      setMensagens(msgs)

      // Se não tiver mensagens no banco, puxa automaticamente da Uazapi
      if (msgs.length === 0) {
        await syncMensagens(contato, false)
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens', err)
      setSyncingMsgs(false)
    } finally {
      setLoadingMsgs(false)
    }
  }

  const syncMensagens = async (contato: Contato, isFull: boolean = false) => {
    setSyncingMsgs(true);
    try {
      let offset: number | null = 0;
      let imported = 0;
      const chatid = contato.telefone_contato.includes('@') ? contato.telefone_contato : `${contato.telefone_contato}@s.whatsapp.net`;
      
      while (offset !== null) {
        const res = await fetch(`/api/wacloud/instances/${instancia.id}/sync-messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatid, offset }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao sincronizar mensagens");
        
        imported += data.processed || 0;
        
        if (!isFull) break;
        offset = data.next_offset;
      }
      if (isFull) alert(`Histórico sincronizado: ${imported} mensagens importadas.`);
      
      // Update view
      const resNovo = await fetch(
        `/api/wacloud/conversas/${encodeURIComponent(contato.telefone_contato)}?instancia=${encodeURIComponent(instancia.nome_instancia)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      const dataNovo = await resNovo.json()
      if (selectedContatoRef.current?.telefone_contato === contato.telefone_contato) {
        setMensagens(dataNovo.mensagens || []);
      }
    } catch (err: any) {
      if (isFull) alert("Erro ao sincronizar: " + err.message);
      else console.error("Auto sync msgs error:", err.message);
    } finally {
      setSyncingMsgs(false);
    }
  }


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

  // Refs para evitar stale closure dentro do setInterval
  const selectedContatoRef = useRef<Contato | null>(null)
  const countdownRef = useRef(30)
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    selectedContatoRef.current = selectedContato
  }, [selectedContato])

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)

      if (countdownRef.current <= 0) {
        countdownRef.current = 30
        setCountdown(30)
        syncContatos(false)
        if (selectedContatoRef.current) {
          syncMensagens(selectedContatoRef.current, false)
        }
      }
    }, 1000)

    return () => clearInterval(timer)
  }, []) // Roda só uma vez — refs garantem acesso ao estado mais atual

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
      {/* Barra superior com instância selecionada */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Trocar cliente
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black ${getAvatarColor(instancia.nome_instancia)}`}>
          {instancia.nome_instancia.slice(0, 2).toUpperCase()}
        </div>
        <span className="font-bold text-gray-900">{instancia.nome_instancia}</span>
      </div>

      {/* Chat Container */}
      <div className="flex flex-1 overflow-hidden rounded-xl border border-gray-200">
        {/* Painel esquerdo */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
          <div className="px-3 py-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
            
            {/* Título e Botão de Atualizar */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contatos</span>
              <button
                onClick={() => {
                  syncContatos(false)
                  if (selectedContatoRef.current) syncMensagens(selectedContatoRef.current, false)
                  setCountdown(30)
                }}
                disabled={!!syncProgress}
                className="flex items-center gap-1 p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors disabled:opacity-50"
                title="Atualizar agora"
              >
                <span className="text-[10px] font-mono text-gray-400">{countdown}s</span>
                <RefreshCcw className={`w-3.5 h-3.5 ${syncProgress ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Progress Bar (se estiver sincronizando) */}
            {syncProgress && (
              <div className="w-full bg-indigo-50 border border-indigo-100 rounded-md p-2">
                <div className="flex justify-between text-[9px] font-bold text-indigo-700 mb-1.5">
                  <span className="truncate pr-2">{syncProgress.label}</span>
                  {syncProgress.total > 0 && <span>{Math.round((syncProgress.imported / syncProgress.total) * 100)}%</span>}
                </div>
                <div className="w-full bg-indigo-200 rounded-full h-1">
                  <div 
                    className="bg-indigo-600 h-1 rounded-full transition-all duration-300" 
                    style={{ width: syncProgress.total > 0 ? `${Math.min((syncProgress.imported / syncProgress.total) * 100, 100)}%` : '0%' }}
                  />
                </div>
              </div>
            )}

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-24"><Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /></div>
            ) : contatosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-xs">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                Nenhuma conversa
              </div>
            ) : (
              contatosFiltrados.map((contato) => {
                const isSelected = selectedContato?.telefone_contato === contato.telefone_contato
                return (
                  <button
                    key={contato.telefone_contato}
                    onClick={() => { setSelectedContato(contato); fetchMensagens(contato) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${
                      isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden ${getAvatarColor(contato.telefone_contato)}`}>
                      {contato.imagem_preview ? (
                        <img src={contato.imagem_preview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(contato.nome_contato, contato.telefone_contato)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className="font-semibold text-gray-900 text-xs truncate pr-1">
                          {contato.nome_contato || contato.telefone_contato}
                        </p>
                        <span className={`text-[10px] flex-shrink-0 ${contato.nao_lidas ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                          {formatTime(contato.ultimo_timestamp)}
                        </span>
                      </div>
                      
                      {/* WhatsApp Labels */}
                      {contato.whatsapp_labels && contato.whatsapp_labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {contato.whatsapp_labels.map(labelId => {
                            const lbl = uazapiLabels.find(l => 
                              String(l.id) === String(labelId) || 
                              String(l.labelid) === String(labelId) ||
                              String(labelId).endsWith(`:${l.labelid}`)
                            );
                            if (!lbl) return null;
                            return (
                              <span
                                key={labelId}
                                className="text-[9px] px-1.5 py-0.5 rounded text-white font-medium"
                                style={{ backgroundColor: lbl.colorHex || '#ccc' }}
                                title={lbl.name}
                              >
                                {lbl.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] text-gray-500 truncate pr-2">
                          {getTypeLabel(contato.ultimo_tipo, contato.ultima_mensagem)}
                        </p>
                        {!!contato.nao_lidas && contato.nao_lidas > 0 && (
                          <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                            {contato.nao_lidas}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Painel direito — mensagens */}
        <div className="flex-1 flex flex-col bg-[#efeae2]">
          {!selectedContato ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare className="w-12 h-12 mb-3 text-gray-300" />
              <p className="font-semibold text-gray-500 text-sm">Selecione uma conversa</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-[#f0f2f5] px-4 py-2.5 border-b border-gray-200 flex items-center gap-3 shadow-sm">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(selectedContato.telefone_contato)}`}>
                  {getInitials(selectedContato.nome_contato, selectedContato.telefone_contato)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">{selectedContato.nome_contato || selectedContato.telefone_contato}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {selectedContato.telefone_contato}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const currentIds = (selectedContato.whatsapp_labels || []).map(l => {
                        const strL = String(l);
                        return strL.includes(':') ? strL.split(':')[1] : strL;
                      });
                      setEditingLabels(currentIds);
                      setShowLabelsModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    title="Gerenciar etiquetas deste contato"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Etiquetas
                  </button>

                  <button
                    onClick={() => syncMensagens(selectedContato, true)}
                    disabled={syncingMsgs}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors disabled:opacity-50"
                    title="Sincronizar todo o histórico do WhatsApp para este contato"
                  >
                    {syncingMsgs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                    {syncingMsgs ? "Baixando..." : "Sincronizar Histórico"}
                  </button>
                </div>
              </div>

              {/* Mensagens */}
              <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {loadingMsgs ? (
                  <div className="flex justify-center items-center h-32"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
                ) : mensagens.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">Nenhuma mensagem encontrada</div>
                ) : (
                  mensagens.map((msg, idx) => {
                    const isMe = msg.enviado_por_mim
                    const showDate = idx === 0 || (
                      new Date(msg.timestamp_whatsapp).toDateString() !==
                      new Date(mensagens[idx - 1].timestamp_whatsapp).toDateString()
                    )
                    const tLower = msg.tipo_mensagem?.toLowerCase() || '';
                    const isSticker = tLower.includes('sticker')
                    const isMedia = (tLower.includes('image') || tLower.includes('sticker')) && msg.url_midia

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
                          {/* Figurinha: sem balão */}
                          {isSticker && msg.url_midia ? (
                            <div className="max-w-[150px]">
                              <img
                                src={msg.url_midia}
                                alt="Figurinha"
                                className="w-28 h-28 object-contain rounded-xl cursor-pointer"
                                onClick={() => window.open(msg.url_midia!, '_blank')}
                              />
                              <p className={`text-[10px] mt-0.5 ${isMe ? 'text-right' : 'text-left'} text-gray-400`}>
                                {formatFullTime(msg.timestamp_whatsapp)}
                              </p>
                            </div>
                          ) : (
                            <div className={`max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
                              isMe ? 'bg-[#d9fdd3] rounded-br-sm' : 'bg-white rounded-bl-sm'
                            }`}>
                              {msg.tipo_mensagem?.toLowerCase().includes('image') && msg.url_midia && (
                                <img
                                  src={msg.url_midia}
                                  alt="Imagem"
                                  className="rounded-xl mb-1 max-w-full max-h-48 object-cover cursor-pointer"
                                  onClick={() => window.open(msg.url_midia!, '_blank')}
                                />
                              )}
                              {msg.tipo_mensagem?.toLowerCase().includes('video') && msg.url_midia && (
                                <video src={msg.url_midia} controls className="rounded-xl mb-1 max-w-full max-h-48" />
                              )}
                              {msg.tipo_mensagem?.toLowerCase().includes('audio') && msg.url_midia && (
                                <audio src={msg.url_midia} controls className="w-full min-w-[260px] mb-1" />
                              )}
                              {msg.tipo_mensagem?.toLowerCase().includes('document') && msg.url_midia && (
                                <a
                                  href={msg.url_midia}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 mb-1 hover:bg-gray-200 text-sm text-gray-700"
                                >
                                  <FileText className="w-4 h-4 text-indigo-500" />
                                  Abrir documento
                                </a>
                              )}
                              {msg.mensagem && (
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{msg.mensagem}</p>
                              )}
                              {!msg.mensagem && !msg.url_midia && (
                                <p className="text-sm text-gray-400 italic">{getTypeLabel(msg.tipo_mensagem, null)}</p>
                              )}
                              <p className={`text-[10px] mt-1 ${isMe ? 'text-green-700 text-right' : 'text-gray-400'}`}>
                                {formatFullTime(msg.timestamp_whatsapp)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              
              {/* Message Input Area */}
              <div className="bg-[#f0f2f5] px-4 py-3 flex items-end gap-2 relative">
                {uploadProgress > 0 && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-gray-200">
                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendingMsg}
                  className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileChange}
                />

                <div className="flex-1 bg-white rounded-xl overflow-hidden border border-gray-300 shadow-sm">
                  <textarea
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    rows={1}
                    className="w-full px-4 py-3 text-sm text-gray-800 outline-none resize-none max-h-32"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    style={{ minHeight: '44px' }}
                  />
                </div>

                <button 
                  onClick={handleSendMessage}
                  disabled={!msgText.trim() || sendingMsg}
                  className="p-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-full transition-colors disabled:opacity-50 disabled:bg-indigo-400 flex-shrink-0"
                >
                  {sendingMsg && uploadProgress === 0 ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 ml-0.5" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL DE ETIQUETAS */}
      {showLabelsModal && selectedContato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" />
                Etiquetas
              </h3>
              <button onClick={() => setShowLabelsModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto flex flex-col gap-3">
              {uazapiLabels.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhuma etiqueta encontrada na instância.</p>
              ) : (
                uazapiLabels.map(lbl => {
                  const idStr = String(lbl.labelid || lbl.id);
                  const isChecked = editingLabels.includes(idStr);
                  
                  return (
                    <label key={idStr} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingLabels([...editingLabels, idStr]);
                            } else {
                              setEditingLabels(editingLabels.filter(l => l !== idStr));
                            }
                          }}
                        />
                        <div className={`w-5 h-5 rounded border ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'} flex items-center justify-center transition-colors`}>
                          {isChecked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: lbl.colorHex || '#ccc' }}></span>
                        <span className="text-sm font-medium text-gray-700">{lbl.name}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowLabelsModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveLabels}
                disabled={savingLabels}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {savingLabels ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar Etiquetas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export function ConversasTab() {
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<Instancia | null>(null)

  if (!instanciaSelecionada) {
    return <SelecionarInstancia onSelecionar={setInstanciaSelecionada} />
  }

  return (
    <ChatInstancia
      instancia={instanciaSelecionada}
      onVoltar={() => setInstanciaSelecionada(null)}
    />
  )
}
