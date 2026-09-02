import {
  Rocket,
  LayoutDashboard,
  Crosshair,
  Radar,
  Users,
  Columns3,
  Bot,
  Megaphone,
  MessagesSquare,
  BookOpen,
  BarChart3,
  CheckSquare,
  Gauge,
  Settings,
  ScrollText,
  LifeBuoy,
} from "lucide-react";
import type { HelpArticle, HelpCategory, GettingStartedStep } from "./types";

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: "comece-aqui",
    label: "Começando no LumiHunter",
    emoji: "🚀",
    icon: Rocket,
    description: "O que é o LumiHunter e os primeiros passos na plataforma.",
  },
  {
    slug: "dashboard",
    label: "Dashboard",
    emoji: "📊",
    icon: LayoutDashboard,
    description: "Como ler os indicadores da sua operação comercial.",
  },
  {
    slug: "produtos-icp",
    label: "Produtos & Cliente ideal (ICP)",
    emoji: "🎯",
    icon: Crosshair,
    description: "O catálogo e o perfil de cliente que guiam o Hunter.",
  },
  {
    slug: "prospeccao",
    label: "Prospecção (Agente Hunter)",
    emoji: "🔎",
    icon: Radar,
    description: "Como encontrar novas empresas com potencial de compra.",
  },
  {
    slug: "leads",
    label: "Leads & Empresas",
    emoji: "👥",
    icon: Users,
    description: "Tudo sobre os leads encontrados e seus dados.",
  },
  {
    slug: "pipeline",
    label: "Pipeline (Kanban)",
    emoji: "📋",
    icon: Columns3,
    description: "Como acompanhar cada lead do primeiro contato até a venda.",
  },
  {
    slug: "ia",
    label: "Agentes de Inteligência Artificial",
    emoji: "🤖",
    icon: Bot,
    description: "Hunter, Qualifier, Copywriter, Sales Coach e Analyst.",
  },
  {
    slug: "campanhas",
    label: "Campanhas",
    emoji: "📢",
    icon: Megaphone,
    description: "Organize abordagens por canal, segmento e cidade.",
  },
  {
    slug: "conversas",
    label: "Conversas & Integrações",
    emoji: "📱",
    icon: MessagesSquare,
    description: "WhatsApp, e-mail e a central de conversas com os leads.",
  },
  {
    slug: "conteudo",
    label: "Templates & Base de conhecimento",
    emoji: "📚",
    icon: BookOpen,
    description: "Modelos de mensagem e o material que os agentes usam.",
  },
  {
    slug: "relatorios",
    label: "Relatórios",
    emoji: "📈",
    icon: BarChart3,
    description: "Números da operação e insights automáticos do Analyst.",
  },
  {
    slug: "tarefas",
    label: "Tarefas",
    emoji: "✅",
    icon: CheckSquare,
    description: "Lembretes com prazo para não perder um follow-up.",
  },
  {
    slug: "planos",
    label: "Planos e uso",
    emoji: "💳",
    icon: Gauge,
    description: "Como funcionam os limites do seu plano.",
  },
  {
    slug: "configuracoes",
    label: "Configurações",
    emoji: "⚙️",
    icon: Settings,
    description: "Dados da empresa, integrações, time e permissões.",
  },
  {
    slug: "auditoria",
    label: "Auditoria",
    emoji: "🧾",
    icon: ScrollText,
    description: "Linha do tempo de tudo o que aconteceu na conta.",
  },
  {
    slug: "problemas",
    label: "Problemas e soluções",
    emoji: "🛠️",
    icon: LifeBuoy,
    description: "Está com dificuldade em algo? Comece por aqui.",
  },
];

