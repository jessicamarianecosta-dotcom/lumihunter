"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";

export function Topbar({
  companyName,
  email,
  role,
}: {
  companyName: string;
  email: string;
  role: string;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div>
        <p className="text-sm font-medium">{companyName}</p>
        <p className="text-xs text-muted-foreground">
          {email} · {role}
        </p>
      </div>
      <div className="flex items-center gap-1">
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
  );
}
