"use client";

import { useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createProduct } from "@/app/(app)/produtos/actions";

const FORM_ID = "new-product-form";

export function AddProductButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createProduct(fd);
      formRef.current?.reset();
      setOpen(false);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="w-full gap-1.5 sm:w-auto">
          <Plus className="size-4" />
          Adicionar produto
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[90vh] flex-col overflow-hidden bg-card shadow-2xl outline-none duration-200",
            "inset-x-0 bottom-0 rounded-t-2xl data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[32rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">Novo produto</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Cadastre um novo produto ou serviço no catálogo.
          </Dialog.Description>

          <form
            id={FORM_ID}
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            <F name="name" label="Nome" required />
            <div className="space-y-1.5">
              <Label htmlFor="kind">Tipo</Label>
              <select
                id="kind"
                name="kind"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="product">Produto</option>
                <option value="service">Serviço</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <F name="price_start" label="Preço inicial" type="number" />
              <F name="price_avg" label="Preço médio" type="number" />
              <F name="min_quantity" label="Qtd. mínima" type="number" />
              <F name="lead_time_days" label="Prazo (dias)" type="number" />
            </div>
            <F name="keywords" label="Palavras-chave (vírgula)" />
            <F name="applications" label="Aplicações (vírgula)" />
            <F name="cities_served" label="Cidades atendidas (vírgula)" />
            <F name="example_buyers" label="Exemplos de compradores (vírgula)" />
            <F name="ideal_audience" label="Público ideal" />
          </form>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" form={FORM_ID} disabled={pending}>
              {pending ? "Salvando…" : "Salvar produto"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function F({
  name,
  label,
  ...props
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
