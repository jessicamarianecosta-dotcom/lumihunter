"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { Moon, Sun, LogOut, Menu, X, Search, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import { NavList } from "./sidebar";
import { CompanySwitcher } from "./company-switcher";
import { InstallAppButton } from "@/components/shared/install-app-button";

export function Topbar({
  companies,
  activeCompanyId,
  email,
  role,
}: {
  companies: { id: string; name: string }[];
  activeCompanyId: string;
  email: string;
  role: string;
}) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const openSearch = () => window.dispatchEvent(new Event("lh:command"));
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <>
      <header className="flex h-14 items-center justify-between gap-2 border-b bg-background px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>

          {/* Marca — a Sidebar já mostra o logo em telas grandes */}
          <span className="flex shrink-0 items-center gap-2 text-sm font-semibold lg:hidden">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              L
            </span>
            LumiHunter
          </span>

          {/* Workspace — no mobile fica dentro do menu lateral, não no header */}
          <div className="hidden min-w-0 lg:block">
            <CompanySwitcher companies={companies} activeId={activeCompanyId} />
            <p className="truncate text-xs text-muted-foreground">
              {email} · {role}
            </p>
          </div>
        </div>

        {/* Ações — desktop */}
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          <InstallAppButton />
          <button
            type="button"
            onClick={openSearch}
            className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Abrir busca de comandos"
          >
            <Search className="size-3.5" />
            Buscar
            <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Alternar tema"
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
          <form action={signOut}>
            <Button variant="ghost" size="icon" type="submit" aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>

        {/* Ações — mobile: só o essencial fica visível */}
        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={openSearch}
            aria-label="Buscar"
          >
            <Search className="size-4" />
          </Button>

          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais opções">
                <MoreVertical className="size-4" />
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={8}
                align="end"
                className="z-50 w-52 space-y-0.5 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-2xl"
              >
                <InstallAppButton className="w-full justify-start border-0 px-2.5 shadow-none hover:bg-secondary" />
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
                >
                  <Sun className="size-4 dark:hidden" />
                  <Moon className="hidden size-4 dark:block" />
                  Alternar tema
                </button>
                <div className="my-1 h-px bg-border" />
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="size-4" />
                    Sair
                  </button>
                </form>
                <Popover.Arrow className="fill-popover" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </header>

      {/* Menu lateral mobile */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 lg:hidden data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl outline-none duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden">
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 font-semibold">
              <Dialog.Title asChild>
                <span className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                    L
                  </span>
                  LumiHunter
                </span>
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Menu de navegação do LumiHunter
              </Dialog.Description>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Fechar menu">
                  <X className="size-5" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="shrink-0 border-b px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Workspace
              </p>
              <div className="mt-1.5">
                <CompanySwitcher companies={companies} activeId={activeCompanyId} />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {email} · {role}
              </p>
            </div>

            <NavList onNavigate={() => setOpen(false)} />

            <div className="shrink-0 border-t p-2">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-4" />
                  Sair
                </button>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
