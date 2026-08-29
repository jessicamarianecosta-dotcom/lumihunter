import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-secondary p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            L
          </span>
          LumiHunter AI
        </Link>
        <blockquote className="space-y-2">
          <p className="text-lg">
            &ldquo;Encontre, qualifique e conquiste novos clientes com um agente
            que trabalha por você.&rdquo;
          </p>
          <footer className="text-sm text-muted-foreground">
            Prospecção B2B inteligente
          </footer>
        </blockquote>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
