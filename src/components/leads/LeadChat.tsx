"use client"

import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Paperclip, Send, Loader2, FileText, Image as ImageIcon, Music, Mic } from "lucide-react"

export type ChatMessage = {
  id: string
  type: "human" | "ai"
  data: {
    content: string
  }
  created_at: string
}

type LeadChatProps = {
  messages: ChatMessage[]
  telefone?: string
  onMessageSent?: () => void
}

export function LeadChat({ messages, telefone, onMessageSent }: LeadChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [msgText, setMsgText] = useState("")
  const [sending, setSending] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Gravador de áudio
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<any>(null)
  const isCancelledRef = useRef<boolean>(false)

  // Scroll para o fundo quando novas mensagens chegam
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const formatTime = (dateStr: string) => {
    try {
      if (!dateStr) return ""
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return ""
      return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ""
    }
  }

  const cleanMessageContent = (content: string) => {
    if (!content) return "";
    return content
      .replace(/Mensagem do cliente:\s*/gi, '')
      .replace(/Se caso tiver, o cliente pode ter respondido uma mensagem e a mensagem era essa:\s*/gi, '')
      .trim();
  };

  const formatMessageContent = (content: string) => {
    const clean = cleanMessageContent(content);
    if (!clean) return null;
      
    // Expressão regular para encontrar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return clean.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        // Se for imagem
        if (part.match(/\.(jpeg|jpg|gif|png|webp)/i) || part.includes('wacloud_midias') && part.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer">
              <img src={part} alt="Anexo" className="max-w-[240px] max-h-[240px] rounded-md mt-2 mb-2 object-cover border shadow-sm cursor-pointer" />
            </a>
          );
        }
        // Se for áudio
        if (part.match(/\.(mp3|wav|ogg|m4a|aac|opus|webm)/i) || (part.includes('wacloud_midias') && (part.includes('audio-') || part.match(/\.(mp3|wav|ogg|m4a|aac|opus|webm)/i)))) {
          return (
            <div key={i} className="my-2">
              <audio src={part} controls className="max-w-[240px] h-10" />
            </div>
          );
        }
        // Se for documento ou link genérico
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-800 transition-colors inline-flex items-center gap-1 font-semibold">
            <FileText className="w-3.5 h-3.5 inline" /> Abrir anexo
          </a>
        );
      }
      return <span key={i} className="whitespace-pre-wrap leading-relaxed">{part}</span>;
    });
  };

  const handleSendText = async () => {
    if (!msgText.trim() || !telefone || sending) return;
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone,
          text: msgText.trim(),
          type: 'text'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar mensagem');
      }

      setMsgText("");
      if (onMessageSent) onMessageSent();
    } catch (err: any) {
      alert("Erro ao responder cliente: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !telefone || sending) return;

    setSending(true);
    setUploadProgress(15);

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { WACLOUD_CONFIG } = await import('@/lib/wacloud/config');
      const supabase = createClient(WACLOUD_CONFIG.supabaseUrl, WACLOUD_CONFIG.supabaseAnonKey);

      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      setUploadProgress(45);
      const { error: uploadError } = await supabase.storage
        .from('wacloud_midias')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error("Erro no upload: " + uploadError.message);

      setUploadProgress(75);
      const { data: { publicUrl } } = supabase.storage
        .from('wacloud_midias')
        .getPublicUrl(fileName);

      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';

      setUploadProgress(90);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone,
          text: file.name,
          type: mediaType,
          mediaUrl: publicUrl,
          fileName: file.name
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar arquivo');
      }

      if (onMessageSent) onMessageSent();
    } catch (err: any) {
      alert("Erro ao enviar arquivo: " + err.message);
    } finally {
      setSending(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startAudioRecording = async () => {
    if (isRecording || sending || !telefone) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Seu navegador não tem suporte para gravação de áudio ou a permissão foi negada.");
        return;
      }
      isCancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (isCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }
        const chunks = audioChunksRef.current;
        if (!chunks || chunks.length === 0) return;

        const actualType = mediaRecorder.mimeType || 'audio/ogg';
        const ext = actualType.includes('mp4') ? 'm4a' : actualType.includes('webm') ? 'webm' : 'ogg';
        const audioBlob = new Blob(chunks, { type: actualType });
        if (audioBlob.size < 500) return;

        await sendRecordedAudio(audioBlob, ext, actualType);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Erro ao iniciar gravação:", err);
      alert("Não foi possível acessar o microfone: " + (err.message || 'Permissão negada'));
      setIsRecording(false);
    }
  };

  const stopAudioRecording = () => {
    isCancelledRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  const cancelAudioRecording = () => {
    isCancelledRef.current = true;
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const sendRecordedAudio = async (blob: Blob, ext: string, mimeType: string) => {
    if (!telefone) return;
    setSending(true);
    setUploadProgress(15);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { WACLOUD_CONFIG } = await import('@/lib/wacloud/config');
      const supabase = createClient(WACLOUD_CONFIG.supabaseUrl, WACLOUD_CONFIG.supabaseAnonKey);

      const fileName = `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      setUploadProgress(45);
      const { error: uploadError } = await supabase.storage
        .from('wacloud_midias')
        .upload(fileName, blob, { contentType: mimeType, cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error("Erro no upload do áudio: " + uploadError.message);

      setUploadProgress(75);
      const { data: { publicUrl } } = supabase.storage
        .from('wacloud_midias')
        .getPublicUrl(fileName);

      setUploadProgress(90);
      // tipo 'ptt' para enviar como áudio nativo de voz do WhatsApp
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone,
          text: '',
          type: 'ptt',
          mediaUrl: publicUrl,
          fileName: 'Mensagem de voz'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar mensagem de voz');
      }

      if (onMessageSent) onMessageSent();
    } catch (err: any) {
      alert("Erro ao enviar áudio: " + err.message);
    } finally {
      setSending(false);
      setUploadProgress(0);
      setRecordingDuration(0);
    }
  };

  const visibleMessages = messages.filter(msg => {
    const content = cleanMessageContent(msg.data.content);
    if (!content) return false;
    if (content.includes("Execute agora o follow-up número")) return false;
    if (content.includes("Execute o follow-up número")) return false;
    if (content.includes("Analise primeiro todo o histórico da conversa e continue naturalmente")) return false;
    return true;
  });

  const finalMessages = visibleMessages.filter((msg, index, arr) => {
    if (index > 0) {
      const prev = arr[index - 1];
      if (cleanMessageContent(prev.data.content) === cleanMessageContent(msg.data.content) && prev.type === msg.type) {
        return false;
      }
    }
    return true;
  });

  const getDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    
    if (diffDays < 7 && diffDays > 1) {
      const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
      return weekdays[targetDate.getDay()];
    }

    return targetDate.toLocaleDateString('pt-BR');
  };

  let lastDateLabel = "";

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 bg-[#E5DDD5] relative" ref={scrollRef}>
      <ScrollArea className="flex-1 min-h-0 p-4 h-full">
        <div className="space-y-4 pb-4">
          {finalMessages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px] text-gray-500 text-sm italic">
              Nenhuma mensagem encontrada nesta conversa.
            </div>
          ) : (
            finalMessages.map((msg) => {
              const contentRaw = cleanMessageContent(msg.data.content);
              const isAi = msg.type === "ai";
              
              let isHumanSeller = false;
              let displayContent = contentRaw;

              if (isAi && contentRaw.startsWith("[ATENDIMENTO HUMANO]")) {
                isHumanSeller = true;
                displayContent = contentRaw.replace("[ATENDIMENTO HUMANO]", "").trim();
              }

              const isClient = !isAi;
              const dateLabel = getDateLabel(msg.created_at);
              const showDateSeparator = dateLabel !== lastDateLabel;
              lastDateLabel = dateLabel;

              return (
                <div key={msg.id} className="flex flex-col gap-4">
                  {showDateSeparator && (
                    <div className="flex justify-center my-2">
                      <span className="bg-white/90 text-gray-500 text-[11px] font-bold px-3 py-1 rounded-lg shadow-sm uppercase tracking-wider">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex w-max max-w-[85%] flex-col gap-1 text-sm",
                      !isClient ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-col rounded-lg px-3 py-2 shadow-sm text-gray-900 border relative",
                        isAi && !isHumanSeller
                          ? "bg-[#D9FDD3] border-transparent rounded-tr-none"
                          : "",
                        isHumanSeller
                          ? "bg-[#E2F0CB] border-green-200 rounded-tr-none shadow-md"
                          : "",
                        isClient
                          ? "bg-white border-transparent rounded-tl-none"
                          : ""
                      )}
                    >
                      {/* Indicador de Remetente */}
                      {isHumanSeller && (
                        <div className="flex items-center gap-1 mb-1 border-b border-green-200/50 pb-1">
                          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">👤 Atendimento Humano</span>
                        </div>
                      )}
                      {isAi && !isHumanSeller && (
                        <div className="flex items-center gap-1 mb-1 border-b border-green-200/50 pb-1 opacity-70">
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">🤖 IA Automática</span>
                        </div>
                      )}
                      
                      <div className="break-words mt-0.5">
                        {formatMessageContent(displayContent)}
                      </div>
                      
                      <span className="text-[10px] text-gray-500 text-right mt-1 font-medium">
                        {formatTime(msg.created_at).split(' ')[1] || formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Barra de Envio e Atendimento Humano */}
      <div className="bg-[#F0F2F5] p-2.5 border-t border-gray-200 flex items-center gap-2 shrink-0 relative">
        {uploadProgress > 0 && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-200">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-white rounded-xl px-3.5 py-2 border border-red-200 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-600 font-mono tracking-wider">
                Gravando... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelAudioRecording}
                className="text-xs font-bold text-gray-500 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={stopAudioRecording}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar Áudio
              </button>
            </div>
          </div>
        ) : (
          <>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || !telefone}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-40"
              title="Anexar documento, imagem ou áudio"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder={telefone ? "Responder cliente (pausa a IA automaticamente)..." : "Sem telefone"}
              disabled={sending || !telefone}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              className="flex-1 bg-white border border-gray-300 text-gray-800 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            />

            {msgText.trim() ? (
              <button
                type="button"
                onClick={handleSendText}
                disabled={sending || !telefone}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-sm"
                title="Enviar mensagem e pausar IA"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={startAudioRecording}
                disabled={sending || !telefone}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-sm hover:scale-105 active:scale-95"
                title="Gravar áudio para o cliente"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

