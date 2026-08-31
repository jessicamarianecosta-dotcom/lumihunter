"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";

const ACTIONS = [
  { label: "Rodar Agente Hunter", href: "/leads" },
  { label: "Nova campanha", href: "/campanhas" },
  { label: "Definir cliente ideal (ICP)", href: "/icp" },
  { label: "Convidar membro do time", href: "/config" },
  { label: "Ver auditoria / uso de IA", href: "/auditoria" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const openEvt = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("lh:command", openEvt);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("lh:command", openEvt);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Comandos"
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh]"
      overlayClassName="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm"
      contentClassName="relative z-[100] w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 text-muted-foreground" />
        <Command.Input
          placeholder="Buscar páginas e ações…"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
          Nada encontrado.
        </Command.Empty>

        <Command.Group
          heading="Ir para"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {NAV_ITEMS.map((item) => (
            <Command.Item
              key={item.href}
              value={`ir ${item.label}`}
              onSelect={() => go(item.href)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-secondary"
            >
              <item.icon className="size-4 text-muted-foreground" />
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group
          heading="Ações"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {ACTIONS.map((a) => (
            <Command.Item
              key={a.label}
              value={a.label}
              onSelect={() => go(a.href)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-secondary"
            >
              {a.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
