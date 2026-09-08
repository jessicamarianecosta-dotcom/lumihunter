"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createManualLead,
  type CreateManualLeadResult,
} from "@/app/(app)/leads/actions";

const FORM_ID = "new-lead-form";

export function AddLeadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    CreateManualLeadResult | null,
    FormData
  >(createManualLead, null);

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setJustSaved(true);
    router.refresh();
    const t = setTimeout(() => {
      setOpen(false);
      setJustSaved(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [state, router]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setJustSaved(false);
      }}
    >
      <Dialog.Trigger asChild>
        <Button className="w-full gap-1.5 sm:w-auto">
          <Plus className="size-4" />
          Adicionar lead
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[90vh] flex-col overflow-hidden bg-card shadow-2xl outline-none duration-200",
            "inset-x-0 bottom-0 rounded-t-2xl data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[34rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">
              Adicionar lead
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Cadastre manualmente um novo lead no pipeline. Ele entra como
            &ldquo;Novo Lead&rdquo; e fica vinculado à empresa atual.
          </Dialog.Description>

          <form
            id={FORM_ID}
            ref={formRef}
            action={formAction}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            <F name="name" label="Nome da empresa" required autoFocus />
            <F name="contact_name" label="Nome do contato" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <F
                name="whatsapp"
                label="WhatsApp"
                inputMode="tel"
                placeholder="(41) 99999-9999"
              />
              <F name="phone" label="Telefone" inputMode="tel" />
            </div>
            <F name="email" label="E-mail" type="email" inputMode="email" />
            <F
              name="website"
              label="Site"
              inputMode="url"
              placeholder="https://"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem]">
              <F name="city" label="Cidade" />
              <F name="state" label="Estado (UF)" maxLength={2} placeholder="PR" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            {state && !state.ok && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {state.error}
              </p>
            )}
            {justSaved && (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                Lead adicionado com sucesso.
              </p>
            )}
          </form>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button
              type="submit"
              form={FORM_ID}
              disabled={pending || justSaved}
            >
              {pending ? "Salvando…" : "Salvar lead"}
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
