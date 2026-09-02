"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Menu, X, Search } from "lucide-react";
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

  return (
    <>
      <header className="flex h-14 items-center justify-between gap-2 border-b bg-background px-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <CompanySwitcher
              companies={companies}
              activeId={activeCompanyId}
            />
            <p className="truncate text-xs text-muted-foreground">
              <span className="hidden sm:inline">{email} · </span>
              {role}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <InstallAppButton className="hidden md:inline-flex" />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("lh:command"))}
            className="hidden items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary sm:flex"
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
            className="sm:hidden"
            onClick={() => window.dispatchEvent(new Event("lh:command"))}
            aria-label="Buscar"
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4 font-semibold">
              <span className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                  L
                </span>
                LumiHunter AI
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </Button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
