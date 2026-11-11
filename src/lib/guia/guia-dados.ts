export interface GuiaItem {
  id: string
  title: string
  route: string
  iconName: string
  tagline: string
  badge?: string
  summary: string
  requires?: {
    moduloBancos?: boolean
    moduloEstoque?: boolean
    comIA?: boolean
  }
  keyFeatures: {
    title: string
    desc: string
  }[]
  stepByStep: {
    step: number
    title: string
    description: string
    tip?: string
  }[]
  statusMeaning?: {
    label: string
    color: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray'
    description: string
  }[]
  proTips: string[]
  faqs: {
    question: string
    answer: string
  }[]
}

export const GUIA_ITEMS: GuiaItem[] = [
  {
    id: "dashboard",
    title: "Dashboard Geral",
    route: "/dashboard",
    iconName: "LayoutDashboard",
    tagline: "Visão estratégica em tempo real das métricas da sua concessionária",
    badge: "Visão Geral",
    summary: "O Dashboard é a central de comando da sua loja. Ele reúne em tempo real o volume de leads recebidos, taxa de resposta, horários de pico e o desempenho geral de conversão.",
    keyFeatures: [
      {
        title: "Total de Leads & Contatos",
        desc: "Contabiliza todos os clientes que entraram em contato com a sua concessionária através do WhatsApp ou formulários integrados."
      },
      {
        title: "Atendimentos Ativos & Em Andamento",
        desc: "Mede o fluxo de conversas que estão ativas no momento, permitindo acompanhar o ritmo da equipe de vendas."
      },
      {
        title: "Taxa de Engajamento & Conversão",
        desc: "Métricas calculadas automaticamente mostrando quantos leads responderam e avançaram para negociação ou agendamento de visita."
      },
      {
        title: "Gráficos de Tendência e Picos de Atendimento",
        desc: "Descubra em quais dias e horários a sua loja recebe mais clientes para planejar melhor a escala dos vendedores."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Verifique o resumo do dia logo pela manhã",
        description: "Acompanhe quantos novos leads chegaram fora do horário comercial e já foram recepcionados pelo sistema.",
        tip: "Leads que recebem retorno nos primeiros 5 minutos têm 7x mais chances de fechar negócio."
      },
      {
        step: 2,
        title: "Identifique gargalos no fluxo",
        description: "Se o total de leads for alto mas a taxa de visita for baixa, verifique a qualidade dos retornos dos vendedores no módulo Leads.",
      },
      {
        step: 3,
        title: "Analise a evolução semanal",
        description: "Compare o desempenho de semanas anteriores para avaliar o impacto das campanhas de marketing."
      }
    ],
    proTips: [
      "Use as métricas do Dashboard na reunião semanal de vendas com sua equipe.",
      "Se os picos de atendimento forem à noite ou finais de semana, certifique-se de que a IA ou o fluxo de automação esteja ativo para não perder nenhum cliente."
    ],
    faqs: [
      {
        question: "De quanto em quanto tempo o Dashboard é atualizado?",
        answer: "Os dados são atualizados em tempo real conforme as conversas e leads são registrados no sistema."
      },
      {
        question: "Por que o número de leads do Dashboard pode ser diferente do funil?",
        answer: "O Dashboard conta o volume total de contatos únicos que interagiram com a sua loja, enquanto o Funil de Leads organiza apenas os que foram qualificados e atribuídos a uma etapa ativa de vendas."
      }
    ]
  },
  {
    id: "leads",
    title: "Gestão de Leads",
    route: "/leads",
    iconName: "Users",
    tagline: "Lista completa de todos os clientes que entraram em contato com a loja",
    badge: "Comercial",
    summary: "Aqui você tem acesso a todos os contatos captados. Pode buscar clientes pelo nome, número de telefone, consultar o histórico da conversa, atribuir etiquetas e acompanhar cada etapa da negociação.",
    keyFeatures: [
      {
        title: "Busca Rápida Instantânea",
        desc: "Localize qualquer cliente em segundos digitando parte do nome ou dígitos do telefone."
      },
      {
        title: "Filtros por Período e Status",
        desc: "Filtre leads recebidos hoje, ontem, nos últimos 7 ou 30 dias, e veja rapidamente quem ainda precisa de retorno."
      },
      {
        title: "Etiquetas & Qualificação",
        desc: "Classifique o perfil do cliente (ex: Troca, Financiamento, À vista, Urgente) para direcionar ao vendedor ideal."
      },
      {
        title: "Histórico Completo",
        desc: "Acesse o resumo e as anotações do cliente para entender o interesse antes de ligar ou enviar uma nova mensagem."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Use a barra de pesquisa para achar um contato",
        description: "Digite o telefone (com ou sem DDD) ou o nome do cliente.",
      },
      {
        step: 2,
        title: "Consulte os detalhes do lead",
        description: "Clique no card ou linha do cliente para abrir a ficha completa, veículo de interesse e histórico.",
        tip: "Verifique se o cliente informou dados de entrada ou carro na troca para já preparar a simulação."
      },
      {
        step: 3,
        title: "Atualize o status ou etapa",
        description: "Conforme a conversa avança, atualize a etapa para que toda a equipe saiba em qual ponto está o atendimento."
      }
    ],
    proTips: [
      "Nunca deixe um lead mais de 24 horas sem atualização de status.",
      "Utilize as tags para identificar de onde o lead veio (ex: Instagram, Facebook, Webmotors) e entender quais canais trazem mais vendas."
    ],
    faqs: [
      {
        question: "Como um novo lead entra nesta tela?",
        answer: "Automaticamente assim que um novo número manda mensagem no WhatsApp conectado da loja, ou manualmente pelo botão 'Novo Lead'."
      },
      {
        question: "Posso exportar os dados dos clientes?",
        answer: "Sim, os administradores da loja podem visualizar a lista completa e integrá-la aos relatórios comerciais."
      }
    ]
  },
  {
    id: "funil",
    title: "Funil de Leads (Kanban)",
    route: "/funil",
    iconName: "Trophy",
    tagline: "Pipeline visual para acompanhar a jornada do cliente da entrada ao fechamento",
    badge: "Vendas",
    summary: "O Funil de Vendas transforma sua lista de clientes em um quadro Kanban visual. Você arrasta os cards dos clientes entre as colunas (Novo Lead, Qualificado, Visita Agendada, Em Proposta, Fechado, etc.) conforme a negociação avança.",
    keyFeatures: [
      {
        title: "Quadro Visual Drag & Drop",
        desc: "Arraste e solte cards de clientes de uma coluna para a outra com facilidade."
      },
      {
        title: "Etapas Personalizáveis",
        desc: "Cada loja pode configurar as suas próprias etapas comerciais no botão 'Configurar Etapas'."
      },
      {
        title: "Adição Manual de Oportunidades",
        desc: "Adicione na hora clientes que entraram na loja física para não perder o controle do atendimento."
      },
      {
        title: "Métricas por Coluna",
        desc: "Veja quantos clientes e qual o valor total em negociação em cada estágio do funil."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Acompanhe a coluna 'Novos Leads'",
        description: "Todos os clientes recém-chegados caem na primeira etapa do funil.",
      },
      {
        step: 2,
        title: "Mova o cliente conforme a interação",
        description: "Se o vendedor agendou um test-drive, arraste o card para 'Visita Agendada'. Se o cliente fez proposta, arraste para 'Em Proposta'.",
        tip: "Mantenha o card sempre na coluna correta para evitar que outro vendedor entre em contato duplicado."
      },
      {
        step: 3,
        title: "Finalize como Ganho ou Perdido",
        description: "Ao fechar a venda, arraste para 'Fechado/Ganho'. Se o cliente desistiu, mova para 'Perdido' anotando o motivo da desistência."
      }
    ],
    proTips: [
      "Dedique 15 minutos no início da manhã e no final da tarde para limpar e atualizar o funil.",
      "Analise em qual coluna os leads costumam travar (ex: muitos leads em 'Proposta' sem fechar pode indicar necessidade de melhores condições de financiamento)."
    ],
    faqs: [
      {
        question: "Como crio uma nova etapa no meu funil?",
        answer: "Clique no botão 'Configurar Etapas' no topo do funil. Você pode criar novas colunas, alterar cores, renomear e ordenar conforme o fluxo da sua concessionária."
      },
      {
        question: "Um lead movido aqui atualiza o WhatsApp?",
        answer: "Sim, a etapa do lead fica sincronizada em todo o sistema, facilitando a visualização de toda a equipe."
      }
    ]
  },
  {
    id: "whatsapp-web",
    title: "WhatsApp Web no Sistema",
    route: "/whatsapp-web",
    iconName: "MessageSquare",
    tagline: "Painel de atendimento centralizado para gerenciar conversas em tempo real",
    badge: "Comunicação",
    summary: "Permite que sua equipe visualize e responda todas as conversas do WhatsApp da loja diretamente dentro da plataforma, sem precisar do celular em mãos, com total histórico de mensagens, áudios e mídias.",
    keyFeatures: [
      {
        title: "Painel Unificado de Conversas",
        desc: "Todas as conversas da loja organizadas por ordem de recebimento com indicador de mensagens não lidas."
      },
      {
        title: "Envio e Recebimento em Tempo Real",
        desc: "Troque mensagens de texto, envie fotos de carros, PDFs de propostas e áudios com agilidade."
      },
      {
        title: "Histórico Seguro",
        desc: "O histórico das conversas com os clientes fica preservado na plataforma para consultas futuras."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Selecione o chat na lista à esquerda",
        description: "Os clientes com mensagens mais recentes aparecem no topo.",
      },
      {
        step: 2,
        title: "Leia a conversa e responda",
        description: "Digite sua mensagem no campo inferior e envie. A resposta chega instantaneamente no WhatsApp do cliente.",
        tip: "Você pode pausar a IA temporariamente para aquele cliente específico antes de enviar uma mensagem manual."
      }
    ],
    proTips: [
      "Use respostas rápidas e cordiais para manter o lead aquecido.",
      "Sempre verifique o histórico antes de responder para entender exatamente o que a IA ou outro vendedor já conversou com o cliente."
    ],
    faqs: [
      {
        question: "Se eu responder pelo WhatsApp Web do sistema, o cliente vê normalmente no WhatsApp dele?",
        answer: "Sim! A mensagem sai diretamente do número oficial da sua concessionária, como se tivesse sido digitada no próprio aparelho celular."
      },
      {
        question: "O que acontece se a internet cair?",
        answer: "Assim que a conexão for restabelecida, o sistema sincroniza as novas mensagens automaticamente."
      }
    ]
  },
  {
    id: "whatsapp",
    title: "Conexão WhatsApp",
    route: "/whatsapp",
    iconName: "MessageCircle",
    tagline: "Gerenciamento da conexão do número de WhatsApp da concessionária",
    badge: "Infraestrutura",
    summary: "Esta tela permite parear o número de WhatsApp da sua loja com o sistema via QR Code e monitorar se a conexão com os servidores está ativa, estável e pronta para receber mensagens.",
    keyFeatures: [
      {
        title: "Leitura de QR Code Simples",
        desc: "Conecte seu WhatsApp em poucos segundos apontando a câmera do celular, exatamente como no WhatsApp Web."
      },
      {
        title: "Monitor de Conectividade",
        desc: "Indicador em tempo real mostrando se o WhatsApp está Conectado, Conectando ou Desconectado."
      },
      {
        title: "Reconexão com 1 Clique",
        desc: "Botão para reiniciar ou gerar novo QR Code instantaneamente caso haja oscilação na linha."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Abra o WhatsApp no seu smartphone",
        description: "Vá em Configurações (ou 3 pontinhos) > Aparelhos Conectados > Conectar um Aparelho.",
      },
      {
        step: 2,
        title: "Aponte a câmera para o QR Code da tela",
        description: "Aguarde a leitura. Em poucos instantes o status mudará para verde ('Conectado').",
        tip: "Mantenha o aparelho celular com bateria e conexão Wi-Fi estável durante o pareamento."
      },
      {
        step: 3,
        title: "Confirme o status ativo",
        description: "Assim que aparecer verde, a IA e o sistema de atendimento já estarão prontos para operar."
      }
    ],
    statusMeaning: [
      {
        label: "Conectado",
        color: "green",
        description: "Tudo funcionando 100%. Mensagens sendo recebidas e enviadas com sucesso."
      },
      {
        label: "Conectando / Aguardando QR Code",
        color: "amber",
        description: "O sistema está gerando o código de pareamento. Aponte a câmera do WhatsApp para conectar."
      },
      {
        label: "Desconectado",
        color: "red",
        description: "A sessão foi encerrada no celular ou expirou. Clique em 'Gerar QR Code' para reconectar."
      }
    ],
    proTips: [
      "Evite usar o mesmo WhatsApp pessoal para o atendimento comercial da loja.",
      "Nunca desconecte o aparelho no celular sem necessidade para não interromper o atendimento aos clientes."
    ],
    faqs: [
      {
        question: "Preciso deixar o celular da loja ligado e com internet o tempo todo?",
        answer: "Sim, o WhatsApp oficial precisa que o aparelho matriz esteja ativo e com acesso à internet para garantir a estabilidade das mensagens."
      },
      {
        question: "O que fazer se o QR Code expirar?",
        answer: "Basta clicar no botão 'Atualizar' ou 'Gerar Novo QR Code' na tela para recarregar a imagem e escanear novamente."
      }
    ]
  },
  {
    id: "bancos",
    title: "Bancos & Financiamento",
    route: "/bancos",
    iconName: "Landmark",
    tagline: "Integração oficial com os maiores bancos de financiamento automotivo do Brasil",
    badge: "Crédito",
    requires: { moduloBancos: true },
    summary: "O módulo de Bancos conecta sua loja diretamente com as financeiras (BV, Santander, Bradesco, Pan, C6, etc.). Você cadastra as credenciais e operadores da sua concessionária para que o sistema consiga simular crédito automaticamente para os seus clientes.",
    keyFeatures: [
      {
        title: "Multi-Bancos em Uma Única Tela",
        desc: "Visualize e gerencie todos os 15 bancos homologados (BV, Santander, Bradesco, Pan, C6, Daycoval, Safra, etc.)."
      },
      {
        title: "Status das Credenciais em Tempo Real",
        desc: "Identifique na hora quais bancos estão conectados e quais precisam de nova senha ou código de operador."
      },
      {
        title: "Gestão Segura de Operadores",
        desc: "Cadastre usuário, senha, código de operador ou chave de acesso da sua loja para cada financeira de forma criptografada."
      },
      {
        title: "Sincronização com Simulações",
        desc: "Ao cadastrar um banco, ele entra automaticamente no pacote de simulações da sua concessionária."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Localize o banco desejado",
        description: "Use a barra de pesquisa ou os filtros de status (Conectados, Sem credencial, etc.).",
      },
      {
        step: 2,
        title: "Clique em 'Gerenciar' ou 'Conectar'",
        description: "Insira as credenciais do operador que a sua concessionária possui junto àquele banco (ex: Usuário, Senha, Código da Loja).",
        tip: "Use as mesmas credenciais que seus vendedores ou operador financeiro (F&I) usam para entrar no portal oficial do banco."
      },
      {
        step: 3,
        title: "Salve e aguarde a validação",
        description: "O sistema valida as credenciais diretamente com o banco. Ao concluir, o status passa a ser exibido como 'Conectado'."
      }
    ],
    statusMeaning: [
      {
        label: "Conectado",
        color: "green",
        description: "Credenciais válidas e ativas. O banco está pronto para participar das simulações de financiamento."
      },
      {
        label: "Requer reconexão / Credencial Inválida",
        color: "red",
        description: "A senha expirou no banco ou foi digitada incorretamente. Clique em 'Gerenciar' e insira a senha atualizada."
      },
      {
        label: "Sem credencial",
        color: "gray",
        description: "Sua loja ainda não cadastrou o operador deste banco no sistema."
      },
      {
        label: "Em verificação",
        color: "amber",
        description: "O banco está autenticando o operador nos servidores oficiais."
      }
    ],
    proTips: [
      "Quanto mais bancos sua loja tiver conectados, maiores as chances de aprovar crédito para clientes com perfis diferentes.",
      "Lembre-se de atualizar a senha no sistema sempre que o banco exigir a troca de senha periódica no portal da financeira."
    ],
    faqs: [
      {
        question: "Minhas senhas bancárias estão seguras?",
        answer: "Sim! Todas as credenciais são enviadas via canal seguro e criptografadas, usadas exclusivamente para consultar condições de simulação e aprovação de crédito autorizadas pelo cliente."
      },
      {
        question: "Se um banco der 'Credencial Inválida', o resto do sistema para?",
        answer: "Não! O sistema continua simulando com todos os outros bancos conectados. Apenas o banco com a senha incorreta ficará de fora até você atualizar."
      }
    ]
  },
  {
    id: "simulacoes",
    title: "Simulações de Financiamento",
    route: "/simulacoes",
    iconName: "Calculator",
    tagline: "Histórico e acompanhamento das propostas de financiamento geradas",
    badge: "Crédito",
    requires: { moduloBancos: true },
    summary: "Aqui ficam registradas todas as simulações de financiamento solicitadas pelos clientes. Você consulta os prazos (12x a 60x), valores de parcelas de cada banco, taxas de retorno e o status da proposta.",
    keyFeatures: [
      {
        title: "Comparativo Multi-Bancos",
        desc: "Veja em uma única visualização quanto ficaria a parcela no BV, Santander, Pan, Bradesco e C6 para o mesmo veículo."
      },
      {
        title: "Condições Detalhadas de Parcelas",
        desc: "Opções de 12x, 24x, 36x, 48x e 60x com valor de entrada especificado pelo cliente."
      },
      {
        title: "Retorno da Loja (Comissão)",
        desc: "Cálculo baseado no retorno mínimo e máximo configurado pela sua concessionária."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Acompanhe as simulações geradas",
        description: "Veja o nome do cliente, veículo pretendido e valor de entrada informado.",
      },
      {
        step: 2,
        title: "Analise a melhor oferta",
        description: "Identifique qual banco ofereceu a menor parcela ou a maior taxa de retorno para a concessionária.",
        tip: "Apresente para o cliente as duas opções mais competitivas para acelerar a decisão de compra."
      },
      {
        step: 3,
        title: "Avançar para a proposta formal",
        description: "Com o cliente concordando com a parcela, envie a documentação definitiva para fechamento no portal do banco."
      }
    ],
    proTips: [
      "Simulações com maior valor de entrada têm aprovação muito mais rápida e taxas de juros mais atrativas.",
      "Oriente o cliente a informar sempre o CPF correto e renda sem divergências."
    ],
    faqs: [
      {
        question: "A simulação consulta o Score do cliente?",
        answer: "Sim, os bancos fazem a análise preliminar de crédito com base no CPF/CNPJ informado para definir a taxa e o limite pré-aprovado."
      },
      {
        question: "Como o cliente recebe o resultado?",
        answer: "A simulação é processada e o resumo com os valores de parcelas pode ser enviado diretamente na conversa do WhatsApp do cliente."
      }
    ]
  },
  {
    id: "estoque",
    title: "Estoque de Veículos",
    route: "/estoque",
    iconName: "Car",
    tagline: "Catálogo de carros e motos disponíveis para venda na concessionária",
    badge: "Veículos",
    requires: { moduloEstoque: true },
    summary: "Gerencie todos os veículos da sua loja. A IA e os vendedores consultam esta lista para enviar fotos, valores, ano/modelo, opcionais e disponibilidade em tempo real para os clientes no WhatsApp.",
    keyFeatures: [
      {
        title: "Catálogo Completo com Fotos",
        desc: "Fotos em alta definição, especificações técnicas, quilometragem, cor, combustível e opcionais."
      },
      {
        title: "Preço de Venda e Condições",
        desc: "Valor anunciado e margem de negociação disponível para a equipe de vendas."
      },
      {
        title: "Consulta Inteligente pela IA",
        desc: "A inteligência artificial lê este estoque para responder dúvidas dos clientes (ex: 'Vocês têm Onix 2021 automático?')."
      },
      {
        title: "Status de Disponibilidade",
        desc: "Marque veículos como 'Disponível', 'Reservado' ou 'Vendido' com um único clique."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Cadastre novos veículos com fotos de qualidade",
        description: "Adicione placa, modelo, ano de fabricação, ano do modelo e valor de venda.",
        tip: "Veículos com fotos nítidas do interior e exterior aumentam em 40% a taxa de visita na loja."
      },
      {
        step: 2,
        title: "Mantenha os valores atualizados",
        description: "Sempre que houver alteração de preço ou promoção, atualize no estoque para que a IA e os vendedores informem o valor correto.",
      },
      {
        step: 3,
        title: "Reserve ao receber sinal",
        description: "Assim que um cliente der entrada ou sinal, mude o status para 'Reservado' evitando duplicidade de venda."
      }
    ],
    proTips: [
      "Fotos bem iluminadas e sem marcas d'água pesadas passam muito mais credibilidade aos clientes do WhatsApp.",
      "Descreva opcionais relevantes como teto solar, câmbio automático, bancos em couro e garantia de fábrica."
    ],
    faqs: [
      {
        question: "A IA avisa o cliente se o carro for vendido?",
        answer: "Sim! Se um veículo for marcado como 'Vendido', a IA avisará o cliente cordialmente e sugerirá modelos semelhantes do seu estoque."
      },
      {
        question: "Posso integrar com meu sistema de estoque atual?",
        answer: "Sim, consulte o suporte técnico da Design Online para verificar a sincronização automática do estoque da sua loja."
      }
    ]
  },
  {
    id: "bloqueios",
    title: "Bloqueio de Números",
    route: "/bloqueios",
    iconName: "ShieldBan",
    tagline: "Impeça a IA de responder contatos específicos ou números internos",
    badge: "Segurança",
    requires: { comIA: true },
    summary: "Nesta tela você cadastra telefones que NÃO devem ser atendidos pela inteligência artificial. Ideal para números de donos da loja, gerentes, vendedores, parentes ou fornecedores que conversam no mesmo WhatsApp da empresa.",
    keyFeatures: [
      {
        title: "Pausa Instantânea da IA",
        desc: "Qualquer número adicionado nesta lista é ignorado pela IA, permitindo atendimento 100% humano."
      },
      {
        title: "Bloqueio por DDD ou Telefone Completo",
        desc: "Cadastre o número com DDD para bloquear pontualmente sem afetar o restante dos clientes."
      },
      {
        title: "Ativação e Desativação Rápida",
        desc: "Pause ou reative o atendimento da IA para qualquer contato com um clique no botão de alternância."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Identifique quem não deve receber mensagens da IA",
        description: "Ex: Celulares dos sócios, vendedores, mecânicos, despachantes e parceiros de repasse.",
      },
      {
        step: 2,
        title: "Clique em 'Adicionar Bloqueio'",
        description: "Digite o telefone com DDD (apenas números) e adicione uma identificação (ex: 'Gerente Carlos').",
        tip: "Você também pode pausar diretamente da tela de conversas quando estiver assumindo um atendimento manualmente."
      },
      {
        step: 3,
        title: "Confirme a lista de bloqueios",
        description: "Verifique se o número consta com status 'Ativo' para garantir que a IA não envie respostas para ele."
      }
    ],
    proTips: [
      "Cadastre o número dos proprietários da loja logo no primeiro dia de uso do sistema.",
      "Se um cliente estiver na loja física negociando presencialmente, adicione o número dele temporariamente aos bloqueios para evitar mensagens automáticas enquanto ele conversa com o vendedor."
    ],
    faqs: [
      {
        question: "Bloquear um número aqui impede o cliente de mandar mensagem no WhatsApp?",
        answer: "Não! A mensagem dele continuará chegando normalmente no celular e no WhatsApp Web. O bloqueio serve apenas para a IA NÃO responder automaticamente àquele número."
      },
      {
        question: "Como desbloquear um número para a IA voltar a atender?",
        answer: "Basta localizar o número na tabela e clicar no ícone de lixeira (excluir) ou desativar a chave de status."
      }
    ]
  },
  {
    id: "analise-ia",
    title: "Análise com IA",
    route: "/analise-ia",
    iconName: "Sparkles",
    tagline: "Auditoria inteligente e pontuação da qualidade dos atendimentos da equipe",
    badge: "Qualidade",
    requires: { comIA: true },
    summary: "A Análise com IA atua como um supervisor de vendas 24 horas por dia. Ela analisa as conversas mantidas com os clientes, avalia a cordialidade, técnica de vendas, agilidade e aponta pontos de melhoria para sua equipe vender mais.",
    keyFeatures: [
      {
        title: "Nota Geral de Atendimento (0 a 100)",
        desc: "Índice de qualidade comercial calculado com base nas melhores práticas do mercado automotivo."
      },
      {
        title: "Pontos Fortes & Oportunidades de Melhoria",
        desc: "Relatório detalhado indicando onde a equipe mandou bem (ex: agilidade, empatia) e onde pode melhorar (ex: pedir entrada, convidar para visita)."
      },
      {
        title: "Detecção de Objeções de Clientes",
        desc: "Identifica quais as dúvidas mais comuns dos compradores (taxa de juros alta, valor do carro usado, distância da loja)."
      }
    ],
    stepByStep: [
      {
        step: 1,
        title: "Consulte o Score Médio da Semana",
        description: "Acompanhe se a pontuação dos atendimentos está subindo ou descendo.",
      },
      {
        step: 2,
        title: "Leia os feedbacks específicos de cada conversa",
        description: "Veja quais atendimentos receberam nota máxima e quais perderam pontos por falta de condução para o fechamento.",
        tip: "Use os exemplos práticos das conversas para treinar sua equipe de vendas."
      },
      {
        step: 3,
        title: "Implemente melhorias no roteiro de vendas",
        description: "Ajuste os discursos para contornar com mais segurança as objeções frequentes apontadas pela IA."
      }
    ],
    proTips: [
      "Faça um ranking interno saudável entre os vendedores com base na nota de qualidade do atendimento.",
      "Foque nos leads que não fecharam para entender onde a equipe perdeu a oportunidade."
    ],
    faqs: [
      {
        question: "A IA avalia atendimentos humanos também ou só mensagens dela mesma?",
        answer: "Ela avalia toda a conversa, incluindo as mensagens enviadas pelos vendedores humanos, auditando a qualidade do suporte prestado ao cliente."
      },
      {
        question: "Como a pontuação é calculada?",
        answer: "São avaliados critérios como: tempo de resposta, clareza, empatia, apresentação dos veículos, condução para agendamento de visita e tentativa de fechamento."
      }
    ]
  }
]

