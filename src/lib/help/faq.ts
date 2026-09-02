export interface HelpFaqItem {
  question: string;
  answer: string;
  articleSlug?: string;
}

export const HELP_FAQ: HelpFaqItem[] = [
  {
    question: "O que é o LumiHunter?",
    answer:
      "Uma plataforma de prospecção comercial que usa inteligência artificial para encontrar empresas com potencial de compra, organizá-las como leads e acompanhar cada oportunidade até o fechamento.",
    articleSlug: "o-que-e-o-lumihunter",
  },
  {
    question: "Como encontro empresas?",
    answer:
      "Cadastre seus produtos e um Perfil de Cliente Ideal (ICP) e depois rode o Agente Hunter em Leads & CRM — ele pesquisa e traz empresas reais que combinam com o seu negócio.",
    articleSlug: "como-rodar-o-hunter",
  },
  {
    question: "O que é um lead?",
    answer:
      "Um lead é uma empresa que pode representar uma oportunidade comercial, encontrada pelo Hunter ou cadastrada manualmente, com dados, score, etapa no pipeline e histórico.",
    articleSlug: "o-que-e-um-lead",
  },
  {
    question: "Como funciona o Score?",
    answer:
      "O Agente Qualifier avalia o lead contra o seu ICP e catálogo e retorna uma nota de 0 a 100, com os fatores considerados e um resumo da oportunidade.",
    articleSlug: "o-que-e-o-agente-qualifier-e-o-score",
  },
  {
    question: "A IA garante que o lead vai comprar?",
    answer:
      "Não. O score e as recomendações são estimativas de aderência baseadas em dados disponíveis — não são garantias de venda. Use-as como apoio à decisão, não como verdade absoluta.",
    articleSlug: "limitacoes-da-inteligencia-artificial",
  },
  {
    question: "Como funcionam os créditos ou cotas de uso?",
    answer:
      "O LumiHunter usa cotas mensais por plano, não um sistema de créditos avulsos: um limite de leads ativos, um de execuções de IA por mês e um de mensagens enviadas por mês, além do número de pessoas na conta.",
    articleSlug: "como-funcionam-os-planos",
  },
  {
    question: "Posso pesquisar qualquer segmento?",
    answer:
      "Sim, desde que você defina esse segmento no seu Perfil de Cliente Ideal (ICP). A qualidade dos resultados depende de quão bem o ICP e o catálogo de produtos descrevem o que você procura.",
    articleSlug: "como-criar-um-perfil-icp",
  },
  {
    question: "Como entro em contato com uma empresa?",
    answer:
      "Abra o lead, gere uma abordagem com o Copywriter (ou escreva a sua própria mensagem) e envie por WhatsApp ou e-mail direto pela página do lead.",
    articleSlug: "como-enviar-uma-mensagem-para-um-lead",
  },
  {
    question: "Como funciona o Pipeline?",
    answer:
      "É o quadro Kanban de Leads & CRM: cada coluna é uma etapa da negociação (Novo Lead, Qualificado, Contato iniciado, Respondeu, Interessado, Orçamento enviado, Negociação, Cliente, Perdido) e você arrasta os cards conforme o lead avança.",
    articleSlug: "o-que-e-o-pipeline-kanban",
  },
  {
    question: "Como conectar meu WhatsApp?",
    answer:
      "Em Configurações → WhatsApp Cloud API, informe o Phone Number ID, o Business Account ID e o Access Token da sua conta WhatsApp Business, e cadastre o webhook exibido na tela no painel da Meta.",
    articleSlug: "como-conectar-o-whatsapp",
  },
  {
    question: "Como faço upgrade do meu plano?",
    answer:
      "A gestão de cobrança e upgrade autoatendido ainda está em desenvolvimento. Enquanto isso, fale com o suporte do LumiHunter para ajustar seu plano.",
    articleSlug: "como-funcionam-os-planos",
  },
];
