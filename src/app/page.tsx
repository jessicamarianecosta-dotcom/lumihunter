import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, MessagesSquare, Bot } from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Agente Hunter",
    desc: "Encontra empresas com potencial de compra a partir do seu catálogo e do seu perfil de cliente ideal.",
  },
  {
    icon: Sparkles,
    title: "Lead Score de IA",
    desc: "Cada lead recebe uma nota de 0 a 100 com a explicação dos critérios que pesaram.",
  },
  {
    icon: Bot,
    title: "Copywriter",
    desc: "Mensagens personalizadas por lead e por canal — WhatsApp, e-mail, Instagram e ligação.",
  },
  {
    icon: MessagesSquare,
    title: "CRM + Conversas",
    desc: "Pipeline kanban, central única de mensagens e follow-up automático que para na resposta.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            L
          </span>
          LumiHunter AI
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Começar grátis</Link>
          </Button>
        </nav>
      </header>

      <main className="container">
        <section className="mx-auto max-w-3xl py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" />
            Prospecção B2B com inteligência artificial
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Seu agente inteligente para encontrar, qualificar e conquistar novos
            clientes.
          </h1>
          <p className="mt-5 text-balance text-lg text-muted-foreground">
            O LumiHunter AI pesquisa empresas, identifica quem pode comprar seus
            produtos, gera mensagens personalizadas e acompanha todo o funil de
            vendas — em um só lugar.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Criar minha conta</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Já tenho conta</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-5">
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container text-sm text-muted-foreground">
          © {new Date().getFullYear()} LumiHunter AI — feito para equipes
          comerciais.
        </div>
      </footer>
    </div>
  );
}