export const GETTING_STARTED_STEPS: GettingStartedStep[] = [
  {
    title: "Configure sua empresa",
    text: "Complete os dados cadastrais, canais comerciais e a cor da marca em Configurações.",
    articleSlug: "como-configurar-minha-empresa",
  },
  {
    title: "Cadastre seus produtos ou serviços",
    text: "Quanto mais rico o catálogo, melhor o Agente Hunter reconhece uma boa oportunidade.",
    articleSlug: "como-cadastrar-produtos-e-servicos",
  },
  {
    title: "Defina seu cliente ideal (ICP)",
    text: "Informe segmentos, cidades e palavras-chave das empresas que você quer encontrar.",
    articleSlug: "como-criar-um-perfil-icp",
  },
  {
    title: "Rode o Agente Hunter",
    text: "Em Leads & CRM, rode a busca automática e deixe o Hunter trazer as primeiras empresas.",
    articleSlug: "como-rodar-o-hunter",
  },
  {
    title: "Qualifique os leads",
    text: "Use o Qualifier para calcular o score de cada empresa e entender a prioridade.",
    articleSlug: "o-que-e-o-agente-qualifier-e-o-score",
  },
  {
    title: "Gere a abordagem e faça contato",
    text: "O Copywriter escreve a primeira mensagem; envie por WhatsApp ou e-mail direto do lead.",
    articleSlug: "como-enviar-uma-mensagem-para-um-lead",
  },
  {
    title: "Acompanhe no Pipeline",
    text: "Arraste o card entre as colunas do Kanban conforme a negociação avança.",
    articleSlug: "o-que-e-o-pipeline-kanban",
  },
  {
    title: "Feche e acompanhe o resultado",
    text: "Marque o lead como Cliente ou Perdido e acompanhe o desempenho em Relatórios.",
    articleSlug: "como-funcionam-os-relatorios",
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Começando no LumiHunter ────────────────────────────────────────────
  {
    slug: "o-que-e-o-lumihunter",
    category: "comece-aqui",
    title: "O que é o LumiHunter?",
    description:
      "Uma visão geral da plataforma: o que ela faz e como ajuda a encontrar e converter clientes.",
    keywords: ["lumihunter", "sobre", "o que é", "plataforma", "visão geral"],
    content: [
      {
        type: "p",
        text: "O LumiHunter é uma plataforma de prospecção comercial que usa inteligência artificial para encontrar empresas com potencial de compra, organizar esses contatos como leads e acompanhar cada oportunidade até o fechamento.",
      },
      {
        type: "p",
        text: "Na prática, o sistema combina cinco peças: um catálogo do que você vende, o perfil do seu cliente ideal, um agente de IA que pesquisa e traz empresas (o Hunter), um pipeline no estilo Kanban para acompanhar cada negociação e agentes de IA que ajudam a qualificar leads e escrever abordagens.",
      },
      {
        type: "list",
        items: [
          "Encontrar empresas reais que combinam com o seu negócio",
          "Organizar esses contatos em um CRM simples, com pipeline visual",
          "Qualificar cada lead com um score de 0 a 100",
          "Gerar mensagens de abordagem por WhatsApp, e-mail e outros canais",
          "Acompanhar métricas de leads, respostas e conversões",
        ],
      },
      {
        type: "tip",
        text: "Comece pela seção “Comece aqui”, na página inicial da Central de Ajuda — ela mostra a ordem recomendada dos primeiros passos.",
      },
    ],
    related: ["primeiros-passos", "como-funcionam-os-agentes-de-ia"],
  },
  {
    slug: "primeiros-passos",
    category: "comece-aqui",
    title: "Primeiros passos no LumiHunter",
    description: "O caminho recomendado para sair do zero até a primeira venda.",
    keywords: ["primeiros passos", "começar", "onboarding", "tutorial"],
    content: [
      {
        type: "p",
        text: "Estes são os passos, na ordem em que fazem mais sentido para uma conta nova.",
      },
      {
        type: "steps",
        items: [
          { title: "Configure sua empresa", text: "Em Configurações, preencha nome, segmento, cidade e canais comerciais (WhatsApp, e-mail, site, Instagram)." },
          { title: "Cadastre produtos ou serviços", text: "Em Produtos, registre o que você vende — isso alimenta diretamente o Hunter e o Copywriter." },
          { title: "Defina seu cliente ideal (ICP)", text: "Em Cliente ideal (ICP), informe regiões, segmentos e palavras-chave das empresas que você busca." },
          { title: "Rode o Agente Hunter", text: "Em Leads & CRM, use o painel do Hunter para trazer as primeiras empresas encontradas." },
          { title: "Qualifique e aborde", text: "Abra um lead, rode o Qualifier para calcular o score e gere a primeira mensagem com o Copywriter." },
          { title: "Acompanhe no Pipeline", text: "Mova os cards entre as colunas do Kanban conforme a negociação evolui." },
        ],
      },
      {
        type: "tip",
        text: "Sem produtos cadastrados e sem um ICP ativo, o Agente Hunter fica desabilitado — são os dois pré-requisitos mínimos.",
      },
    ],
    related: [
      "como-configurar-minha-empresa",
      "como-cadastrar-produtos-e-servicos",
      "como-criar-um-perfil-icp",
      "como-rodar-o-hunter",
    ],
  },
  {
    slug: "como-configurar-minha-empresa",
    category: "comece-aqui",
    title: "Como configurar minha empresa",
    description: "Onde preencher os dados cadastrais e a identidade usada pelos agentes de IA.",
    keywords: ["configurações", "empresa", "cadastro", "marca", "cor"],
    content: [
      {
        type: "p",
        text: "Em Configurações → Empresa, você preenche nome, segmento, cidade/UF, canais comerciais (WhatsApp, e-mail, site, Instagram), uma descrição curta do negócio e a cor da marca.",
      },
      {
        type: "p",
        text: "Esses dados são usados pelos agentes de IA para escrever abordagens coerentes com quem você é e para calcular o score de aderência de cada lead.",
      },
      {
        type: "tip",
        text: "Descreva o negócio com uma frase objetiva — ela entra no contexto que a IA usa para qualificar leads e escrever mensagens.",
      },
    ],
    related: ["visao-geral-das-configuracoes", "como-cadastrar-produtos-e-servicos"],
  },
  {
    slug: "como-convidar-meu-time",
    category: "comece-aqui",
    title: "Como convidar meu time para o LumiHunter",
    description: "Adicione colegas com o papel adequado para cada função.",
    keywords: ["convite", "time", "equipe", "usuários", "membros", "papéis"],
    content: [
      {
        type: "p",
        text: "Em Configurações → Equipe & plano, administradores e o proprietário podem convidar novos membros por e-mail, escolhendo o papel: Admin, Vendas, Marketing, Financeiro ou Leitura.",
      },
      {
        type: "p",
        text: "O convidado recebe um e-mail com um link de acesso e, ao aceitar, passa a fazer parte da empresa com as permissões do papel escolhido.",
      },
      {
        type: "warning",
        text: "O número de pessoas na conta é limitado pelo seu plano (campo “seats”). Se o convite falhar, o limite de usuários pode ter sido atingido.",
      },
    ],
    related: ["papeis-e-permissoes", "como-funcionam-os-planos"],
  },

  // ── Dashboard ───────────────────────────────────────────────────────────
  {
    slug: "o-que-e-o-dashboard",
    category: "dashboard",
    title: "O que é o Dashboard?",
    description: "A visão executiva da sua operação comercial em um só lugar.",
    keywords: ["dashboard", "painel", "indicadores", "visão geral"],
    content: [
      {
        type: "p",
        text: "O Dashboard (menu “Dashboard”, rota /app) é a primeira tela ao entrar no LumiHunter. Ele reúne, em cards, os principais números da sua empresa: leads encontrados, qualificados, mensagens enviadas, respostas, interessados, orçamentos e vendas.",
      },
      {
        type: "p",
        text: "Abaixo dos cards você encontra o funil de vendas (quantos leads existem em cada etapa do pipeline), a receita estimada dos negócios ganhos, as principais cidades com leads e o uso atual do seu plano.",
      },
    ],
    related: ["como-interpretar-os-indicadores", "como-acompanhar-o-uso-do-plano"],
  },
  {
    slug: "como-interpretar-os-indicadores",
    category: "dashboard",
    title: "Como interpretar os indicadores do Dashboard",
    description: "O que cada número do painel principal significa.",
    keywords: ["indicadores", "métricas", "leads encontrados", "qualificados", "conversão"],
    content: [
      {
        type: "list",
        items: [
          "Leads encontrados — total de empresas trazidas pelo Hunter ou cadastradas manualmente.",
          "Qualificados — leads que já passaram pelo Qualifier e receberam um score.",
          "WhatsApp enviados / E-mails enviados — mensagens de abordagem disparadas pela plataforma.",
          "Respostas — quantos leads responderam a algum contato.",
          "Interessados — leads marcados como interessados pela análise do Sales Coach ou manualmente.",
          "Orçamentos — negociações em que uma proposta foi enviada.",
          "Vendas — leads que chegaram à etapa “Cliente” do pipeline.",
        ],
      },
      {
        type: "p",
        text: "O funil de vendas mostra visualmente quantos leads estão em cada etapa do Pipeline. A “Receita estimada” usa o preço médio dos produtos recomendados nos leads ganhos — ajuste os preços em Produtos para deixá-la mais precisa.",
      },
    ],
    related: ["o-que-e-o-pipeline-kanban", "como-funcionam-os-relatorios"],
  },
  {
    slug: "como-acompanhar-o-uso-do-plano",
    category: "dashboard",
    title: "Como acompanhar o uso do meu plano",
    description: "Onde ver quanto já foi consumido das cotas mensais.",
    keywords: ["uso do plano", "cota", "limite", "ia", "mensagens"],
    content: [
      {
        type: "p",
        text: "No fim do Dashboard há o bloco “Uso do plano”, com três barras: Leads (total acumulado), IA (execuções de agentes no mês) e Mensagens (envios no mês). Quando um limite é ilimitado, aparece a etiqueta “ilimitado”.",
      },
      {
        type: "p",
        text: "A barra fica vermelha quando o uso passa de 90% do limite — é o sinal para arquivar leads antigos, aguardar a virada do mês ou considerar um upgrade de plano.",
      },
    ],
    related: ["como-funcionam-os-planos", "o-que-acontece-quando-a-cota-acaba"],
  },

  // ── Produtos & ICP ──────────────────────────────────────────────────────
  {
    slug: "como-cadastrar-produtos-e-servicos",
    category: "produtos-icp",
    title: "Como cadastrar produtos e serviços",
    description: "O catálogo que o Hunter e o Copywriter usam para reconhecer boas oportunidades.",
    keywords: ["produtos", "serviços", "catálogo", "preço", "palavras-chave"],
    content: [
      {
        type: "p",
        text: "Em Produtos & Serviços, cadastre cada item que você vende: nome, tipo (produto ou serviço), descrição, preço inicial e médio, quantidade mínima, prazo, palavras-chave, aplicações, cidades atendidas, exemplos de compradores e o público ideal.",
      },
      {
        type: "p",
        text: "Esse catálogo é a base que o Agente Hunter usa para saber o que procurar e que o Copywriter usa para recomendar o produto certo em cada abordagem.",
      },
      {
        type: "tip",
        text: "Quanto mais completo o catálogo — principalmente palavras-chave e exemplos de compradores — melhor tende a ser a qualidade dos leads encontrados.",
      },
      {
        type: "p",
        text: "Também é possível importar ou exportar produtos em massa via CSV, usando os botões no topo da página.",
      },
    ],
    related: ["o-que-e-o-agente-hunter", "como-criar-um-perfil-icp"],
  },
  {
    slug: "o-que-e-o-perfil-de-cliente-ideal-icp",
    category: "produtos-icp",
    title: "O que é o Perfil de Cliente Ideal (ICP)?",
    description: "Como o LumiHunter sabe quem procurar.",
    keywords: ["icp", "cliente ideal", "perfil", "segmento", "público"],
    content: [
      {
        type: "p",
        text: "O ICP (Ideal Customer Profile, ou Perfil de Cliente Ideal) descreve o tipo de empresa que mais tende a comprar de você: estados, cidades, segmentos, portes e palavras-chave.",
      },
      {
        type: "p",
        text: "Você pode ter mais de um ICP ativo — por exemplo, um por região ou por linha de produto. O Agente Hunter usa esses perfis para montar as buscas.",
      },
      {
        type: "warning",
        text: "Sem pelo menos um ICP ativo, o botão de rodar o Hunter fica desabilitado na página de Leads & CRM.",
      },
    ],
    related: ["como-criar-um-perfil-icp", "o-que-e-o-agente-hunter"],
  },
  {
    slug: "como-criar-um-perfil-icp",
    category: "produtos-icp",
    title: "Como criar um Perfil de Cliente Ideal (ICP)",
    description: "Passo a passo para cadastrar o perfil que o Hunter vai usar nas buscas.",
    keywords: ["criar icp", "novo icp", "cadastrar perfil"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Acesse Cliente ideal (ICP)", text: "No menu lateral, clique em “Cliente ideal (ICP)”." },
          { title: "Dê um nome ao perfil", text: "Por exemplo: “Academias na Grande São Paulo”." },
          { title: "Descreva o perfil (opcional)", text: "Um resumo curto de quem é esse cliente." },
          { title: "Informe estados e cidades", text: "Separe múltiplos valores por vírgula." },
          { title: "Informe segmentos e portes", text: "Ex.: “academia, estúdio de pilates” e “pequeno, médio”." },
          { title: "Adicione palavras-chave", text: "Termos que ajudam a IA a reconhecer o segmento certo." },
          { title: "Salve", text: "Clique em Adicionar — o perfil já fica disponível para o Hunter." },
        ],
      },
      {
        type: "tip",
        text: "Também é possível usar o assistente de ICP na própria página, que ajuda a sugerir um perfil com base na sua empresa e no seu catálogo.",
      },
    ],
    related: ["o-que-e-o-perfil-de-cliente-ideal-icp", "como-rodar-o-hunter"],
  },

  // ── Prospecção (Hunter) ─────────────────────────────────────────────────
  {
    slug: "o-que-e-o-agente-hunter",
    category: "prospeccao",
    title: "O que é o Agente Hunter?",
    description: "O agente de IA que faz a prospecção — encontra empresas reais para você.",
    keywords: ["hunter", "prospecção", "buscar empresas", "agente de ia"],
    content: [
      {
        type: "p",
        text: "O Hunter é o agente de IA responsável por encontrar novas empresas com potencial de compra. Ele recebe o seu ICP e o seu catálogo de produtos, monta buscas por segmento e cidade, lê os resultados públicos disponíveis e extrai empresas reais que combinam com o seu negócio.",
      },
      {
        type: "p",
        text: "O Hunter não inventa contatos: campos sem uma fonte confiável ficam em branco. Ele também tenta evitar duplicidade, comparando pelo nome da empresa antes de criar um novo lead.",
      },
      {
        type: "tip",
        text: "Você pode refinar a busca com um texto livre, por exemplo “academias em Osasco”, para direcionar o Hunter a um recorte mais específico dentro do seu ICP.",
      },
    ],
    related: ["como-rodar-o-hunter", "o-que-e-o-perfil-de-cliente-ideal-icp"],
  },
  {
    slug: "como-rodar-o-hunter",
    category: "prospeccao",
    title: "Como rodar uma busca com o Agente Hunter",
    description: "Passo a passo para trazer novas empresas para o seu pipeline.",
    keywords: ["rodar hunter", "nova busca", "buscar leads", "prospecção"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Acesse Leads & CRM", text: "No menu lateral, clique em “Leads & CRM”." },
          { title: "Confira o painel do Agente Hunter", text: "Ele fica no topo da página, acima do Kanban." },
          { title: "Refine a busca (opcional)", text: "Descreva em texto livre um recorte específico dentro do seu ICP." },
          { title: "Clique em Rodar", text: "O Hunter pesquisa e retorna quantas empresas encontrou e quantos leads novos foram adicionados." },
          { title: "Revise os resultados", text: "Os novos leads aparecem na coluna “Novo Lead” do Kanban, prontos para qualificação." },
        ],
      },
      {
        type: "tip",
        text: "Rode o Hunter sempre que quiser mais leads — não há um limite fixo de execuções por busca, apenas a cota mensal de execuções de IA do seu plano.",
      },
      {
        type: "warning",
        text: "É preciso ter pelo menos um produto cadastrado e um ICP ativo para o botão “Rodar” ficar habilitado.",
      },
    ],
    related: ["o-que-fazer-quando-o-hunter-nao-encontra-bons-resultados", "o-que-e-um-lead"],
  },
  {
    slug: "o-que-fazer-quando-o-hunter-nao-encontra-bons-resultados",
    category: "prospeccao",
    title: "O que fazer quando o Hunter não encontra bons resultados",
    description: "Ajustes que costumam melhorar a qualidade da busca.",
    keywords: ["hunter não encontrou", "poucos resultados", "melhorar busca", "resultados ruins"],
    content: [
      {
        type: "list",
        items: [
          "Revise o ICP — segmentos, cidades e palavras-chave muito genéricos trazem resultados menos aderentes.",
          "Enriqueça o catálogo de produtos, principalmente palavras-chave e exemplos de compradores.",
          "Use o campo de refinamento com um recorte mais específico (ex.: cidade + segmento).",
          "Tente cidades ou regiões vizinhas se a área escolhida tiver poucas empresas públicas disponíveis.",
          "Rode o Hunter novamente em outro momento — os resultados de busca variam conforme o que está disponível publicamente.",
        ],
      },
      {
        type: "warning",
        text: "O Hunter só traz empresas com informações verificáveis publicamente. Se a região ou o segmento tiverem pouca presença online, o número de leads encontrados tende a ser menor.",
      },
    ],
    related: ["como-rodar-o-hunter", "como-criar-um-perfil-icp"],
  },

  // ── Leads & Empresas ────────────────────────────────────────────────────
  {
    slug: "o-que-e-um-lead",
    category: "leads",
    title: "O que é um lead?",
    description: "O conceito central do CRM do LumiHunter.",
    keywords: ["lead", "o que é lead", "empresa", "oportunidade"],
    content: [
      {
        type: "p",
        text: "Um lead é uma empresa que pode representar uma oportunidade comercial para o seu negócio. Ele nasce de duas formas: encontrado automaticamente pelo Agente Hunter ou cadastrado manualmente (inclusive via importação de CSV).",
      },
      {
        type: "p",
        text: "Cada lead guarda o nome da empresa, segmento, localização, dados de contato disponíveis, um score de IA, a etapa atual no pipeline, tags, notas, tarefas e o histórico de tudo o que já aconteceu com ele.",
      },
    ],
    related: ["como-visualizar-e-editar-um-lead", "informacoes-de-contato-do-lead"],
  },
  {
    slug: "como-visualizar-e-editar-um-lead",
    category: "leads",
    title: "Como visualizar e usar a página de um lead",
    description: "O que você encontra ao abrir um lead e o que pode fazer ali.",
    keywords: ["página do lead", "detalhe do lead", "abrir lead"],
    content: [
      {
        type: "p",
        text: "Clicando em um card do Kanban ou em uma linha da tabela de Empresas, você abre a página do lead, com: resumo gerado pela IA (quando existir), os botões dos Agentes de IA (Qualificar, gerar abordagem), o histórico de atividades, um campo para notas internas, tags, tarefas vinculadas, os dados de contato e a descrição da empresa.",
      },
      {
        type: "p",
        text: "No topo da página é possível ver e alterar a etapa do lead no pipeline através do seletor de estágio, ao lado do badge de score.",
      },
    ],
    related: ["informacoes-de-contato-do-lead", "como-mover-um-lead-no-kanban"],
  },
  {
    slug: "informacoes-de-contato-do-lead",
    category: "leads",
    title: "Informações de contato de um lead",
    description: "Telefone/WhatsApp, e-mail, site e Instagram — de onde vêm e como são usados.",
    keywords: ["telefone", "whatsapp", "email", "site", "instagram", "contato"],
    content: [
      {
        type: "list",
        items: [
          "Telefone / WhatsApp — usado para abrir conversa direta pelo WhatsApp e para o envio de mensagens pela integração.",
          "E-mail — usado para envio de mensagens via integração de e-mail.",
          "Site — link para o site institucional da empresa, quando encontrado.",
          "Instagram — link para o perfil da empresa, quando encontrado.",
        ],
      },
      {
        type: "p",
        text: "Esses dados vêm de fontes públicas encontradas pelo Hunter ou de um cadastro manual/importação. Quando uma informação não é encontrada com confiança, o campo simplesmente fica vazio — o LumiHunter não inventa contatos.",
      },
    ],
    related: ["como-conectar-o-whatsapp", "como-enviar-uma-mensagem-para-um-lead"],
  },
  {
    slug: "como-usar-a-pagina-empresas",
    category: "leads",
    title: "Como usar a página Empresas",
    description: "A base completa de todas as empresas encontradas, em formato de tabela.",
    keywords: ["empresas", "tabela de leads", "buscar empresa", "csv"],
    content: [
      {
        type: "p",
        text: "A página Empresas mostra, em tabela, todos os leads da sua conta — nome, segmento, cidade, contato, origem e score — com busca por nome e ordenação pelas empresas descobertas mais recentemente.",
      },
      {
        type: "p",
        text: "No topo há botões para importar leads de um arquivo CSV (colunas como nome, CNPJ, segmento, cidade, UF, telefone e e-mail) e para exportar a base atual.",
      },
    ],
    related: ["como-importar-e-exportar-leads-via-csv", "como-evitar-leads-duplicados"],
  },
  {
    slug: "como-importar-e-exportar-leads-via-csv",
    category: "leads",
    title: "Como importar e exportar leads via CSV",
    description: "Traga sua base existente ou tire uma cópia dos seus dados.",
    keywords: ["importar csv", "exportar csv", "planilha", "leads em massa"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Acesse Empresas", text: "No menu lateral, clique em Empresas." },
          { title: "Para importar", text: "Clique em “Importar CSV” e siga o modelo de colunas indicado (nome, CNPJ, segmento, cidade, UF, telefone, e-mail…)." },
          { title: "Para exportar", text: "Clique em “Exportar CSV” para baixar a base atual de empresas." },
        ],
      },
      {
        type: "tip",
        text: "O mesmo recurso de importação/exportação existe na página de Produtos, para o catálogo.",
      },
    ],
    related: ["como-usar-a-pagina-empresas", "como-cadastrar-produtos-e-servicos"],
  },
  {
    slug: "como-evitar-leads-duplicados",
    category: "leads",
    title: "Como evitar leads duplicados",
    description: "O que o sistema já faz e o que você pode conferir manualmente.",
    keywords: ["lead duplicado", "duplicidade", "empresa repetida"],
    content: [
      {
        type: "p",
        text: "O Agente Hunter compara o nome da empresa antes de criar um novo lead, para reduzir duplicidade nas buscas automáticas. Ainda assim, empresas com nomes muito diferentes (razão social x nome fantasia, por exemplo) podem gerar registros separados.",
      },
      {
        type: "p",
        text: "Ao importar uma planilha própria, revise antes se algumas dessas empresas já existem na base, usando a busca por nome em Empresas.",
      },
    ],
    related: ["encontrei-um-lead-duplicado", "como-arquivar-um-lead"],
  },
  {
    slug: "como-arquivar-um-lead",
    category: "leads",
    title: "Como arquivar um lead",
    description: "Tire da lista ativa um lead que não faz mais sentido acompanhar.",
    keywords: ["arquivar lead", "remover lead", "ocultar lead"],
    content: [
      {
        type: "p",
        text: "Leads arquivados deixam de aparecer no Kanban e na contagem de leads ativos usada nos limites do plano, mas seu histórico continua preservado.",
      },
      {
        type: "tip",
        text: "Arquivar leads antigos ou que não vão avançar é uma boa forma de liberar espaço quando o limite de leads do plano estiver próximo do teto.",
      },
    ],
    related: ["o-que-acontece-quando-a-cota-acaba", "como-funcionam-os-planos"],
  },

  // ── Pipeline ────────────────────────────────────────────────────────────
  {
    slug: "o-que-e-o-pipeline-kanban",
    category: "pipeline",
    title: "O que é o Pipeline (Kanban)?",
    description: "Como acompanhar visualmente o avanço de cada negociação.",
    keywords: ["pipeline", "kanban", "funil", "crm", "negociação"],
    content: [
      {
        type: "p",
        text: "O Pipeline é o quadro Kanban dentro de Leads & CRM. Cada coluna representa uma etapa da negociação e cada cartão representa um lead, mostrando nome, segmento, cidade e o score de IA quando disponível.",
      },
      {
        type: "p",
        text: "Ele é a visão principal de acompanhamento comercial: em vez de olhar leads um a um, você enxerga de uma vez quantas oportunidades existem em cada fase.",
      },
    ],
    related: ["estagios-do-pipeline", "como-mover-um-lead-no-kanban"],
  },
  {
    slug: "estagios-do-pipeline",
    category: "pipeline",
    title: "Quais são os estágios do Pipeline",
    description: "As colunas padrão do Kanban e o que cada uma significa.",
    keywords: ["estágios", "colunas do kanban", "etapas", "negociação", "cliente", "perdido"],
    content: [
      {
        type: "list",
        items: [
          "Novo Lead — acabou de ser encontrado ou cadastrado, ainda sem qualificação.",
          "Qualificado — já recebeu um score do Qualifier (leads com score alto tendem a subir para cá automaticamente).",
          "Contato iniciado — já houve uma primeira abordagem.",
          "Respondeu — a empresa respondeu ao contato.",
          "Interessado — sinalizou interesse na conversa.",
          "Orçamento enviado — uma proposta comercial foi enviada.",
          "Negociação — em tratativa final.",
          "Cliente — negociação ganha (etapa de vitória).",
          "Perdido — negociação encerrada sem venda (etapa de perda).",
        ],
      },
      {
        type: "tip",
        text: "As cores das colunas e o nome de cada estágio podem variar de uma conta para outra — a lista acima corresponde à configuração padrão criada para uma empresa nova.",
      },
    ],
    related: ["como-mover-um-lead-no-kanban", "o-que-e-o-agente-qualifier-e-o-score"],
  },
  {
    slug: "como-mover-um-lead-no-kanban",
    category: "pipeline",
    title: "Como mover um lead entre as etapas do Kanban",
    description: "Arraste e solte — ou use o seletor de estágio na página do lead.",
    keywords: ["mover lead", "arrastar", "mudar etapa", "estágio"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Abra Leads & CRM", text: "O Kanban aparece logo abaixo do painel do Agente Hunter." },
          { title: "Arraste o cartão", text: "Clique e segure o cartão do lead e solte na coluna desejada." },
          { title: "Ou use o seletor de estágio", text: "Dentro da página do lead, o campo de estágio no topo faz a mesma mudança." },
        ],
      },
      {
        type: "tip",
        text: "Toda mudança de etapa fica registrada no histórico do lead e na Auditoria da conta.",
      },
    ],
    related: ["o-que-e-o-pipeline-kanban", "o-que-e-a-auditoria"],
  },

  // ── Agentes de IA ───────────────────────────────────────────────────────
  {
    slug: "como-funcionam-os-agentes-de-ia",
    category: "ia",
    title: "Como funcionam os agentes de IA do LumiHunter?",
    description: "Visão geral do Hunter, Qualifier, Copywriter, Sales Coach e Analyst.",
    keywords: ["agentes de ia", "inteligência artificial", "claude", "hunter", "qualifier", "copywriter"],
    content: [
      {
        type: "p",
        text: "O LumiHunter usa modelos de linguagem da Anthropic (a família Claude) para automatizar partes do trabalho de prospecção. Cada agente tem uma responsabilidade específica:",
      },
      {
        type: "list",
        items: [
          "Hunter — encontra empresas reais a partir do seu ICP e catálogo.",
          "Qualifier — avalia um lead contra o ICP e o catálogo e calcula o score.",
          "Copywriter — escreve a mesma abordagem adaptada a cada canal (WhatsApp, e-mail, Instagram, roteiro de ligação).",
          "Sales Coach — lê uma conversa com um lead e sugere respostas e o próximo passo.",
          "Analyst — olha as métricas agregadas e devolve insights priorizados sobre a operação.",
        ],
      },
      {
        type: "p",
        text: "Em Agentes de IA você pode ver, para cada um, se está ativo, o modelo usado, a temperatura e um system prompt customizado, além do custo estimado das últimas execuções.",
      },
      {
        type: "warning",
        text: "Todas as saídas de IA são recomendações baseadas em dados disponíveis — não são garantias. Use o bom senso comercial para decidir a abordagem final.",
      },
    ],
    related: [
      "o-que-e-o-agente-qualifier-e-o-score",
      "o-que-e-o-agente-copywriter",
      "limitacoes-da-inteligencia-artificial",
      "como-configurar-os-agentes-de-ia",
    ],
  },
  {
    slug: "o-que-e-o-agente-qualifier-e-o-score",
    category: "ia",
    title: "O que é o Agente Qualifier e o Score do lead?",
    description: "Como a plataforma decide o quão promissor é um lead.",
    keywords: ["qualifier", "score", "qualificação", "nota do lead"],
    content: [
      {
        type: "p",
        text: "O Qualifier avalia um lead contra o seu ICP e o seu catálogo de produtos e retorna um score de 0 a 100, os fatores que pesaram nessa nota, um resumo da oportunidade e os produtos mais aderentes ao caso.",
      },
      {
        type: "p",
        text: "Você roda o Qualifier clicando em “Qualificar (score)” na página do lead. O resultado aparece como um resumo da IA e o score passa a ser exibido em badges no Kanban, na tabela de Empresas e no topo da página do lead.",
      },
      {
        type: "tip",
        text: "Leads com score mais alto tendem a subir automaticamente para a etapa “Qualificado” do pipeline.",
      },
    ],
    related: ["como-interpretar-o-score-do-lead", "o-score-parece-incorreto"],
  },
  {
    slug: "como-interpretar-o-score-do-lead",
    category: "ia",
    title: "Como interpretar o Score do lead",
    description: "O que as faixas de cor do badge de score significam na prática.",
    keywords: ["interpretar score", "faixa de score", "prioridade", "alta oportunidade"],
    content: [
      {
        type: "list",
        items: [
          "Verde (score alto, a partir de ~70) — forte aderência ao seu ICP e catálogo; boa prioridade de contato.",
          "Amarelo (score médio, aproximadamente entre 40 e 69) — aderência parcial; vale avaliar caso a caso.",
          "Cinza (score baixo, abaixo de ~40) — baixa aderência aparente; menor prioridade, mas ainda pode valer contato conforme seu critério.",
        ],
      },
      {
        type: "p",
        text: "Além da nota, o resumo da IA e o “motivo do score” (visíveis na página do lead) explicam por que aquele número foi atribuído — vale ler antes de descartar um lead com nota baixa.",
      },
      {
        type: "warning",
        text: "O score é uma estimativa de aderência baseada nas informações disponíveis sobre a empresa, não uma garantia de que ela vai comprar.",
      },
    ],
    related: ["o-que-e-o-agente-qualifier-e-o-score", "como-priorizar-leads"],
  },
  {
    slug: "como-priorizar-leads",
    category: "ia",
    title: "Como priorizar quais leads abordar primeiro",
    description: "Usando o score e o pipeline juntos para decidir por onde começar.",
    keywords: ["priorizar", "leads prioritários", "qual lead abordar"],
    content: [
      {
        type: "p",
        text: "Uma boa rotina é: qualificar os leads novos, ordenar mentalmente pelo score (a tabela de Empresas e o Kanban já mostram os badges de score) e abordar primeiro os de score mais alto dentro de cada segmento ou cidade que for prioridade no momento.",
      },
      {
        type: "p",
        text: "Use tags e o campo de notas na página do lead para sinalizar prioridades específicas do seu time, e as Tarefas para não esquecer o follow-up dos leads mais quentes.",
      },
    ],
    related: ["como-interpretar-o-score-do-lead", "como-usar-tarefas"],
  },
  {
    slug: "o-que-e-o-agente-copywriter",
    category: "ia",
    title: "O que é o Agente Copywriter?",
    description: "Como o LumiHunter gera as mensagens de abordagem.",
    keywords: ["copywriter", "gerar mensagem", "abordagem", "primeira mensagem", "follow-up"],
    content: [
      {
        type: "p",
        text: "O Copywriter gera a mesma abordagem adaptada a cada canal: uma mensagem curta para WhatsApp, um e-mail com assunto e corpo, uma versão para Instagram DM e um roteiro de ligação — sempre usando o nome, cidade, segmento e sinais públicos do lead, junto com um produto específico do seu catálogo.",
      },
      {
        type: "p",
        text: "Na página do lead, os botões “Gerar 1ª abordagem” e “Gerar follow-up” chamam o Copywriter. O texto gerado pode ser editado livremente antes de enviar.",
      },
    ],
    related: ["como-enviar-uma-mensagem-para-um-lead", "o-que-sao-templates-de-mensagem"],
  },
  {
    slug: "o-que-e-o-agente-sales-coach",
    category: "ia",
    title: "O que é o Agente Sales Coach?",
    description: "Sugestões de resposta dentro das conversas com um lead.",
    keywords: ["sales coach", "sugestão de resposta", "classificação da conversa", "conversas"],
    content: [
      {
        type: "p",
        text: "Dentro de uma conversa (WhatsApp ou e-mail), o botão “Sugerir resposta (IA)” aciona o Sales Coach: ele lê o histórico da conversa e devolve uma classificação (interessado, agora não, sem interesse, pergunta, objeção, reclamação ou outro), um resumo, o próximo passo recomendado e sugestões de resposta prontas para usar.",
      },
      {
        type: "p",
        text: "Você pode clicar em “Usar resposta” para preencher o campo de mensagem com a sugestão e editá-la antes de enviar.",
      },
    ],
    related: ["o-que-e-a-central-de-conversas", "como-enviar-uma-mensagem-para-um-lead"],
  },
  {
    slug: "o-que-e-o-agente-analyst",
    category: "ia",
    title: "O que é o Agente Analyst?",
    description: "Insights automáticos sobre o desempenho da sua prospecção.",
    keywords: ["analyst", "insights", "relatórios", "análise de desempenho"],
    content: [
      {
        type: "p",
        text: "O Analyst recebe as métricas agregadas da sua conta — leads, respostas e conversões por segmento e cidade — e devolve de 3 a 6 insights priorizados, cada um com um título, uma observação baseada nos números e uma recomendação prática.",
      },
      {
        type: "p",
        text: "Ele aparece na página Relatórios, como um painel dedicado abaixo da tabela de desempenho por segmento.",
      },
    ],
    related: ["como-funcionam-os-relatorios", "o-que-e-o-insight-do-analyst"],
  },
  {
    slug: "limitacoes-da-inteligencia-artificial",
    category: "ia",
    title: "Limitações da inteligência artificial no LumiHunter",
    description: "O que a IA faz bem e onde o julgamento humano continua sendo necessário.",
    keywords: ["limitações da ia", "ia não garante venda", "confiabilidade da ia"],
    content: [
      {
        type: "p",
        text: "Os agentes de IA do LumiHunter trabalham com informações públicas disponíveis no momento da consulta e com os dados que você cadastrou (produtos, ICP, base de conhecimento). Isso significa que:",
      },
      {
        type: "list",
        items: [
          "O score e as recomendações são estimativas de aderência, não garantias de venda.",
          "Campos de contato sem uma fonte confiável ficam vazios — a IA não inventa dados.",
          "A qualidade dos resultados do Hunter e do Qualifier depende diretamente da qualidade do seu ICP e do seu catálogo.",
          "Mensagens geradas pelo Copywriter e pelo Sales Coach devem ser revisadas antes do envio, especialmente em conversas sensíveis.",
        ],
      },
      {
        type: "warning",
        text: "Sempre revise o que a IA gera antes de agir sobre decisões comerciais importantes.",
      },
    ],
    related: ["como-interpretar-o-score-do-lead", "o-score-parece-incorreto"],
  },
  {
    slug: "como-configurar-os-agentes-de-ia",
    category: "ia",
    title: "Como configurar os agentes de IA",
    description: "Modelo, temperatura, prompt e ativação de cada agente.",
    keywords: ["configurar agente", "modelo", "temperatura", "system prompt", "ativar agente"],
    content: [
      {
        type: "p",
        text: "Em Agentes de IA, cada card representa um agente (Hunter, Qualifier, Copywriter, Sales Coach, Analyst) e permite ajustar:",
      },
      {
        type: "list",
        items: [
          "Modelo — claude-sonnet-5 (padrão), claude-opus-5 (máxima qualidade) ou claude-haiku-4-5 (mais rápido e econômico, indicado para volume).",
          "Temperatura — controla a criatividade das respostas, de 0 a 1.",
          "System prompt customizado — deixe em branco para usar o padrão do agente.",
          "Ativo/inativo — desligar um agente impede novas execuções dele.",
        ],
      },
      {
        type: "tip",
        text: "Apenas Admins e o Proprietário podem alterar essas configurações.",
      },
      {
        type: "warning",
        text: "Sem uma chave de API da Anthropic configurada no ambiente, o sistema entra em modo demonstração: os agentes retornam respostas simuladas, sem custo, até a chave ser configurada.",
      },
    ],
    related: ["modo-demo-da-ia", "papeis-e-permissoes"],
  },
  {
    slug: "modo-demo-da-ia",
    category: "ia",
    title: "O que é o modo demo da IA?",
    description: "Quando e por que a plataforma simula as respostas dos agentes.",
    keywords: ["modo demo", "simulação", "sem chave de api", "demonstração"],
    content: [
      {
        type: "p",
        text: "Quando não há uma chave de API da Anthropic configurada no ambiente, o LumiHunter entra automaticamente em modo demo: os agentes de IA retornam respostas simuladas, com custo zero, para que a plataforma continue navegável e testável.",
      },
      {
        type: "p",
        text: "Um aviso amarelo aparece no topo da página Agentes de IA sempre que o modo demo está ativo. Configurar a variável ANTHROPIC_API_KEY nas variáveis de ambiente habilita as respostas reais.",
      },
    ],
    related: ["como-configurar-os-agentes-de-ia"],
  },

  // ── Campanhas ───────────────────────────────────────────────────────────
  {
    slug: "o-que-sao-campanhas",
    category: "campanhas",
    title: "O que são campanhas?",
    description: "Como organizar abordagens por canal, segmento e cidade.",
    keywords: ["campanha", "o que é campanha", "prospecção organizada"],
    content: [
      {
        type: "p",
        text: "Uma campanha organiza um conjunto de abordagens por canal (WhatsApp ou e-mail), segmento, cidade e uma meta de quantidade de leads. Ela ajuda a dar contexto e acompanhamento a um esforço específico de prospecção, em vez de trabalhar lead a lead sem um objetivo declarado.",
      },
      {
        type: "p",
        text: "Cada campanha tem um status: em rascunho, ativa ou pausada.",
      },
    ],
    related: ["como-criar-uma-campanha", "como-ativar-pausar-uma-campanha"],
  },
  {
    slug: "como-criar-uma-campanha",
    category: "campanhas",
    title: "Como criar uma campanha",
    description: "Passo a passo para organizar uma nova frente de prospecção.",
    keywords: ["criar campanha", "nova campanha"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Acesse Campanhas", text: "No menu lateral, clique em Prospecção & Campanhas." },
          { title: "Preencha o formulário “Nova campanha”", text: "Nome, objetivo, canal (WhatsApp ou e-mail), segmento, cidade e meta de leads." },
          { title: "Clique em Criar", text: "A campanha aparece na lista, inicialmente sem estar ativa." },
          { title: "Ative quando estiver pronta", text: "Use o botão Ativar no card da campanha." },
        ],
      },
    ],
    related: ["o-que-sao-campanhas", "como-ativar-pausar-uma-campanha"],
  },
  {
    slug: "como-ativar-pausar-uma-campanha",
    category: "campanhas",
    title: "Como ativar ou pausar uma campanha",
    description: "Controle o andamento de uma campanha a qualquer momento.",
    keywords: ["ativar campanha", "pausar campanha", "status da campanha"],
    content: [
      {
        type: "p",
        text: "Em Campanhas, cada card mostra o status atual (rascunho, ativa ou pausada) e um botão para mudar o estado: Ativar quando não estiver ativa, ou Pausar quando estiver em andamento.",
      },
      {
        type: "tip",
        text: "Segundo os manuais internos da plataforma, o follow-up automático de uma campanha para de ser disparado assim que o lead responde — o que evita insistir com quem já está em conversa.",
      },
    ],
    related: ["o-que-sao-campanhas"],
  },

  // ── Conversas & integrações ─────────────────────────────────────────────
  {
    slug: "o-que-e-a-central-de-conversas",
    category: "conversas",
    title: "O que é a Central de Conversas?",
    description: "O lugar único para acompanhar WhatsApp e e-mail com os leads.",
    keywords: ["conversas", "inbox", "mensagens", "central de conversas"],
    content: [
      {
        type: "p",
        text: "Em Conversas você encontra todas as trocas de mensagem com os leads, de WhatsApp e e-mail, em uma lista única — com o nome do lead, o canal, um indicador de mensagens não lidas e a prévia da última mensagem.",
      },
      {
        type: "p",
        text: "Ao abrir uma conversa, você vê o histórico completo, pode escrever e enviar uma resposta, e pedir ao Sales Coach uma sugestão de resposta baseada no contexto da troca.",
      },
    ],
    related: ["o-que-e-o-agente-sales-coach", "como-enviar-uma-mensagem-para-um-lead"],
  },
  {
    slug: "como-conectar-o-whatsapp",
    category: "conversas",
    title: "Como conectar o WhatsApp",
    description: "Configurando a integração com a WhatsApp Cloud API.",
    keywords: ["conectar whatsapp", "whatsapp cloud api", "integração whatsapp"],
    content: [
      {
        type: "p",
        text: "O LumiHunter integra com a WhatsApp Cloud API (Meta). Em Configurações → WhatsApp Cloud API, um administrador informa o Phone Number ID, o Business Account ID e o Access Token (permanente) da sua conta do WhatsApp Business.",
      },
      {
        type: "p",
        text: "A página também mostra a URL de webhook e o verify token que precisam ser cadastrados no painel da Meta para que as mensagens recebidas cheguem ao LumiHunter.",
      },
      {
        type: "warning",
        text: "Enquanto a integração não estiver conectada, os envios de WhatsApp são simulados: a mensagem é registrada no sistema, mas não é enviada de verdade ao destinatário.",
      },
    ],
    related: ["o-whatsapp-nao-esta-conectado", "como-enviar-uma-mensagem-para-um-lead"],
  },
  {
    slug: "como-conectar-o-email-resend",
    category: "conversas",
    title: "Como conectar o envio de e-mail (Resend)",
    description: "Configurando a integração de e-mail transacional.",
    keywords: ["conectar email", "resend", "integração de email", "smtp"],
    content: [
      {
        type: "p",
        text: "O envio de e-mails do LumiHunter usa a Resend. Em Configurações → Resend, um administrador informa a API Key, o e-mail remetente e o domínio verificado.",
      },
      {
        type: "warning",
        text: "Sem essa integração conectada, os e-mails também são simulados — registrados, mas não enviados de fato.",
      },
    ],
    related: ["como-conectar-o-whatsapp", "como-enviar-uma-mensagem-para-um-lead"],
  },
  {
    slug: "como-enviar-uma-mensagem-para-um-lead",
    category: "conversas",
    title: "Como enviar uma mensagem para um lead",
    description: "Da geração da abordagem ao envio por WhatsApp ou e-mail.",
    keywords: ["enviar mensagem", "abordagem", "enviar whatsapp", "enviar email"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Abra o lead", text: "Pelo Kanban ou pela tabela de Empresas." },
          { title: "Gere a abordagem", text: "Clique em “Gerar 1ª abordagem” ou “Gerar follow-up” para que o Copywriter escreva a mensagem." },
          { title: "Revise o texto", text: "O rascunho aparece editável — ajuste como preferir." },
          { title: "Envie", text: "Clique em “Enviar WhatsApp” ou “Enviar e-mail”." },
        ],
      },
      {
        type: "tip",
        text: "Você também pode responder diretamente dentro de uma conversa já aberta, sem precisar gerar uma nova abordagem.",
      },
      {
        type: "warning",
        text: "Se a integração do canal escolhido não estiver conectada, o envio acontece em modo simulação — a mensagem fica registrada, mas não sai de verdade.",
      },
    ],
    related: ["como-conectar-o-whatsapp", "o-que-e-o-agente-copywriter"],
  },
  {
    slug: "o-whatsapp-nao-esta-conectado",
    category: "problemas",
    title: "O WhatsApp não está conectado",
    description: "O que verificar quando o badge mostra “não conectado”.",
    keywords: ["whatsapp não conecta", "whatsapp desconectado", "erro whatsapp"],
    content: [
      {
        type: "list",
        items: [
          "Confira se o Phone Number ID e o Business Account ID foram preenchidos corretamente em Configurações.",
          "Confirme se o Access Token informado é o token permanente da sua conta WhatsApp Business, e não um token temporário.",
          "Verifique se o webhook e o verify token exibidos na página foram cadastrados no painel de desenvolvedor da Meta.",
          "Apenas Admins e o Proprietário conseguem salvar essas credenciais — confirme seu papel na conta.",
        ],
      },
      {
        type: "p",
        text: "Enquanto a integração aparecer como “não conectado”, os envios de WhatsApp continuam sendo simulados pelo sistema.",
      },
    ],
    related: ["como-conectar-o-whatsapp", "papeis-e-permissoes"],
  },

  // ── Templates & Base de conhecimento ────────────────────────────────────
  {
    slug: "o-que-sao-templates-de-mensagem",
    category: "conteudo",
    title: "O que são templates de mensagem?",
    description: "Modelos reutilizáveis para campanhas e respostas.",
    keywords: ["templates", "modelos de mensagem", "variáveis de template"],
    content: [
      {
        type: "p",
        text: "Templates são modelos reutilizáveis de mensagem, por canal (WhatsApp, e-mail, Instagram ou roteiro de ligação), que podem incluir variáveis como {{empresa}}, {{cidade}} e {{produto}} para personalização.",
      },
      {
        type: "p",
        text: "Você pode criar templates manualmente em Templates de mensagem, ou salvar como template uma mensagem que o Copywriter gerou (identificada com o selo “IA”).",
      },
    ],
    related: ["o-que-e-o-agente-copywriter", "o-que-e-a-base-lumilife"],
  },
  {
    slug: "o-que-e-a-base-lumilife",
    category: "conteudo",
    title: "O que é a Base de conhecimento (Base LumiLife)?",
    description: "O material de referência que os agentes usam para qualificar e escrever.",
    keywords: ["base de conhecimento", "base lumilife", "conhecimento", "material de vendas"],
    content: [
      {
        type: "p",
        text: "A Base de conhecimento reúne tudo o que a sua empresa vende e faz: informações gerais, produtos, preços, materiais e acabamentos, prazos, regiões atendidas, diferenciais, argumentos comerciais e perguntas frequentes, organizados por categoria e tags.",
      },
      {
        type: "p",
        text: "Esse conteúdo é usado pelos agentes de IA para qualificar leads com mais contexto e para escrever abordagens mais alinhadas ao seu discurso comercial.",
      },
      {
        type: "tip",
        text: "Quanto mais completa essa base, mais precisas tendem a ser as respostas do Qualifier, do Copywriter e do Sales Coach.",
      },
    ],
    related: ["como-cadastrar-produtos-e-servicos", "como-funcionam-os-agentes-de-ia"],
  },

  // ── Relatórios ──────────────────────────────────────────────────────────
  {
    slug: "como-funcionam-os-relatorios",
    category: "relatorios",
    title: "Como funcionam os relatórios",
    description: "Números da operação e desempenho por segmento.",
    keywords: ["relatórios", "métricas", "desempenho", "conversão"],
    content: [
      {
        type: "p",
        text: "A página Relatórios mostra os principais números da conta (os mesmos indicadores do Dashboard) e uma tabela de desempenho por segmento: total de leads, quantos foram ganhos e a taxa de conversão de cada segmento.",
      },
      {
        type: "p",
        text: "Logo abaixo, o painel do Analyst gera insights automáticos sobre esses números.",
      },
      {
        type: "warning",
        text: "A exportação de relatórios para PDF, Excel ou CSV ainda não está disponível — está prevista para uma próxima etapa do produto.",
      },
    ],
    related: ["o-que-e-o-agente-analyst", "como-interpretar-os-indicadores"],
  },
  {
    slug: "o-que-e-o-insight-do-analyst",
    category: "relatorios",
    title: "O que é o painel de insights do Analyst",
    description: "Como ler as recomendações automáticas em Relatórios.",
    keywords: ["insight do analyst", "recomendações", "análise automática"],
    content: [
      {
        type: "p",
        text: "No fim da página Relatórios, o painel do Analyst apresenta de 3 a 6 insights, cada um com um título curto, uma observação baseada nos números reais da conta e uma recomendação prática de próximo passo.",
      },
      {
        type: "tip",
        text: "Use os insights como ponto de partida para decisões — como priorizar um segmento ou cidade — mas sempre em conjunto com o seu conhecimento do mercado.",
      },
    ],
    related: ["como-funcionam-os-relatorios", "limitacoes-da-inteligencia-artificial"],
  },

  // ── Tarefas ─────────────────────────────────────────────────────────────
  {
    slug: "como-usar-tarefas",
    category: "tarefas",
    title: "Como usar as Tarefas",
    description: "Lembretes com prazo, gerais ou vinculados a um lead.",
    keywords: ["tarefas", "lembrete", "follow-up", "prazo"],
    content: [
      {
        type: "p",
        text: "Em Tarefas você cria lembretes com título e prazo, para não esquecer um follow-up. Também é possível criar tarefas vinculadas a um lead específico, direto na página dele.",
      },
      {
        type: "steps",
        items: [
          { title: "Preencha o título", text: "Descreva a ação, por exemplo: “ligar para confirmar orçamento”." },
          { title: "Defina um prazo (opcional)", text: "Data e hora do lembrete." },
          { title: "Clique em Adicionar", text: "A tarefa aparece na lista, ordenada pelo prazo mais próximo." },
          { title: "Marque como concluída", text: "Clique em Concluir quando terminar." },
        ],
      },
    ],
    related: ["como-priorizar-leads"],
  },

  // ── Planos e uso ────────────────────────────────────────────────────────
  {
    slug: "como-funcionam-os-planos",
    category: "planos",
    title: "Como funcionam os planos do LumiHunter",
    description: "Free, Starter, Pro e Business — o que muda entre eles.",
    keywords: ["planos", "free", "starter", "pro", "business", "assinatura"],
    content: [
      {
        type: "p",
        text: "O LumiHunter organiza os limites de uso em quatro planos: Free, Starter, Pro e Business. Cada plano define um teto para quatro recursos: quantidade de leads ativos, execuções de agentes de IA por mês, mensagens enviadas por mês e número de pessoas na conta (seats).",
      },
      {
        type: "p",
        text: "Nos planos mais altos, alguns desses limites passam a ser ilimitados — a interface mostra a etiqueta “ilimitado” quando é o caso.",
      },
      {
        type: "warning",
        text: "A gestão de cobrança e upgrade de plano via cartão ainda está em desenvolvimento. Se precisar mudar de plano, fale com o suporte do LumiHunter.",
      },
    ],
    related: ["o-que-consome-a-cota-mensal", "o-que-acontece-quando-a-cota-acaba"],
  },
  {
    slug: "o-que-consome-a-cota-mensal",
    category: "planos",
    title: "O que consome a cota mensal do plano",
    description: "Entenda o que conta para cada um dos três limites mensais.",
    keywords: ["cota mensal", "consumo", "limite de ia", "limite de mensagens"],
    content: [
      {
        type: "list",
        items: [
          "Leads — conta o total de leads ativos (não arquivados) na sua base, sem reset mensal.",
          "IA (mês) — conta cada execução de um agente de IA (Hunter, Qualifier, Copywriter, Sales Coach ou Analyst) desde o início do mês corrente.",
          "Mensagens (mês) — conta cada mensagem enviada por WhatsApp ou e-mail desde o início do mês corrente.",
        ],
      },
      {
        type: "tip",
        text: "Acompanhe o consumo em tempo real no bloco “Uso do plano”, no Dashboard.",
      },
    ],
    related: ["como-acompanhar-o-uso-do-plano", "o-que-acontece-quando-a-cota-acaba"],
  },
  {
    slug: "o-que-acontece-quando-a-cota-acaba",
    category: "planos",
    title: "O que acontece quando a cota do plano acaba",
    description: "O comportamento do sistema ao atingir um limite.",
    keywords: ["cota esgotada", "limite atingido", "não consigo criar lead"],
    content: [
      {
        type: "list",
        items: [
          "Leads — ao atingir o limite, novos leads não podem ser criados (nem pelo Hunter, nem manualmente) até você arquivar leads antigos ou fazer upgrade.",
          "IA (mês) — ao atingir o limite mensal, novas execuções de agentes de IA são bloqueadas até a virada do mês ou um upgrade de plano.",
          "Mensagens (mês) — ao atingir o limite mensal, novos envios de WhatsApp/e-mail são bloqueados até a virada do mês ou um upgrade.",
          "Usuários (seats) — ao atingir o limite, novos convites de time não podem ser enviados até liberar uma vaga ou fazer upgrade.",
        ],
      },
      {
        type: "p",
        text: "Em todos os casos, o sistema mostra uma mensagem explicando qual limite foi atingido no momento da ação bloqueada.",
      },
    ],
    related: ["como-arquivar-um-lead", "como-funcionam-os-planos"],
  },

  // ── Configurações ───────────────────────────────────────────────────────
  {
    slug: "visao-geral-das-configuracoes",
    category: "configuracoes",
    title: "Visão geral das Configurações",
    description: "O que existe dentro da página de Configurações.",
    keywords: ["configurações", "config", "ajustes"],
    content: [
      {
        type: "list",
        items: [
          "Empresa — dados cadastrais, canais comerciais e cor da marca.",
          "WhatsApp Cloud API — credenciais da integração de WhatsApp.",
          "Resend — credenciais da integração de e-mail.",
          "Outras integrações — Google (login, configurado no Supabase) e Stripe (cobrança, chegando em uma próxima fase).",
          "Equipe & plano — plano atual, membros da conta, convites pendentes e envio de novos convites.",
          "Dados de demonstração — cria uma empresa de exemplo com catálogo e ICP prontos, útil para explorar a plataforma.",
        ],
      },
    ],
    related: ["como-configurar-minha-empresa", "como-gerenciar-membros-e-convites"],
  },
  {
    slug: "como-gerenciar-membros-e-convites",
    category: "configuracoes",
    title: "Como gerenciar membros e convites",
    description: "Convidar, revogar convites e remover pessoas da conta.",
    keywords: ["gerenciar membros", "remover usuário", "revogar convite"],
    content: [
      {
        type: "p",
        text: "Em Configurações → Equipe & plano, administradores podem convidar novas pessoas por e-mail, cancelar um convite ainda não aceito e remover um membro da conta (exceto o Proprietário e você mesmo).",
      },
      {
        type: "warning",
        text: "Essas ações exigem papel de Admin ou Proprietário.",
      },
    ],
    related: ["como-convidar-meu-time", "papeis-e-permissoes"],
  },
  {
    slug: "papeis-e-permissoes",
    category: "configuracoes",
    title: "Papéis e permissões no LumiHunter",
    description: "O que cada papel de usuário pode fazer.",
    keywords: ["papéis", "permissões", "proprietário", "admin", "vendas", "financeiro", "leitura"],
    content: [
      {
        type: "list",
        items: [
          "Proprietário — acesso total, incluindo excluir a empresa e gerenciar o dono da conta.",
          "Administrador — configurações, integrações, equipe e agentes de IA, além de tudo que os demais papéis fazem.",
          "Comercial / Marketing — leads, campanhas, conversas, produtos, ICP e tarefas.",
          "Financeiro — acesso de leitura, mais visualização de assinatura e plano.",
          "Visualização — apenas leitura, sem poder de edição em nenhum módulo.",
        ],
      },
      {
        type: "tip",
        text: "Escolha o papel de leitura para pessoas que só precisam acompanhar números, sem editar dados.",
      },
    ],
    related: ["como-gerenciar-membros-e-convites", "nao-consigo-acessar-um-recurso"],
  },

  // ── Auditoria ───────────────────────────────────────────────────────────
  {
    slug: "o-que-e-a-auditoria",
    category: "auditoria",
    title: "O que é a página de Auditoria",
    description: "A linha do tempo unificada de tudo que acontece na conta.",
    keywords: ["auditoria", "log", "histórico", "linha do tempo"],
    content: [
      {
        type: "p",
        text: "Auditoria reúne, em uma única tabela ordenada por data, as atividades registradas nos leads, as execuções dos agentes de IA (com modelo, duração e custo), as automações disparadas e as mensagens enviadas ou recebidas — cada uma com seu status.",
      },
      {
        type: "p",
        text: "É o lugar ideal para entender rapidamente quem fez o quê e quando, ou para investigar por que uma execução de IA ou um envio de mensagem falhou.",
      },
    ],
    related: ["o-sistema-apresentou-um-erro", "como-configurar-os-agentes-de-ia"],
  },

  // ── Problemas e soluções ────────────────────────────────────────────────
  {
    slug: "nao-consigo-criar-uma-prospeccao",
    category: "problemas",
    title: "Não consigo rodar uma busca do Hunter",
    description: "As causas mais comuns e como resolver.",
    keywords: ["não consigo prospectar", "botão desabilitado", "hunter desabilitado"],
    content: [
      {
        type: "list",
        items: [
          "Verifique se existe pelo menos um Perfil de Cliente Ideal (ICP) ativo — sem ICP o botão do Hunter fica desabilitado.",
          "Confirme que há produtos cadastrados em Produtos & Serviços.",
          "Confira em Configurações → Equipe & plano se a cota mensal de execuções de IA do plano já não foi atingida.",
          "Confirme que seu papel na conta permite criar e editar leads (Vendas, Marketing, Admin ou Proprietário).",
        ],
      },
    ],
    related: ["como-rodar-o-hunter", "minha-cota-de-ia-ou-mensagens-esgotou"],
  },
  {
    slug: "o-hunter-nao-encontrou-empresas",
    category: "problemas",
    title: "O Hunter não encontrou empresas",
    description: "Quando a busca roda, mas retorna poucos ou nenhum resultado.",
    keywords: ["nenhum resultado", "hunter zero leads", "busca vazia"],
    content: [
      {
        type: "p",
        text: "Isso costuma acontecer quando o ICP está muito restrito (cidade ou segmento com pouca presença pública) ou quando o catálogo de produtos está com poucas informações para orientar a busca.",
      },
      {
        type: "list",
        items: [
          "Amplie a área geográfica ou o segmento do ICP.",
          "Adicione mais palavras-chave e exemplos de compradores nos produtos.",
          "Use o campo de refinamento de busca com um recorte diferente.",
          "Tente novamente mais tarde — os resultados disponíveis publicamente variam com o tempo.",
        ],
      },
    ],
    related: ["o-que-fazer-quando-o-hunter-nao-encontra-bons-resultados", "como-criar-um-perfil-icp"],
  },
  {
    slug: "dados-da-empresa-incompletos",
    category: "problemas",
    title: "Os dados de uma empresa estão incompletos",
    description: "Por que alguns campos de contato aparecem vazios.",
    keywords: ["dados incompletos", "sem telefone", "sem email", "campo vazio"],
    content: [
      {
        type: "p",
        text: "O LumiHunter só preenche um campo de contato quando encontra uma fonte pública confiável para ele. Quando essa informação não está disponível, o campo fica vazio em vez de ser preenchido com um dado inventado.",
      },
      {
        type: "list",
        items: [
          "Complete manualmente o dado na página do lead, se você já o conhece por outro canal.",
          "Use o recurso de enriquecimento por CNPJ na página do lead, quando o CNPJ da empresa for conhecido.",
          "Considere que empresas pequenas ou com pouca presença online naturalmente têm menos dados públicos disponíveis.",
        ],
      },
    ],
    related: ["informacoes-de-contato-do-lead", "o-que-e-um-lead"],
  },
  {
    slug: "encontrei-um-lead-duplicado",
    category: "problemas",
    title: "Encontrei um lead duplicado",
    description: "O que fazer quando a mesma empresa aparece duas vezes.",
    keywords: ["lead duplicado", "empresa repetida", "mesclar leads"],
    content: [
      {
        type: "p",
        text: "Isso pode acontecer quando a mesma empresa aparece com nomes ligeiramente diferentes (razão social x nome fantasia, por exemplo), já que a deduplicação do Hunter compara pelo nome.",
      },
      {
        type: "p",
        text: "Nesse caso, escolha qual dos dois registros manter com o histórico mais completo e arquive o outro para não confundir o pipeline e as métricas.",
      },
    ],
    related: ["como-evitar-leads-duplicados", "como-arquivar-um-lead"],
  },
  {
    slug: "o-score-parece-incorreto",
    category: "problemas",
    title: "O Score parece incorreto",
    description: "Como investigar uma nota que não parece fazer sentido.",
    keywords: ["score errado", "nota incorreta", "score estranho"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Leia o motivo do score", text: "Na página do lead, o campo “Score” explica os fatores considerados pela IA." },
          { title: "Confira o ICP e o catálogo", text: "Um score estranho muitas vezes reflete um ICP desatualizado ou um catálogo incompleto." },
          { title: "Rode o Qualifier novamente", text: "Após atualizar informações do lead, da empresa ou do catálogo, uma nova execução tende a refletir melhor a realidade." },
        ],
      },
      {
        type: "warning",
        text: "O score é uma estimativa de aderência baseada em dados disponíveis — não é uma medição exata, e vale sempre cruzar com seu conhecimento do mercado.",
      },
    ],
    related: ["o-que-e-o-agente-qualifier-e-o-score", "limitacoes-da-inteligencia-artificial"],
  },
  {
    slug: "minha-cota-de-ia-ou-mensagens-esgotou",
    category: "problemas",
    title: "Minha cota de IA ou de mensagens esgotou",
    description: "O que fazer quando um limite mensal é atingido.",
    keywords: ["cota esgotada", "limite de mensagens", "limite de ia atingido"],
    content: [
      {
        type: "list",
        items: [
          "Verifique o consumo atual no bloco “Uso do plano” do Dashboard.",
          "Aguarde a virada do mês — as cotas de IA e de mensagens são renovadas mensalmente.",
          "Fale com o suporte do LumiHunter para avaliar um upgrade de plano, se precisar de mais volume agora.",
        ],
      },
    ],
    related: ["o-que-consome-a-cota-mensal", "como-funcionam-os-planos"],
  },
  {
    slug: "nao-consigo-acessar-um-recurso",
    category: "problemas",
    title: "Não consigo acessar um recurso",
    description: "Quando um botão ou uma página parece bloqueado.",
    keywords: ["sem permissão", "acesso negado", "não consigo editar"],
    content: [
      {
        type: "p",
        text: "A causa mais comum é o papel do seu usuário na conta. Os papéis de Financeiro e Visualização têm acesso somente de leitura, e algumas ações (como salvar integrações ou gerenciar o time) exigem papel de Admin ou Proprietário.",
      },
      {
        type: "p",
        text: "Se você acredita que deveria ter acesso a algo, peça a um Admin ou ao Proprietário da conta para revisar ou ajustar o seu papel em Configurações → Equipe & plano.",
      },
    ],
    related: ["papeis-e-permissoes", "como-gerenciar-membros-e-convites"],
  },
  {
    slug: "o-sistema-apresentou-um-erro",
    category: "problemas",
    title: "O sistema apresentou um erro",
    description: "Primeiros passos para investigar e o que informar ao suporte.",
    keywords: ["erro", "falha", "bug", "não funcionou"],
    content: [
      {
        type: "steps",
        items: [
          { title: "Anote a mensagem de erro exata", text: "E, se possível, um print da tela no momento do erro." },
          { title: "Confira a página Auditoria", text: "Execuções de IA e mensagens com falha aparecem lá, muitas vezes com detalhes do erro." },
          { title: "Tente reproduzir a ação", text: "Em alguns casos, uma nova tentativa resolve — por exemplo, oscilações de rede." },
          { title: "Fale com o suporte do LumiHunter", text: "Descreva o que estava fazendo, quando aconteceu e a mensagem exata do erro." },
        ],
      },
    ],
    related: ["o-que-e-a-auditoria"],
  },
];

