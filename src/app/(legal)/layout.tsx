import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              L
            </span>
            LumiHunter AI
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="container max-w-3xl py-16">{children}</main>

      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded bg-primary text-primary-foreground">
              L
            </span>
            LumiHunter AI © {new Date().getFullYear()}
          </div>
          <div className="flex gap-6">
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link href="/" className="hover:text-foreground">
              Início
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
