import Link from "next/link";
import {
  Sparkles,
  Target,
  Bot,
  MessagesSquare,
  Gauge,
  Megaphone,
  Workflow,
  BarChart3,
  ShieldCheck,
  Zap,
  MapPin,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/shared/install-app-button";

export const metadata = {
  title: "LumiHunter AI — Prospecção B2B com inteligência artificial",
  description:
    "Encontre, qualifique e conquiste novos clientes com agentes de IA que pesquisam empresas, dão score, escrevem as mensagens e acompanham o funil.",
};

const steps = [
  {
    n: "01",
    title: "Cadastre produtos e ICP",
    desc: "Diga o que sua empresa vende e como é o cliente ideal — regiões, segmentos, porte, palavras-chave.",
    icon: Target,
  },
  {
    n: "02",
    title: "O Agente Hunter busca",
    desc: "A IA vasculha fontes públicas e traz empresas reais com potencial de compra, já organizadas no pipeline.",
    icon: Bot,
  },
  {
    n: "03",
    title: "Qualifica e escreve",
    desc: "Cada lead recebe um score de 0 a 100 explicado, e o Copywriter gera a abordagem para cada canal.",
    icon: Sparkles,
  },
  {
    n: "04",
    title: "Você fecha",
    desc: "Envie por WhatsApp e e-mail, acompanhe respostas na central e deixe o follow-up rodar sozinho.",
    icon: MessagesSquare,
  },
];

const agents = [
  {
    name: "Hunter",
    role: "Prospecção",
    desc: "Encontra empresas-alvo aderentes ao seu ICP a partir de dados públicos.",
    icon: Target,
  },
  {
    name: "Qualifier",
    role: "Lead Score",
    desc: "Pontua de 0 a 100 com os critérios que pesaram e recomenda produtos.",
    icon: Gauge,
  },
  {
    name: "Copywriter",
    role: "Mensagens",
    desc: "Escreve WhatsApp, e-mail, DM e roteiro de ligação — únicos para cada lead.",
    icon: Bot,
  },
  {
    name: "Analyst",
    role: "Insights",
    desc: "Analisa segmentos, cidades e campanhas e diz onde focar o esforço.",
    icon: BarChart3,
  },
];

const features = [
  { icon: Workflow, title: "CRM Kanban", desc: "Pipeline visual, arraste os cartões, histórico e tarefas por lead." },
  { icon: MessagesSquare, title: "Central de conversas", desc: "WhatsApp e e-mail em um só lugar, com classificação automática." },
  { icon: Megaphone, title: "Campanhas & follow-up", desc: "Sequências por segmento e cidade que param quando o lead responde." },
  { icon: BarChart3, title: "Dashboard executivo", desc: "Leads, respostas, conversões, funil e mapa das cidades em tempo real." },
  { icon: ShieldCheck, title: "Multi-empresa & LGPD", desc: "RLS em tudo, papéis por usuário, blacklist e registro de consentimento." },
  { icon: Zap, title: "Integrações oficiais", desc: "WhatsApp Cloud API da Meta e Resend — nada de automação de navegador." },
];

const plans = [
  { name: "Free", price: "R$ 0", tagline: "Para experimentar", items: ["100 leads", "200 execuções de IA/mês", "1 usuário", "Agentes em modo demo"] },
  { name: "Starter", price: "R$ 97", tagline: "Autônomos e MEI", items: ["1.000 leads", "2.000 execuções/mês", "2 usuários", "WhatsApp + e-mail"], highlight: true },
  { name: "Pro", price: "R$ 297", tagline: "Times comerciais", items: ["10.000 leads", "Execuções ilimitadas*", "6 usuários", "Automações e relatórios"] },
  { name: "Business", price: "Fale conosco", tagline: "Operação em escala", items: ["Leads ilimitados", "Múltiplas empresas", "Usuários ilimitados", "Suporte dedicado"] },
];

const faqs = [
  {
    q: "De onde vêm os leads?",
    a: "O Agente Hunter pesquisa fontes públicas na internet (sites, redes sociais, diretórios) e extrai apenas informações disponíveis publicamente. Ele nunca inventa contatos — campos sem fonte ficam vazios.",
  },
  {
    q: "Preciso de chave de IA para testar?",
    a: "Não. Sem a chave da Claude API o sistema roda em modo demo: os agentes devolvem respostas simuladas realistas, com custo zero. Ao adicionar a chave, passam a usar IA de verdade automaticamente.",
  },
  {
    q: "É só automação de WhatsApp Web?",
    a: "Nunca. A integração é 100% pela WhatsApp Cloud API oficial da Meta e pelo Resend para e-mail — dentro dos termos de uso de cada plataforma.",
  },
  {
    q: "Meus dados ficam isolados?",
    a: "Sim. O sistema é multi-empresa desde a base, com Row Level Security em todas as tabelas. Cada empresa só enxerga os próprios leads, produtos e campanhas.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              L
            </span>
            LumiHunter AI
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
            <a href="#agentes" className="hover:text-foreground">Agentes</a>
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <InstallAppButton />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(50%_40%_at_50%_0%,#000,transparent)]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />

          <div className="container flex flex-col items-center py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              Prospecção B2B com agentes de IA
            </span>

            <h1 className="mt-6 max-w-4xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Encontre, qualifique e conquiste{" "}
              <span className="bg-gradient-to-r from-lumi-yellow to-lumi-gold bg-clip-text text-transparent">
                novos clientes
              </span>{" "}
              no piloto automático.
            </h1>

            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              O LumiHunter AI pesquisa empresas, identifica quem pode comprar seus
              produtos, dá um score explicado, escreve as mensagens e acompanha
              todo o funil — WhatsApp, e-mail e CRM em um só lugar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="group">
                <Link href="/signup">
                  Criar minha conta grátis
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#como-funciona">Ver como funciona</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Sem cartão de crédito · Modo demo dos agentes incluso
            </p>

            {/* Mockup de dashboard */}
            <div className="mt-16 w-full max-w-5xl">
              <div className="rounded-2xl border bg-card/70 p-2 shadow-2xl shadow-primary/5 backdrop-blur">
                <div className="rounded-xl border bg-background">
                  <div className="flex items-center gap-1.5 border-b px-4 py-3">
                    <span className="size-2.5 rounded-full bg-red-400/70" />
                    <span className="size-2.5 rounded-full bg-amber-400/70" />
                    <span className="size-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ml-3 text-xs text-muted-foreground">
                      lumihunter.app / leads
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                    {[
                      { k: "Leads encontrados", v: "1.284" },
                      { k: "Qualificados", v: "437" },
                      { k: "Respostas", v: "112" },
                      { k: "Vendas", v: "29" },
                    ].map((c) => (
                      <div key={c.k} className="rounded-lg border bg-card p-3 text-left">
                        <p className="text-lg font-semibold">{c.v}</p>
                        <p className="text-[11px] text-muted-foreground">{c.k}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 overflow-x-auto px-4 pb-4">
                    {["Novo Lead", "Qualificado", "Contato", "Interessado"].map(
                      (col, ci) => (
                        <div key={col} className="w-40 shrink-0 rounded-lg border bg-card/60 p-2">
                          <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                            {col}
                          </p>
                          {Array.from({ length: 3 - (ci % 2) }).map((_, i) => (
                            <div key={i} className="mb-2 rounded-md border bg-background p-2 text-left">
                              <div className="flex items-center justify-between">
                                <span className="h-2 w-16 rounded bg-muted-foreground/30" />
                                <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">
                                  {90 - ci * 12 - i * 5}
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin className="size-2.5" /> São Paulo/SP
                              </div>
                            </div>
                          ))}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground">
              <span>Feito para gráficas, comunicação visual, indústrias e serviços</span>
              <span className="hidden sm:inline">·</span>
              <span>Multi-empresa</span>
              <span className="hidden sm:inline">·</span>
              <span>LGPD por padrão</span>
            </div>
          </div>
        </section>

        {/* ── Como funciona ────────────────────────────────── */}
        <section id="como-funciona" className="border-t bg-secondary/30 py-20 sm:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-accent">Como funciona</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Do cadastro à venda em 4 passos
              </h2>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <div key={s.n} className="relative rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-accent">
                      <s.icon className="size-5" />
                    </span>
                    <span className="text-2xl font-semibold text-muted-foreground/30">
                      {s.n}
                    </span>
                  </div>
                  <h3 className="mt-4 font-medium">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Agentes ──────────────────────────────────────── */}
        <section id="agentes" className="py-20 sm:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-accent">Agentes de IA</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Uma equipe de IA trabalhando no seu comercial
              </h2>
              <p className="mt-4 text-muted-foreground">
                Cada agente tem um papel. Você configura o prompt, o modelo e vê o
                custo de cada execução.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {agents.map((a) => (
                <div
                  key={a.name}
                  className="group rounded-xl border bg-card p-6 transition-colors hover:border-accent"
                >
                  <span className="grid size-11 place-items-center rounded-lg bg-gradient-to-br from-lumi-yellow/20 to-lumi-gold/10 text-accent">
                    <a.icon className="size-5" />
                  </span>
                  <p className="mt-4 font-semibold">{a.name}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-accent">
                    {a.role}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Recursos ─────────────────────────────────────── */}
        <section id="recursos" className="border-t bg-secondary/30 py-20 sm:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-accent">Recursos</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Tudo que o time precisa, sem trocar de aba
              </h2>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="bg-card p-6">
                  <f.icon className="size-5 text-accent" />
                  <h3 className="mt-3 font-medium">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Planos ───────────────────────────────────────── */}
        <section id="planos" className="py-20 sm:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-accent">Planos</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Comece grátis, cresça quando fizer sentido
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                Preços de referência. A cobrança (Stripe) entra numa próxima fase —
                hoje tudo está liberado para uso.
              </p>
            </div>
            <div className="mt-14 grid gap-6 lg:grid-cols-4">
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={`relative rounded-2xl border bg-card p-6 ${
                    p.highlight ? "border-accent ring-1 ring-accent" : ""
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-6 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      Mais popular
                    </span>
                  )}
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.tagline}</p>
                  <p className="mt-4 text-2xl font-semibold">
                    {p.price}
                    {p.price.startsWith("R$") && p.price !== "R$ 0" && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /mês
                      </span>
                    )}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                        <span className="text-muted-foreground">{it}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-6 w-full"
                    variant={p.highlight ? "default" : "outline"}
                  >
                    <Link href="/signup">Começar</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section className="border-t bg-secondary/30 py-20 sm:py-28">
          <div className="container max-w-3xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Perguntas frequentes
            </h2>
            <div className="mt-10 divide-y rounded-2xl border bg-card">
              {faqs.map((f) => (
                <details key={f.q} className="group p-5">
                  <summary className="flex cursor-pointer items-center justify-between font-medium">
                    {f.q}
                    <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="py-20 sm:py-28">
          <div className="container">
            <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-accent/10 px-6 py-16 text-center">
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Seu próximo cliente já existe. Vamos encontrá-lo.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Crie sua conta, cadastre o que você vende e deixe o Agente Hunter
                trabalhar. Leva menos de 5 minutos.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/signup">Começar agora — grátis</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded bg-primary text-primary-foreground">
              L
            </span>
            LumiHunter AI © {new Date().getFullYear()}
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href="/login" className="hover:text-foreground">Entrar</Link>
            <Link href="/signup" className="hover:text-foreground">Criar conta</Link>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link href="/termos" className="hover:text-foreground">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