export function getArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function getCategory(slug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.slug === slug);
}

export function getArticlesByCategory(categorySlug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === categorySlug);
}

export function getRelatedArticles(article: HelpArticle): HelpArticle[] {
  return (article.related ?? [])
    .map((slug) => getArticle(slug))
    .filter((a): a is HelpArticle => !!a);
}

export interface HelpSearchResult {
  article: HelpArticle;
  category: HelpCategory;
  score: number;
  snippet: string;
}

function articleText(article: HelpArticle): string {
  return article.content
    .map((b) => {
      if (b.type === "p" || b.type === "h2" || b.type === "tip" || b.type === "warning")
        return b.text;
      if (b.type === "list") return b.items.join(" ");
      if (b.type === "steps") return b.items.map((s) => `${s.title} ${s.text}`).join(" ");
      return "";
    })
    .join(" ");
}

export function searchHelp(rawQuery: string): HelpSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  const terms = query.split(/\s+/).filter(Boolean);

  const results: HelpSearchResult[] = [];
  for (const article of HELP_ARTICLES) {
    const category = getCategory(article.category);
    if (!category) continue;

    const title = article.title.toLowerCase();
    const description = article.description.toLowerCase();
    const keywords = article.keywords.join(" ").toLowerCase();
    const body = articleText(article).toLowerCase();
    const categoryLabel = category.label.toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      if (keywords.includes(term)) score += 4;
      if (description.includes(term)) score += 2;
      if (categoryLabel.includes(term)) score += 2;
      if (body.includes(term)) score += 1;
    }
    if (score === 0) continue;

    const snippetSource = description || body.slice(0, 160);
    results.push({ article, category, score, snippet: snippetSource });
  }

  return results.sort((a, b) => b.score - a.score);
}
