import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RefreshCw, Pencil, Check, X } from "lucide-react"
import { LeadChat, ChatMessage } from "./LeadChat"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export type LeadType = {
  id: string
  nome: string
  telefone: string
  veiculo: string // deprecated, use veiculoInteressado
  vendedor: string // deprecated
  status: string
  origem: string
  ultimaMensagem: string // deprecated
  // Campos reais da tabela
  createdAt?: string
  ultimaMensagemTs?: string
  quantidadeFollowup?: number
  leadFinalizado?: boolean
  vendedorLead?: string | null
  horarioLeadQualificado?: string | null
  veiculoInteressado?: string | null
  dataAgendamento?: string | null
  observacaoLeadQualificado?: string | null
  email?: string | null
  cpfCnpj?: string | null
  dataNascimento?: string | null
  veiculoTroca?: string | null
  endereco?: string | null
  possuiCnh?: boolean | null
  genero?: string | null
}

type LeadDrawerProps = {
  lead: LeadType | null
  isOpen: boolean
  onClose: () => void
}

export function LeadDrawer({ lead, isOpen, onClose }: LeadDrawerProps) {
  if (!lead) return null

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [novaNota, setNovaNota] = useState("")
  const [salvandoNota, setSalvandoNota] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editNome, setEditNome] = useState("")
  const [editVeiculo, setEditVeiculo] = useState("")
  const [editDataAgendamento, setEditDataAgendamento] = useState("")
  const [editObservacao, setEditObservacao] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editCpfCnpj, setEditCpfCnpj] = useState("")
  const [editDataNascimento, setEditDataNascimento] = useState("")
  const [editVeiculoTroca, setEditVeiculoTroca] = useState("")
  const [editEndereco, setEditEndereco] = useState("")
  const [editPossuiCnh, setEditPossuiCnh] = useState<boolean | null>(null)
  const [editGenero, setEditGenero] = useState("")
  const [etapas, setEtapas] = useState<any[]>([])
  const [editEtapaId, setEditEtapaId] = useState("")
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const formatarTelefone = (tel?: string | null) => {
    if (!tel) return '-';
    let limpo = tel.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    if (!limpo) return tel.split('@')[0];
    if (limpo.startsWith('55')) limpo = limpo.slice(2);
    if (limpo.length === 11) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    if (limpo.length === 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return limpo;
  };

  const initEdit = () => {
    setEditNome(lead.nome)
    setEditVeiculo(lead.veiculoInteressado || lead.veiculo || "")
    setEditDataAgendamento(lead.dataAgendamento ? new Date(lead.dataAgendamento).toISOString().slice(0, 16) : "")
    setEditObservacao(lead.observacaoLeadQualificado || "")
    setEditEmail(lead.email || "")
    setEditCpfCnpj(lead.cpfCnpj || "")
    setEditDataNascimento(lead.dataNascimento || "")
    setEditVeiculoTroca(lead.veiculoTroca || "")
    setEditEndereco(lead.endereco || "")
    setEditPossuiCnh(lead.possuiCnh !== undefined ? lead.possuiCnh : null)
    setEditGenero(lead.genero || "")
    
    // Tenta encontrar a etapa correspondente ao status atual
    const etapaAtual = etapas.find(e => e.nome.toLowerCase() === lead.status.toLowerCase() || (lead.status === '✓ Qualificado' && e.nome.toLowerCase() === 'qualificado'))
    setEditEtapaId(etapaAtual ? etapaAtual.id : "")
    
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
  }

  const saveEdit = async () => {
    setSalvandoEdicao(true)
    const leadIdStr = lead.id.toString();
    const realId = leadIdStr.replace(/^(ia|manual)-/, '');

    try {
      const updateRes = await fetch('/api/leads/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: realId,
          origem: lead.origem,
          novasInformacoes: {
            nome: editNome,
            veiculo_interessado: editVeiculo,
            data_agendamento: editDataAgendamento ? new Date(editDataAgendamento).toISOString() : null,
            observacao_lead_qualificado: editObservacao || null,
            email: editEmail || null,
            cpf_cnpj: editCpfCnpj || null,
            data_nascimento: editDataNascimento || null,
            veiculo_troca: editVeiculoTroca || null,
            endereço: editEndereco || null,
            possui_cnh: editPossuiCnh,
            genero: editGenero || null,
          }
        })
      });

      let moveOk = true;
      if (editEtapaId) {
        const moveRes = await fetch('/api/funil/leads/mover', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: realId,
            etapa_id: editEtapaId,
            origem: lead.origem
          })
        });
        moveOk = moveRes.ok;
      }

      if (updateRes.ok && moveOk) {
        setIsEditing(false);
        lead.nome = editNome;
        lead.veiculoInteressado = editVeiculo;
        lead.veiculo = editVeiculo;
        lead.dataAgendamento = editDataAgendamento ? new Date(editDataAgendamento).toISOString() : null;
        lead.observacaoLeadQualificado = editObservacao || null;
        lead.email = editEmail || null;
        lead.cpfCnpj = editCpfCnpj || null;
        lead.dataNascimento = editDataNascimento || null;
        lead.veiculoTroca = editVeiculoTroca || null;
        lead.endereco = editEndereco || null;
        lead.possuiCnh = editPossuiCnh;
        lead.genero = editGenero || null;
        if (editEtapaId) {
          const etapaSelecionada = etapas.find(e => e.id === editEtapaId);
          if (etapaSelecionada) {
            lead.status = etapaSelecionada.nome;
            if (etapaSelecionada.nome.toLowerCase() === 'qualificado') {
              lead.leadFinalizado = true;
            } else {
              lead.leadFinalizado = false;
            }
          }
        }
        fetchHistory();
      } else {
        console.error("Falha ao salvar a edição");
      }
    } catch(err) {
      console.error(err)
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const handleSalvarNota = async () => {
    if (!novaNota.trim()) return;
    setSalvandoNota(true);
    
    const leadIdStr = lead.id.toString();
    const realId = leadIdStr.replace(/^(ia|manual)-/, '');

    try {
      const res = await fetch('/api/leads/historico/adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: realId, conteudo: novaNota.trim(), origem: lead.origem })
      });
      if (res.ok) {
        setNovaNota("");
        fetchHistory(); // Recarrega a timeline!
      } else {
        console.error('Falha ao adicionar nota');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSalvandoNota(false);
    }
  }

  const fetchChat = async () => {
    if (!lead.telefone) return
    setLoadingChat(true)
    try {
      const res = await fetch(`/api/chat?telefone=${encodeURIComponent(lead.telefone)}`)
      const json = await res.json()
      if (json.data) {
        const formatted = json.data.map((msg: any) => ({
          id: msg.id,
          type: msg.type, 
          data: { content: msg.message },
          created_at: msg.created_at
        }))
        setMessages(formatted)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingChat(false)
    }
  }

  const fetchHistory = async () => {
    const leadIdStr = lead.id.toString();
    const realId = leadIdStr.replace(/^(ia|manual)-/, '');
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/leads/historico?leadId=${realId}`)
      const json = await res.json()
      if (json.historico) {
        setHistory(json.historico)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (isOpen && lead) {
      fetchChat()
      fetchHistory()
      fetch('/api/funil/etapas')
        .then(r => r.json())
        .then(d => { if (d.etapas) setEtapas(d.etapas) })
        .catch(console.error)
    }
  }, [isOpen, lead])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] md:max-w-4xl h-[85vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden border-gray-200">
        <DialogHeader className="px-5 py-3 border-b border-gray-100 bg-white relative">
          
          <div className="absolute right-10 top-3 flex items-center gap-2">
            {!isEditing && <Badge variant="outline" className="shadow-sm text-[10px] py-0.5">{lead.status}</Badge>}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={salvandoEdicao} className="h-7 text-xs px-2"><X className="w-3 h-3 mr-1" /> Cancelar</Button>
                <Button size="sm" onClick={saveEdit} disabled={salvandoEdicao} className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs px-2">
                  <Check className="w-3 h-3 mr-1" /> {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-indigo-600" onClick={initEdit}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
          <DialogTitle className="text-base font-bold flex items-center pr-48 leading-tight">
            {isEditing ? (
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-7 font-bold text-base max-w-[250px]" />
            ) : (
              <span>{lead.nome}</span>
            )}
          </DialogTitle>
          <div className="text-xs text-gray-400 mt-1 flex gap-3 items-center">
            <span>{formatarTelefone(lead.telefone)}</span>
          </div>

        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b border-gray-200 px-4 h-9 bg-gray-50/50">
            <TabsTrigger value="info" className="relative h-8 rounded-none border-b-2 border-b-transparent px-3 pb-2 pt-1 text-xs font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-blue-600 data-[state=active]:text-foreground data-[state=active]:shadow-none">Detalhes & Eventos</TabsTrigger>
            <TabsTrigger value="chat" className="relative h-8 rounded-none border-b-2 border-b-transparent px-3 pb-2 pt-1 text-xs font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-blue-600 data-[state=active]:text-foreground data-[state=active]:shadow-none">Histórico (IA)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="flex-1 m-0 overflow-hidden flex flex-col border-t">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-2 bg-gray-50 flex justify-end border-b border-gray-200">
                <Button variant="ghost" size="sm" onClick={fetchChat} disabled={loadingChat} className="text-gray-500 h-8 text-xs">
                  <RefreshCw className={`h-3 w-3 mr-2 ${loadingChat ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LeadChat messages={messages} />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="info" className="flex-1 p-6 space-y-5 overflow-y-auto">
             {/* Status do Lead */}
             <div className="space-y-3">
               <h3 className="font-semibold text-base text-gray-900 border-b pb-2">Status do Lead</h3>
               <div className="grid grid-cols-2 gap-3 text-sm">
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Status</p>
                   {isEditing ? (
                     <select
                       value={editEtapaId}
                       onChange={e => setEditEtapaId(e.target.value)}
                       className="w-full h-8 px-2 bg-white border border-gray-200 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
                     >
                       <option value="">Selecione...</option>
                       {etapas.map(e => (
                         <option key={e.id} value={e.id}>{e.nome}</option>
                       ))}
                     </select>
                   ) : (
                     <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                       lead.leadFinalizado 
                         ? 'bg-green-100 text-green-800' 
                         : 'bg-indigo-100 text-indigo-800'
                     }`}>
                       {lead.status || (lead.leadFinalizado ? '✓ Qualificado' : '⏳ Em andamento')}
                     </span>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Follow-ups</p>
                   <p className="font-bold text-lg text-gray-900">{lead.quantidadeFollowup ?? '-'}</p>
                 </div>
               </div>
             </div>

             {/* Veículo */}
             <div className="space-y-2">
               <h3 className="font-semibold text-base text-gray-900 border-b pb-2">Veículo de Interesse</h3>
               <div className="bg-blue-50 rounded-lg p-3 text-sm">
                 {isEditing ? (
                   <Input 
                     value={editVeiculo} 
                     onChange={e => setEditVeiculo(e.target.value)} 
                     className="text-sm h-8 bg-white border-blue-200"
                     placeholder="Veículo de interesse"
                   />
                 ) : (
                   <p className="font-medium text-blue-900">{lead.veiculoInteressado || 'Não identificado pela IA'}</p>
                 )}
               </div>
             </div>

             {/* Informações de Qualificação / Visita */}
             <div className="space-y-3">
               <h3 className="font-semibold text-base text-gray-900 border-b pb-2">Detalhes da Visita / Qualificação</h3>
               <div className="grid gap-3">
                 <div className="bg-amber-50 rounded-lg p-3 text-sm border border-amber-100">
                   <p className="text-amber-700 text-[11px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1">Agendamento</p>
                   {isEditing ? (
                     <Input 
                       type="datetime-local"
                       value={editDataAgendamento} 
                       onChange={e => setEditDataAgendamento(e.target.value)} 
                       className="text-sm h-8 bg-white border-amber-200 w-full md:w-1/2"
                     />
                   ) : (
                     <p className="font-semibold text-amber-900">
                       {lead.dataAgendamento ? new Date(lead.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Não agendado'}
                     </p>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-100">
                   <p className="text-gray-500 text-[11px] uppercase tracking-wider font-bold mb-1">Observações da Qualificação</p>
                   {isEditing ? (
                     <Textarea 
                       value={editObservacao} 
                       onChange={e => setEditObservacao(e.target.value)} 
                       className="text-sm bg-white border-gray-200 min-h-[60px]"
                       placeholder="Observações da qualificação/visita..."
                     />
                   ) : (
                     <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                       {lead.observacaoLeadQualificado || '-'}
                     </p>
                   )}
                 </div>
               </div>
             </div>

             {/* Dados Cadastrais */}
             <div className="space-y-3">
               <h3 className="font-semibold text-base text-gray-900 border-b pb-2">Dados Cadastrais</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">E-mail</p>
                   {isEditing ? (
                     <Input 
                       value={editEmail} 
                       onChange={e => setEditEmail(e.target.value)} 
                       className="h-8 text-xs bg-white"
                       placeholder="E-mail"
                     />
                   ) : (
                     <p className="font-semibold text-gray-900">{lead.email || '-'}</p>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">CPF/CNPJ</p>
                   {isEditing ? (
                     <Input 
                       value={editCpfCnpj} 
                       onChange={e => setEditCpfCnpj(e.target.value)} 
                       className="h-8 text-xs bg-white"
                       placeholder="CPF/CNPJ"
                     />
                   ) : (
                     <p className="font-semibold text-gray-900">{lead.cpfCnpj || '-'}</p>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Data de Nascimento</p>
                   {isEditing ? (
                     <Input 
                       type="date"
                       value={editDataNascimento} 
                       onChange={e => setEditDataNascimento(e.target.value)} 
                       className="h-8 text-xs bg-white"
                     />
                   ) : (
                     <p className="font-semibold text-gray-900">{lead.dataNascimento ? (() => {
                       const parts = lead.dataNascimento.split('-');
                       if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                       return lead.dataNascimento;
                     })() : '-'}</p>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Veículo de Troca</p>
                   {isEditing ? (
                     <Input 
                       value={editVeiculoTroca} 
                       onChange={e => setEditVeiculoTroca(e.target.value)} 
                       className="h-8 text-xs bg-white"
                       placeholder="Veículo de troca"
                     />
                   ) : (
                     <p className="font-semibold text-gray-900">{lead.veiculoTroca || '-'}</p>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Endereço</p>
                   {isEditing ? (
                     <Input 
                       value={editEndereco} 
                       onChange={e => setEditEndereco(e.target.value)} 
                       className="h-8 text-xs bg-white"
                       placeholder="Endereço completo"
                     />
                   ) : (
                     <p className="font-semibold text-gray-900">{lead.endereco || '-'}</p>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Possui CNH?</p>
                   {isEditing ? (
                     <select
                       value={editPossuiCnh === null ? '' : String(editPossuiCnh)}
                       onChange={e => setEditPossuiCnh(e.target.value === '' ? null : e.target.value === 'true')}
                       className="w-full h-8 px-2 bg-white border border-gray-200 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
                     >
                       <option value="">Não informado</option>
                       <option value="true">Sim</option>
                       <option value="false">Não</option>
                     </select>
                   ) : (
                     <p className="font-semibold text-gray-900">
                       {lead.possuiCnh === true ? 'Sim' : lead.possuiCnh === false ? 'Não' : '-'}
                     </p>
                   )}
                 </div>
                 <div className="bg-gray-50 rounded-lg p-3 md:col-span-2">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Gênero</p>
                   {isEditing ? (
                     <Input 
                       value={editGenero} 
                       onChange={e => setEditGenero(e.target.value)} 
                       className="h-8 text-xs bg-white"
                       placeholder="Gênero"
                     />
                   ) : (
                     <p className="font-semibold text-gray-900">{lead.genero || '-'}</p>
                   )}
                 </div>
               </div>
             </div>

             {/* Vendedor */}
             {lead.vendedorLead && (
               <div className="space-y-2">
                 <h3 className="font-semibold text-base text-gray-900 border-b pb-2">Distribuição</h3>
                 <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                   <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium mb-1">Vendedor Atribuído</p>
                   <p className="font-semibold text-indigo-900">{lead.vendedorLead}</p>
                 </div>
               </div>
             )}

             {/* Timeline */}
             <div className="space-y-3">
               <h3 className="font-semibold text-base text-gray-900 border-b pb-2">Timeline e Notas</h3>
               
               {/* Formulário Inserir Nota */}
               <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                 <Textarea 
                    placeholder="Adicionar um registro manual ou anotação nesta timeline..." 
                    className="bg-white resize-none text-sm"
                    value={novaNota}
                    onChange={e => setNovaNota(e.target.value)}
                 />
                 <div className="flex justify-end">
                   <Button onClick={handleSalvarNota} disabled={salvandoNota || !novaNota.trim()} size="sm" className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                     {salvandoNota ? 'Salvando...' : 'Registrar Nota'}
                   </Button>
                 </div>
               </div>

               <div className="relative border-l-2 border-gray-200 ml-3 mt-4 space-y-6 pt-2">
                 {history.length > 0 ? (
                   history.map((event) => (
                     <div key={event.id} className="ml-5 relative">
                       <span className="absolute -left-[29px] flex items-center justify-center w-5 h-5 bg-blue-100 rounded-full ring-4 ring-white">
                         <div className={cn("w-2 h-2 rounded-full", event.evento === 'move' ? 'bg-indigo-600' : event.evento === 'note' ? 'bg-amber-500' : 'bg-blue-600')} />
                       </span>
                       <div className="flex flex-col">
                         <p className="text-xs font-bold text-gray-900 leading-none">{event.descricao}</p>
                         <p className="text-[10px] text-gray-400 mt-1 uppercase font-black tracking-widest">
                           Por {event.vendedor_nome || 'Sistema'} • {new Date(event.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                         </p>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="ml-5 relative">
                     <span className="absolute -left-[29px] flex items-center justify-center w-5 h-5 bg-blue-100 rounded-full ring-4 ring-white">
                       <div className="w-2 h-2 rounded-full bg-blue-600" />
                     </span>
                     <p className="text-xs font-semibold text-gray-900">Início da jornada</p>
                     <p className="text-[10px] text-gray-400 mt-1 font-bold">Aguardando novos eventos...</p>
                   </div>
                 )}
               </div>
             </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
