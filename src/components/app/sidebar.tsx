"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Crosshair,
  Megaphone,
  MessagesSquare,
  Bot,
  CheckSquare,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads & CRM", icon: Users },
  { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/icp", label: "Cliente ideal (ICP)", icon: Crosshair },
  { href: "/agentes", label: "Agentes de IA", icon: Bot },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/config", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          L
        </span>
        LumiHunter AI
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
