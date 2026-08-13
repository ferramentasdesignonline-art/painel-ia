"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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
}

export function LeadChat({ messages }: LeadChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

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
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ""
    }
  }

  const formatMessageContent = (content: string) => {
    if (!content) return null;
    
    // Remove os prefixos indesejados
    let clean = content
      .replace(/Mensagem do cliente:\s*/gi, '')
      .replace(/Se caso tiver, o cliente pode ter respondido uma mensagem e a mensagem era essa:\s*/gi, '');
      
    // Expressão regular para encontrar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return clean.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        // Se for imagem (por extensão ou link conhecido do blob)
        if (part.match(/\.(jpeg|jpg|gif|png|webp)/i) || part.includes('blob.core.windows.net')) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer">
              <img src={part} alt="Anexo" className="max-w-[240px] max-h-[240px] rounded-md mt-2 mb-2 object-cover border shadow-sm cursor-pointer" />
            </a>
          );
        }
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-800 transition-colors">{part}</a>;
      }
      return <span key={i} className="whitespace-pre-wrap leading-relaxed">{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#E5DDD5] relative" ref={scrollRef}>
      <ScrollArea className="flex-1 p-4 h-full">
        <div className="space-y-4 pb-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px] text-gray-500 text-sm italic">
              Nenhuma mensagem encontrada nesta conversa.
            </div>
          ) : (
            messages.map((msg) => {
              const isAi = msg.type === "ai"
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex w-max max-w-[85%] flex-col gap-1 text-sm",
                    isAi ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div
                    className={cn(
                      "flex flex-col rounded-lg px-3 py-2 shadow-sm text-gray-900 border",
                      isAi
                        ? "bg-[#D9FDD3] border-transparent rounded-tr-none"
                        : "bg-white border-transparent rounded-tl-none"
                    )}
                  >
                    <div className="break-words">
                      {formatMessageContent(msg.data.content)}
                    </div>
                    <span className="text-[10px] text-gray-500 text-right mt-1 font-medium">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
      {/* Rodapé informativo silencioso */}
      <div className="bg-[#F0F2F5] p-2 border-t flex items-center justify-center shrink-0">
         <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
           Histórico da IA (Apenas Visualização)
         </span>
      </div>
    </div>
  )
}