/**
 * Filtra a lista de guias de acordo com as permissões e módulos ativos do cliente
 */
export function getGuiaItemsForClient(config: {
  tipoAtendimento?: string
  hasEstoque?: boolean
  hasBancos?: boolean
}): GuiaItem[] {
  const isSemIA = config.tipoAtendimento === 'sem_ia'
  const hasEstoque = Boolean(config.hasEstoque)
  const hasBancos = Boolean(config.hasBancos)

  return GUIA_ITEMS.filter(item => {
    if (item.requires?.comIA && isSemIA) return false
    if (item.requires?.moduloEstoque && !hasEstoque) return false
    if (item.requires?.moduloBancos && !hasBancos) return false
    return true
  })
}

/**
 * Retorna o guia correspondente a uma rota atual
 */
export function getGuiaItemByPathname(pathname: string, availableItems: GuiaItem[]): GuiaItem | null {
  if (!pathname) return null
  // Match exato
  let found = availableItems.find(item => item.route === pathname)
  if (found) return found

  // Match por prefixo (ex: /funil/configurar -> /funil)
  found = availableItems.find(item => item.route !== '/dashboard' && pathname.startsWith(item.route))
  if (found) return found

  // Se estiver na raiz ou dashboard
  if (pathname === '/' || pathname === '/dashboard') {
    return availableItems.find(item => item.id === 'dashboard') || null
  }

  return null
}
