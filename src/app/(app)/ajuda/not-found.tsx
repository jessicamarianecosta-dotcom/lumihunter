import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HelpNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-secondary">
        <FileQuestion className="size-6 text-muted-foreground" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Artigo não encontrado</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          O conteúdo que você procura não está disponível ou pode ter sido
          movido.
        </p>
      </div>
      <Button asChild>
        <Link href="/ajuda">Voltar para Central de Ajuda</Link>
      </Button>
    </div>
  );
}
