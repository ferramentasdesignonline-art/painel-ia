"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { 
  Building2, 
  MapPin, 
  Clock, 
  Sparkles, 
  Database, 
  Landmark, 
  Bell, 
  Smartphone, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  RefreshCw, 
  AlertCircle,
  Lock,
  Car,
  PackageCheck,
  Info,
  Plus,
  Trash2,
  UploadCloud,
  Image as ImageIcon,
  Check,
  X,
  Eye
} from "lucide-react"

// Funções Utilitárias de Máscara
function maskCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }
  return digits
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

// Lista de CRM / Sistemas
const SISTEMAS_CRM = [
  "BNDV",
  "Revenda Mais",
  "Auto Certo",
  "Loja Conectada",
  "Boom Sistemas",
  "Auto Conf",
  "Não possui",
  "Outro",
]

interface BancoField {
  name: string
  label: string
  type?: string
  mask?: "cnpj" | "cpf"
  placeholder?: string
}

// Lista de 15 Bancos com seus campos específicos e máscaras
const BANCOS_CONFIG: Record<string, { label: string; fields: BancoField[] }> = {
  altis: {
    label: "Altis",
    fields: [
      { name: "email", label: "E-mail de Acesso", type: "email", placeholder: "loja@altis.com.br" },
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
      { name: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
    ],
  },
  autobanking: {
    label: "AutoBanking",
    fields: [
      { name: "client_id", label: "Client ID", placeholder: "Client ID da API" },
      { name: "client_secret", label: "Client Secret", type: "password", placeholder: "Client Secret da API" },
    ],
  },
  bradesco: {
    label: "Bradesco Financiamentos",
    fields: [
      { name: "usuario", label: "Usuário", placeholder: "Usuário de acesso" },
      { name: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
    ],
  },
  bv: {
    label: "BV Financeira",
    fields: [
      { name: "usuario", label: "Usuário", placeholder: "Usuário de acesso" },
      { name: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
    ],
  },
  c6: {
    label: "C6 Bank",
    fields: [
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
      { name: "cpf_vendedor", label: "CPF do Vendedor", mask: "cpf", placeholder: "000.000.000-00" },
    ],
  },
  carbank: {
    label: "Carbank",
    fields: [
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
      { name: "usuario", label: "Usuário", placeholder: "Usuário de acesso" },
      { name: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
    ],
  },
  creditas: {
    label: "Creditas",
    fields: [
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
    ],
  },
  daycoval: {
    label: "Daycoval",
    fields: [
      { name: "api_id", label: "ID da API", placeholder: "ID da API" },
      { name: "api_secret", label: "Secret da API", type: "password", placeholder: "Secret da API" },
    ],
  },
  fontecred: {
    label: "Fontecred",
    fields: [
      { name: "usuario", label: "Usuário", placeholder: "Usuário de acesso" },
      { name: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
    ],
  },
  itau: {
    label: "Itaú Financiamentos",
    fields: [
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
    ],
  },
  kuna: {
    label: "Kuna",
    fields: [
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
    ],
  },
  motocred: {
    label: "Motocred",
    fields: [
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
    ],
  },
  pan: {
    label: "Banco PAN",
    fields: [
      { name: "usuario", label: "Usuário", placeholder: "Usuário de acesso" },
      { name: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
    ],
  },
  safra: {
    label: "Safra Financeira",
    fields: [
      { name: "cnpj", label: "CNPJ da Loja", mask: "cnpj", placeholder: "00.000.000/0001-00" },
    ],
  },
  santander: {
    label: "Santander Financiamentos",
    fields: [
      { name: "cpf", label: "CPF", mask: "cpf", placeholder: "000.000.000-00" },
      { name: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
    ],
  },
}

export interface VeiculoInicial {
  id: string
  marca: string
  modelo: string
  versao: string
  ano: string
  cor: string
  km: string
  combustivel: string
  cambio: string
  valor: string
  fotos: string[]
  opcionais: string[]
}

const OPCIONAIS_SUGESTOES = [
  "Ar-condicionado",
  "Direção Elétrica / Hidráulica",
  "Vidros Elétricos",
  "Travas Elétricas",
  "Bancos de Couro",
  "Teto Solar",
  "Central Multimídia",
  "Câmera de Ré",
  "Sensor de Estacionamento",
  "Rodas de Liga Leve",
  "Faróis Full LED",
  "Piloto Automático",
  "Chave Presencial",
  "Airbags / Freios ABS",
]

export default function OnboardingPublicPage() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)

  // Etapas: 1. Identidade & Loja, 2. CRM & Estoque, 3. Simulação Bancária, 4. Avisos, 5. Conexão WhatsApp
  const [currentStep, setCurrentStep] = useState(1)

  // Formulário - Etapa 1
  const [nomeEmpresa, setNomeEmpresa] = useState("")
  const [nomeIa, setNomeIa] = useState("")
  const [instagram, setInstagram] = useState("")
  const [cep, setCep] = useState("")
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [logradouro, setLogradouro] = useState("")
  const [numero, setNumero] = useState("")
  const [complemento, setComplemento] = useState("")
  const [bairro, setBairro] = useState("")
  const [cidade, setCidade] = useState("")
  const [uf, setUf] = useState("")
  const [tipoHorario, setTipoHorario] = useState<"seg_sex" | "seg_sab" | "personalizado">("seg_sab")
  const [horarioTexto, setHorarioTexto] = useState("Segunda a Sexta: 08:00 às 18:00 | Sábado: 08:00 às 13:00")

  // Formulário - Etapa 2: CRM & Veículos Iniciais
  const [sistemaEstoque, setSistemaEstoque] = useState("BNDV")
  const [sistemaOutro, setSistemaOutro] = useState("")
  const [crmEmail, setCrmEmail] = useState("")
  const [crmSenha, setCrmSenha] = useState("")

  // Veículos Iniciais para quem NÃO possui CRM
  const [veiculosIniciais, setVeiculosIniciais] = useState<VeiculoInicial[]>([])
  const [novoCarro, setNovoCarro] = useState<Partial<VeiculoInicial>>({
    marca: "",
    modelo: "",
    versao: "",
    ano: "",
    cor: "",
    km: "",
    combustivel: "Flex",
    cambio: "Automático",
    valor: "",
    fotos: [],
    opcionais: [],
  })
  const [uploadingCarPhotos, setUploadingCarPhotos] = useState(false)
  const [showAddCarForm, setShowAddCarForm] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Formulário - Etapa 3: Bancos
  const [vaiTerSimulacao, setVaiTerSimulacao] = useState(false)
  const [bancosSelecionados, setBancosSelecionados] = useState<string[]>([])
  const [bancosData, setBancosData] = useState<Record<string, Record<string, string>>>({})

  // Formulário - Etapa 4: Avisos
  const [whatsappAvisos, setWhatsappAvisos] = useState("")

  // Formulário - Etapa 5: WhatsApp
  const [nomeInstancia, setNomeInstancia] = useState("")
  const [instanceToken, setInstanceToken] = useState("")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [whatsappConectado, setWhatsappConectado] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Carrega Onboarding
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/onboarding/${token}`)
        const data = await res.json()
        if (res.ok && data.onboarding) {
          setOnboarding(data.onboarding)
          setNomeEmpresa(data.onboarding.nome_cliente || "")
          
          const cleanInstancia = (data.onboarding.nome_cliente || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, "")
          setNomeInstancia(cleanInstancia)

          if (data.onboarding.status === "concluido") {
            setConcluido(true)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (token) load()
  }, [token])

  // Busca CEP automático via ViaCEP
  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "")
    if (cleanCep.length === 8) {
      setBuscandoCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setLogradouro(data.logradouro || "")
          setBairro(data.bairro || "")
          setCidade(data.localidade || "")
          setUf(data.uf || "")
          setStepError(null)
        } else {
          setStepError("CEP não encontrado. Por favor, confira os números digitados.")
        }
      } catch (e) {
        console.warn("Erro ao buscar CEP:", e)
      } finally {
        setBuscandoCep(false)
      }
    }
  }

  // Atualiza preset de horários
  const handleTipoHorarioChange = (tipo: "seg_sex" | "seg_sab" | "personalizado") => {
    setTipoHorario(tipo)
    if (tipo === "seg_sex") {
      setHorarioTexto("Segunda a Sexta: 08:00 às 18:00 | Sábado e Domingo: Fechado")
    } else if (tipo === "seg_sab") {
      setHorarioTexto("Segunda a Sexta: 08:00 às 18:00 | Sábado: 08:00 às 13:00 | Domingo: Fechado")
    } else {
      setHorarioTexto("")
    }
  }

  // Toggle Banco
  const toggleBanco = (key: string) => {
    setStepError(null)
    if (bancosSelecionados.includes(key)) {
      setBancosSelecionados(prev => prev.filter(k => k !== key))
    } else {
      setBancosSelecionados(prev => [...prev, key])
    }
  }

  const handleBancoFieldChange = (bancoKey: string, fieldName: string, val: string, mask?: "cnpj" | "cpf") => {
    setStepError(null)
    let formattedVal = val
    if (mask === "cnpj") formattedVal = maskCnpj(val)
    if (mask === "cpf") formattedVal = maskCpf(val)

    setBancosData(prev => ({
      ...prev,
      [bancoKey]: {
        ...(prev[bancoKey] || {}),
        [fieldName]: formattedVal,
      }
    }))
  }

  // Upload de Fotos do Veículo
  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingCarPhotos(true)
    setStepError(null)
    try {
      const fd = new FormData()
      for (let i = 0; i < files.length; i++) {
        fd.append("files", files[i])
      }
      const res = await fetch(`/api/onboarding/${token}/upload`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao subir imagens")
      if (Array.isArray(data.urls)) {
        setNovoCarro(prev => ({
          ...prev,
          fotos: [...(prev.fotos || []), ...data.urls]
        }))
      }
    } catch (err: any) {
      setStepError(err.message || "Erro no upload das fotos")
    } finally {
      setUploadingCarPhotos(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemovePhoto = (photoUrl: string) => {
    setNovoCarro(prev => ({
      ...prev,
      fotos: (prev.fotos || []).filter(u => u !== photoUrl)
    }))
  }

  const toggleOpcionalCarro = (op: string) => {
    const current = novoCarro.opcionais || []
    if (current.includes(op)) {
      setNovoCarro(prev => ({ ...prev, opcionais: current.filter(o => o !== op) }))
    } else {
      setNovoCarro(prev => ({ ...prev, opcionais: [...current, op] }))
    }
  }

  const handleSalvarCarroNaLista = () => {
    if (!novoCarro.marca?.trim()) {
      setStepError("Por favor, informe a Marca do veículo (ex: Toyota).")
      return
    }
    if (!novoCarro.modelo?.trim()) {
      setStepError("Por favor, informe o Modelo do veículo (ex: Corolla).")
      return
    }
    if (!novoCarro.ano?.trim()) {
      setStepError("Por favor, informe o Ano / Modelo do veículo (ex: 2023/2024).")
      return
    }
    if (!novoCarro.valor?.trim()) {
      setStepError("Por favor, informe o Valor de Venda do veículo (ex: R$ 145.000).")
      return
    }
    if (!novoCarro.fotos || novoCarro.fotos.length === 0) {
      setStepError("Por favor, envie pelo menos 1 foto do veículo para a IA poder apresentar.")
      return
    }

    const veic: VeiculoInicial = {
      id: `veic_${Date.now()}`,
      marca: novoCarro.marca.trim(),
      modelo: novoCarro.modelo.trim(),
      versao: (novoCarro.versao || "").trim(),
      ano: novoCarro.ano.trim(),
      cor: (novoCarro.cor || "").trim(),
      km: (novoCarro.km || "").trim(),
      combustivel: novoCarro.combustivel || "Flex",
      cambio: novoCarro.cambio || "Automático",
      valor: novoCarro.valor.trim(),
      fotos: novoCarro.fotos,
      opcionais: novoCarro.opcionais || [],
    }

    setVeiculosIniciais(prev => [...prev, veic])
    setNovoCarro({
      marca: "",
      modelo: "",
      versao: "",
      ano: "",
      cor: "",
      km: "",
      combustivel: "Flex",
      cambio: "Automático",
      valor: "",
      fotos: [],
      opcionais: [],
    })
    setShowAddCarForm(false)
    setStepError(null)
  }

  const handleRemoverVeiculoLista = (id: string) => {
    setVeiculosIniciais(prev => {
      const rest = prev.filter(v => v.id !== id)
      if (rest.length === 0) setShowAddCarForm(true)
      return rest
    })
  }

  // Validador por Etapa
  const validateCurrentStep = (): boolean => {
    setStepError(null)

    // ETAPA 1
    if (currentStep === 1) {
      if (!nomeEmpresa.trim()) {
        setStepError("Por favor, preencha o Nome Oficial da Concessionária.")
        return false
      }
      if (!nomeIa.trim()) {
        setStepError("Por favor, digite o Nome da sua IA (atendente virtual).")
        return false
      }
      if (!instagram.trim()) {
        setStepError("Por favor, informe o Instagram oficial da sua loja (@usuario).")
        return false
      }
      const cleanCep = cep.replace(/\D/g, "")
      if (cleanCep.length !== 8) {
        setStepError("Por favor, informe um CEP válido com 8 dígitos.")
        return false
      }
      if (!logradouro.trim()) {
        setStepError("Por favor, informe a Rua / Avenida do endereço.")
        return false
      }
      if (!numero.trim()) {
        setStepError("Por favor, informe o Número do endereço da loja.")
        return false
      }
      if (!bairro.trim()) {
        setStepError("Por favor, informe o Bairro da loja.")
        return false
      }
      if (!cidade.trim()) {
        setStepError("Por favor, informe a Cidade da loja.")
        return false
      }
      if (!uf.trim() || uf.trim().length !== 2) {
        setStepError("Por favor, informe o Estado (UF com 2 letras).")
        return false
      }
      if (!horarioTexto.trim()) {
        setStepError("Por favor, defina o Horário de Atendimento da loja.")
        return false
      }
      return true
    }

    // ETAPA 2
    if (currentStep === 2) {
      if (!sistemaEstoque) {
        setStepError("Por favor, selecione qual sistema gerencia seu estoque.")
        return false
      }
      if (sistemaEstoque === "Outro" && !sistemaOutro.trim()) {
        setStepError("Por favor, especifique o nome do sistema de estoque.")
        return false
      }
      if (sistemaEstoque === "Não possui") {
        // Se o lojista preencheu o formulário mas não clicou em "+ Salvar Veículo",
        // tentamos salvar automaticamente para facilitar a vida dele
        let veics = [...veiculosIniciais]
        if (veics.length === 0 && novoCarro.marca && novoCarro.modelo && novoCarro.valor && novoCarro.fotos && novoCarro.fotos.length > 0) {
          const autoVeic: VeiculoInicial = {
            id: `veic_${Date.now()}`,
            marca: novoCarro.marca.trim(),
            modelo: novoCarro.modelo.trim(),
            versao: (novoCarro.versao || "").trim(),
            ano: (novoCarro.ano || "").trim(),
            cor: (novoCarro.cor || "").trim(),
            km: (novoCarro.km || "").trim(),
            combustivel: novoCarro.combustivel || "Flex",
            cambio: novoCarro.cambio || "Automático",
            valor: novoCarro.valor.trim(),
            fotos: novoCarro.fotos,
            opcionais: novoCarro.opcionais || [],
          }
          veics.push(autoVeic)
          setVeiculosIniciais(veics)
        }

        if (veics.length === 0) {
          setStepError("Como sua loja não tem CRM externo, é obrigatório cadastrar pelo menos 1 veículo (com Marca, Modelo, Ano, Valor e Fotos) para a IA começar a operar.")
          return false
        }
      } else {
        if (!crmEmail.trim()) {
          setStepError("Por favor, informe o e-mail ou usuário de acesso ao CRM.")
          return false
        }
        if (!crmSenha.trim()) {
          setStepError("Por favor, informe a senha de acesso ao CRM.")
          return false
        }
      }
      return true
    }

    // ETAPA 3
    if (currentStep === 3) {
      if (vaiTerSimulacao) {
        if (bancosSelecionados.length === 0) {
          setStepError("Selecione pelo menos um banco parceiro ou marque 'Não por enquanto'.")
          return false
        }

        // Valida todos os campos de cada banco selecionado
        for (const bKey of bancosSelecionados) {
          const config = BANCOS_CONFIG[bKey]
          if (!config) continue

          for (const f of config.fields) {
            const val = (bancosData[bKey]?.[f.name] || "").trim()
            if (!val) {
              setStepError(`O campo "${f.label}" do banco ${config.label} é obrigatório.`)
              return false
            }
            if (f.mask === "cnpj") {
              const digits = val.replace(/\D/g, "")
              if (digits.length !== 14) {
                setStepError(`O CNPJ do banco ${config.label} deve conter 14 dígitos válidos.`)
                return false
              }
            }
            if (f.mask === "cpf") {
              const digits = val.replace(/\D/g, "")
              if (digits.length !== 11) {
                setStepError(`O CPF do banco ${config.label} deve conter 11 dígitos válidos.`)
                return false
              }
            }
          }
        }
      }
      return true
    }

    // ETAPA 4
    if (currentStep === 4) {
      const cleanPhone = whatsappAvisos.replace(/\D/g, "")
      if (cleanPhone.length < 10) {
        setStepError("Por favor, informe um número de WhatsApp completo com DDD (mínimo 10 a 11 dígitos).")
        return false
      }
      return true
    }

    return true
  }

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setStepError(null)
      setCurrentStep(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  // Criar Instância e Gerar QR Code
  const handleGerarQrCode = async () => {
    setStepError(null)
    const cleanInst = nomeInstancia.replace(/\s+/g, "").trim()
    if (!cleanInst) {
      setStepError("Por favor, digite o nome da instância (sem espaços).")
      return
    }

    setGeneratingQr(true)
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_instance",
          nome_instancia: cleanInst,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao gerar instância")

      setInstanceToken(data.token)
      if (data.qrcode) {
        setQrCode(data.qrcode)
      }
    } catch (e: any) {
      setStepError(e.message || "Erro ao conectar com a Uazapi")
    } finally {
      setGeneratingQr(false)
    }
  }

  // Verificar se o WhatsApp conectou
  const handleVerificarConexao = async () => {
    if (!instanceToken) return
    setStepError(null)
    setCheckingStatus(true)
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_status",
          token: instanceToken,
        }),
      })
      const data = await res.json()
      if (data.connected) {
        setWhatsappConectado(true)
        setStepError(null)
      } else {
        setStepError("Ainda não detectamos a leitura. Aponte a câmera do WhatsApp para o QR Code e tente novamente.")
      }
    } catch (e: any) {
      console.error(e)
    } finally {
      setCheckingStatus(false)
    }
  }

  // Submeter formulário completo
  const handleSubmitFinal = async () => {
    setStepError(null)
    if (!whatsappConectado) {
      setStepError("Por favor, conecte seu WhatsApp lendo o QR Code antes de concluir.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        action: "submit",
        nome_empresa: nomeEmpresa,
        nome_ia: nomeIa,
        instagram: instagram,
        endereco: {
          cep,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf,
        },
        horarios: horarioTexto,
        sistema_estoque: sistemaEstoque === "Outro" ? sistemaOutro : sistemaEstoque,
        veiculos_iniciais: sistemaEstoque === "Não possui" ? veiculosIniciais : [],
        acesso_crm: sistemaEstoque === "Não possui" ? { email: "Nao se aplica", senha: "Nao se aplica" } : {
          email: crmEmail,
          senha: crmSenha,
        },
        simulacao_bancos: vaiTerSimulacao,
        bancos: vaiTerSimulacao ? bancosData : {},
        whatsapp_avisos: whatsappAvisos,
        instancia_whatsapp: nomeInstancia,
        whatsapp_conectado: true,
      }

      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao enviar respostas")

      setConcluido(true)
    } catch (e: any) {
      setStepError(e.message || "Erro ao finalizar onboarding")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-poppins">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-medium text-slate-500">Carregando formulário de configuração...</p>
        </div>
      </div>
    )
  }

  if (!onboarding) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-poppins">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Link não encontrado</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Este link de onboarding não existe ou expirou. Entre em contato com a equipe de suporte.
          </p>
        </div>
      </div>
    )
  }

  if (concluido) {
    return (
      <div className="min-h-screen bg-linear-to-b from-indigo-50/50 to-slate-50 flex items-center justify-center p-4 font-poppins">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100 max-w-lg w-full text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Configuração Concluída com Sucesso!</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Recebemos todos os dados da <strong>{nomeEmpresa || onboarding.nome_cliente}</strong> e seu WhatsApp já está conectado.
            </p>
          </div>

          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-left space-y-2 text-xs text-indigo-950">
            <p className="font-semibold flex items-center gap-1.5 text-indigo-700">
              <Sparkles className="w-4 h-4" />
              Próximos Passos:
            </p>
            <p>1. Nossa equipe técnica está validando as integrações e sincronizando o estoque.</p>
            <p>2. A assistente virtual <strong>{nomeIa || "sua IA"}</strong> será ativada em instantes.</p>
          </div>

          <p className="text-xs text-slate-400">
            Você já pode fechar esta página. Qualquer dúvida, fale com nosso time pelo WhatsApp.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-poppins py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Superior */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Configuração da Assistente Virtual
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Bem-vindo ao Onboarding da {nomeEmpresa || onboarding.nome_cliente}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
            Preencha as informações abaixo para ativarmos a Inteligência Artificial e a automação do seu WhatsApp.
          </p>
        </div>

        {/* Barra de Progresso / Stepper */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-5 gap-2 text-center text-[11px] font-bold">
            {[
              { num: 1, label: "Loja & IA" },
              { num: 2, label: "Estoque CRM" },
              { num: 3, label: "Bancos" },
              { num: 4, label: "Alertas" },
              { num: 5, label: "WhatsApp" },
            ].map((step) => {
              const isPast = currentStep > step.num
              const isCurrent = currentStep === step.num
              return (
                <div
                  key={step.num}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                    isCurrent 
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                      : isPast 
                      ? "text-emerald-700" 
                      : "text-slate-400"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent ? "bg-indigo-600 text-white" : isPast ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {isPast ? "✓" : step.num}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Alerta de Erro de Validação */}
        {stepError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold leading-relaxed">
              {stepError}
            </div>
          </div>
        )}

        {/* Card do Formulário */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">

          {/* ========================================================================= */}
          {/* ETAPA 1: LOJA & ATENDENTE IA */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  1. Dados da Concessionária & Atendente Virtual
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Como sua loja é conhecida e como a IA vai se apresentar para os seus clientes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Oficial da Concessionária *</label>
                  <input
                    type="text"
                    value={nomeEmpresa}
                    onChange={(e) => {
                      setNomeEmpresa(e.target.value)
                      setStepError(null)
                    }}
                    placeholder="Ex: Auto Motors Prime"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da IA (Atendente Virtual) *
                  </label>
                  <input
                    type="text"
                    value={nomeIa}
                    onChange={(e) => {
                      setNomeIa(e.target.value)
                      setStepError(null)
                    }}
                    placeholder="Ex: Sofia, Lucas, Bruna..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white font-medium text-purple-700 transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Nome com o qual a IA se apresentará no WhatsApp.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Instagram da Loja *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">@</span>
                    <input
                      type="text"
                      value={instagram.replace("@", "")}
                      onChange={(e) => {
                        setInstagram(e.target.value)
                        setStepError(null)
                      }}
                      placeholder="automotors"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Perfil oficial no Instagram (sem @).</p>
                </div>

                {/* Prévia da Apresentação da IA */}
                <div className="sm:col-span-2 p-4 bg-purple-50/60 border border-purple-200/60 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Prévia da Apresentação da sua IA:
                  </span>
                  <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-2xs text-xs text-slate-800 leading-relaxed flex items-start gap-2">
                    <span className="text-lg">💬</span>
                    <div>
                      &ldquo;Olá! Meu nome é <strong>{nomeIa.trim() || "[Nome da Atendente]"}</strong>, assistente virtual da <strong>{nomeEmpresa.trim() || "[Nome da Concessionária]"}</strong>! Como posso te ajudar hoje?&rdquo;
                    </div>
                  </div>
                </div>

                {/* Endereço com CEP Inteligente */}
                <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    Endereço da Loja (Para clientes que pedem a localização)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">CEP *</label>
                      <input
                        type="text"
                        value={cep}
                        onChange={(e) => {
                          setCep(maskCep(e.target.value))
                          setStepError(null)
                        }}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                      {buscandoCep && <p className="text-[10px] text-indigo-600 animate-pulse mt-0.5">Buscando endereço...</p>}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Rua / Avenida *</label>
                      <input
                        type="text"
                        value={logradouro}
                        onChange={(e) => {
                          setLogradouro(e.target.value)
                          setStepError(null)
                        }}
                        placeholder="Rua das Concessionárias"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Número *</label>
                      <input
                        type="text"
                        value={numero}
                        onChange={(e) => {
                          setNumero(e.target.value)
                          setStepError(null)
                        }}
                        placeholder="123"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white font-mono transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Complemento</label>
                      <input
                        type="text"
                        value={complemento}
                        onChange={(e) => setComplemento(e.target.value)}
                        placeholder="Sala 2, Loja A..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Bairro *</label>
                      <input
                        type="text"
                        value={bairro}
                        onChange={(e) => {
                          setBairro(e.target.value)
                          setStepError(null)
                        }}
                        placeholder="Centro"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Cidade / UF *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={cidade}
                          onChange={(e) => {
                            setCidade(e.target.value)
                            setStepError(null)
                          }}
                          placeholder="Cidade"
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />
                        <input
                          type="text"
                          value={uf}
                          onChange={(e) => {
                            setUf(e.target.value.toUpperCase())
                            setStepError(null)
                          }}
                          placeholder="UF"
                          maxLength={2}
                          className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-bold focus:outline-none focus:border-indigo-500 focus:bg-white uppercase transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Horário de Funcionamento */}
                <div className="sm:col-span-2 pt-2 border-t border-slate-100 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Horário de Atendimento da Loja *
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleTipoHorarioChange("seg_sab")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        tipoHorario === "seg_sab" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Segunda a Sábado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTipoHorarioChange("seg_sex")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        tipoHorario === "seg_sex" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Segunda a Sexta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTipoHorarioChange("personalizado")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        tipoHorario === "personalizado" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  <input
                    type="text"
                    value={horarioTexto}
                    onChange={(e) => {
                      setHorarioTexto(e.target.value)
                      setStepError(null)
                    }}
                    placeholder="Ex: Seg a Sex: 08h às 18h | Sáb: 08h às 13h"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: CRM & ESTOQUE */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" />
                  2. Acesso ao Sistema de Estoque / CRM
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Precisamos do acesso para a IA consultar seu estoque em tempo real (fotos, opcionais, km e valores).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Qual sistema sua loja utiliza para gerenciar o estoque? *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {SISTEMAS_CRM.map((crm) => {
                      const isSelected = sistemaEstoque === crm
                      return (
                        <button
                          key={crm}
                          type="button"
                          onClick={() => {
                            setSistemaEstoque(crm)
                            setStepError(null)
                          }}
                          className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer ${
                            isSelected 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" 
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {crm}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {sistemaEstoque === "Outro" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Qual outro sistema? *</label>
                    <input
                      type="text"
                      value={sistemaOutro}
                      onChange={(e) => {
                        setSistemaOutro(e.target.value)
                        setStepError(null)
                      }}
                      placeholder="Digite o nome do seu sistema ou integrador..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                )}

                {/* CADASTRO REAL DE VEÍCULOS QUANDO "NÃO POSSUI" CRM */}
                {sistemaEstoque === "Não possui" ? (
                  <div className="space-y-5 pt-2">
                    
                    {/* Banner explicativo */}
                    <div className="p-5 bg-linear-to-br from-indigo-50/90 via-purple-50/50 to-slate-50 border border-indigo-200/80 rounded-3xl space-y-3 text-slate-800">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Car className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-indigo-950">
                              Cadastre o seu Primeiro Veículo (Obrigatório)
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                              Estoque no Painel
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            Como sua concessionária não utiliza integrador externo, seu estoque será gerido no nosso módulo próprio. 
                            <strong> Cadastre pelo menos 1 veículo abaixo</strong> com fotos para que a IA já comece a atender e enviar propostas!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Carros Já Cadastrados */}
                    {veiculosIniciais.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Veículos Adicionados ({veiculosIniciais.length})
                          </h4>

                          {!showAddCarForm && (
                            <button
                              type="button"
                              onClick={() => setShowAddCarForm(true)}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Cadastrar Outro Veículo
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {veiculosIniciais.map((veic, idx) => (
                            <div key={veic.id} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center gap-3">
                              <img 
                                src={veic.fotos[0] || "/placeholder-car.png"} 
                                alt={veic.modelo}
                                className="w-16 h-16 rounded-xl object-cover border border-slate-100 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <h5 className="text-xs font-bold text-slate-900 truncate">
                                  {veic.marca} {veic.modelo}
                                </h5>
                                <p className="text-[11px] text-slate-500 truncate">{veic.versao || veic.ano}</p>
                                <span className="text-xs font-bold text-emerald-600">{veic.valor}</span>
                                <span className="text-[10px] text-slate-400 block">{veic.fotos.length} fotos</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoverVeiculoLista(veic.id)}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Remover veículo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formulário de Cadastro do Veículo */}
                    {showAddCarForm && (
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-indigo-600" />
                            {veiculosIniciais.length === 0 ? "1. Dados do Primeiro Veículo" : "Cadastrar Mais Um Veículo"}
                          </h4>

                          {veiculosIniciais.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowAddCarForm(false)}
                              className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>

                        {/* UPLOAD DE FOTOS REAL */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            Fotos do Veículo (Mínimo 1 foto) *
                          </label>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {novoCarro.fotos?.map((fUrl, fIdx) => (
                              <div key={fIdx} className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-black group">
                                <img src={fUrl} alt="Foto veículo" className="w-full h-full object-cover" />
                                {fIdx === 0 && (
                                  <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold shadow-xs">
                                    Capa
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(fUrl)}
                                  className="absolute top-1 right-1 bg-black/70 hover:bg-rose-600 text-white p-1 rounded-md transition-colors cursor-pointer"
                                  title="Remover foto"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingCarPhotos}
                              className="aspect-4/3 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/50 flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer disabled:opacity-50"
                            >
                              {uploadingCarPhotos ? (
                                <>
                                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin mb-1" />
                                  <span className="text-[10px] text-indigo-600 font-bold">Enviando...</span>
                                </>
                              ) : (
                                <>
                                  <UploadCloud className="w-6 h-6 text-indigo-600 mb-1" />
                                  <span className="text-[11px] font-bold text-indigo-900">+ Adicionar Fotos</span>
                                  <span className="text-[9px] text-slate-400">Do celular ou PC</span>
                                </>
                              )}
                            </button>
                          </div>

                          <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={handleUploadPhotos}
                            className="hidden" 
                          />
                        </div>

                        {/* Campos de Texto do Carro */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Marca *</label>
                            <input
                              type="text"
                              value={novoCarro.marca}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, marca: e.target.value }))}
                              placeholder="Ex: Toyota, Jeep, Honda..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo *</label>
                            <input
                              type="text"
                              value={novoCarro.modelo}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, modelo: e.target.value }))}
                              placeholder="Ex: Corolla, Compass, Civic..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Versão Completa</label>
                            <input
                              type="text"
                              value={novoCarro.versao}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, versao: e.target.value }))}
                              placeholder="Ex: Altis Hybrid 1.8 16V, Longitude T270..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Ano / Modelo *</label>
                            <input
                              type="text"
                              value={novoCarro.ano}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, ano: e.target.value }))}
                              placeholder="Ex: 2023/2024"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Preço de Venda (R$) *</label>
                            <input
                              type="text"
                              value={novoCarro.valor}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, valor: e.target.value }))}
                              placeholder="Ex: R$ 145.000"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold text-emerald-700"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Quilometragem</label>
                            <input
                              type="text"
                              value={novoCarro.km}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, km: e.target.value }))}
                              placeholder="Ex: 28.500 km"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Câmbio</label>
                            <select
                              value={novoCarro.cambio}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, cambio: e.target.value }))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                            >
                              <option value="Automático">Automático</option>
                              <option value="Manual">Manual</option>
                              <option value="CVT">CVT</option>
                              <option value="Automatizado">Automatizado</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Combustível</label>
                            <select
                              value={novoCarro.combustivel}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, combustivel: e.target.value }))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                            >
                              <option value="Flex">Flex</option>
                              <option value="Gasolina">Gasolina</option>
                              <option value="Híbrido">Híbrido</option>
                              <option value="Elétrico">Elétrico</option>
                              <option value="Diesel">Diesel</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Cor</label>
                            <input
                              type="text"
                              value={novoCarro.cor}
                              onChange={(e) => setNovoCarro(prev => ({ ...prev, cor: e.target.value }))}
                              placeholder="Ex: Branco Pérola, Preto, Cinza..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Opcionais */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">
                            Opcionais e Itens do Veículo:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {OPCIONAIS_SUGESTOES.map((op) => {
                              const isSelected = novoCarro.opcionais?.includes(op)
                              return (
                                <button
                                  key={op}
                                  type="button"
                                  onClick={() => toggleOpcionalCarro(op)}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-all cursor-pointer ${
                                    isSelected 
                                      ? "bg-indigo-600 text-white border-indigo-600 font-bold" 
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {isSelected ? "✓ " : "+ "} {op}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Botão de Salvar Veículo */}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={handleSalvarCarroNaLista}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            Salvar Veículo na Lista
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
                      <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Tudo pronto!</strong> Assim que o onboarding for concluído, esses veículos estarão disponíveis para a sua IA ofertar no WhatsApp.
                      </span>
                    </div>

                  </div>
                ) : (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      Credenciais de Acesso ao Sistema ({sistemaEstoque === "Outro" ? sistemaOutro || "Sistema" : sistemaEstoque}) *
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">E-mail ou Usuário de Acesso *</label>
                        <input
                          type="text"
                          value={crmEmail}
                          onChange={(e) => {
                            setCrmEmail(e.target.value)
                            setStepError(null)
                          }}
                          placeholder="usuario@loja.com.br"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-mono transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Senha de Acesso *</label>
                        <input
                          type="password"
                          value={crmSenha}
                          onChange={(e) => {
                            setCrmSenha(e.target.value)
                            setStepError(null)
                          }}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-mono transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: SIMULAÇÃO BANCÁRIA */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600" />
                  3. Simulação de Financiamento nos Bancos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  A IA pode simular e aprovar fichas de financiamento automaticamente para os seus clientes.
                </p>
              </div>

              {/* Pergunta Sim / Não */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  Sua loja deseja que a IA faça simulações bancárias nos bancos parceiros? *
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setVaiTerSimulacao(true)
                      setStepError(null)
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      vaiTerSimulacao 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" 
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Sim, vamos usar simulação
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVaiTerSimulacao(false)
                      setStepError(null)
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      !vaiTerSimulacao 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" 
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Não por enquanto
                  </button>
                </div>
              </div>

              {vaiTerSimulacao && (
                <div className="space-y-4 pt-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Selecione os bancos com os quais sua concessionária opera: *
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(BANCOS_CONFIG).map(([key, config]) => {
                        const isChecked = bancosSelecionados.includes(key)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleBanco(key)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center justify-between transition-all cursor-pointer ${
                              isChecked 
                                ? "bg-indigo-50 border-indigo-500 text-indigo-900 font-bold" 
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span>{config.label}</span>
                            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                              isChecked ? "bg-indigo-600 text-white" : "border border-slate-300"
                            }`}>
                              {isChecked && "✓"}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Campos dos bancos selecionados */}
                  {bancosSelecionados.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Preencha os dados dos bancos selecionados (Todos obrigatórios):
                      </h4>

                      {bancosSelecionados.map((bKey) => {
                        const config = BANCOS_CONFIG[bKey]
                        return (
                          <div key={bKey} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <span className="text-xs font-bold text-indigo-900 uppercase block">
                              🏦 {config.label}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {config.fields.map((f) => (
                                <div key={f.name}>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">{f.label} *</label>
                                  <input
                                    type={f.type || "text"}
                                    value={bancosData[bKey]?.[f.name] || ""}
                                    onChange={(e) => handleBancoFieldChange(bKey, f.name, e.target.value, f.mask)}
                                    placeholder={f.placeholder}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 transition-all"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: AVISOS & ALERTAS */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  4. Número para Alertas de Leads
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Para qual WhatsApp devemos avisar quando houver visita agendada ou ficha aprovada?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp do Gerente ou Vendedor Responsável *
                  </label>
                  <input
                    type="text"
                    value={whatsappAvisos}
                    onChange={(e) => {
                      setWhatsappAvisos(maskPhone(e.target.value))
                      setStepError(null)
                    }}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white font-mono transition-all font-semibold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Este número receberá as notificações automáticas de leads quentes, visitas presenciais agendadas e fichas simuladas.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1 text-xs text-emerald-900">
                  <span className="font-bold block">📲 O que você vai receber nesse número:</span>
                  <p>• Notificação imediata de cliente agendando visita na loja;</p>
                  <p>• Ficha de financiamento aprovada para fechamento;</p>
                  <p>• Resumo diário de atendimentos e leads do dia.</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 5: CONEXÃO WHATSAPP */}
          {/* ========================================================================= */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  5. Conexão Oficial do WhatsApp
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conecte o WhatsApp da sua loja agora para a assistente virtual começar a operar.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Instância (Identificador) *
                  </label>
                  <input
                    type="text"
                    value={nomeInstancia}
                    onChange={(e) => {
                      setNomeInstancia(e.target.value.replace(/\s+/g, ""))
                      setStepError(null)
                    }}
                    placeholder="NomeSemEspacos"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Identificador único do WhatsApp no servidor (sem espaços).</p>
                </div>

                {!whatsappConectado ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-5">
                    {!qrCode ? (
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
                          <Smartphone className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Clique para Gerar o QR Code</h3>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                            Será gerado um código igual ao WhatsApp Web para você escanear pelo celular da concessionária.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleGerarQrCode}
                          disabled={generatingQr || !nomeInstancia}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                        >
                          {generatingQr ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Criando e Gerando QR Code...</span>
                            </>
                          ) : (
                            <span>Gerar QR Code de Conexão</span>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="inline-flex px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          Aguardando Leitura pelo Aparelho
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Aponte a câmera do WhatsApp:</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Abra o WhatsApp &gt; Configurações &gt; <strong>Aparelhos Conectados</strong> &gt; Conectar aparelho
                          </p>
                        </div>

                        <div className="p-3 bg-white border border-slate-200 rounded-2xl max-w-xs mx-auto shadow-sm">
                          <img src={qrCode} alt="QR Code WhatsApp" className="w-60 h-60 object-contain mx-auto rounded-lg" />
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleVerificarConexao}
                            disabled={checkingStatus}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {checkingStatus ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Verificando conexão...</span>
                              </>
                            ) : (
                              <span>Já Escaneei! Verificar Conexão</span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleGerarQrCode}
                            disabled={generatingQr}
                            className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-xl transition-all cursor-pointer"
                          >
                            Gerar Novo QR Code
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-3">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-emerald-950">WhatsApp Conectado com Sucesso!</h3>
                    <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                      A instância está ativa e pronta para operar. Você já pode finalizar a configuração!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navegação Entre Etapas */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setStepError(null)
                  setCurrentStep(prev => prev - 1)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            ) : <div />}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                Próximo Passo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitFinal}
                disabled={submitting || !whatsappConectado}
                className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Finalizando Configuração...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Concluir Onboarding da Loja</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
