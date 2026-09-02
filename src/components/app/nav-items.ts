import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  BookOpen,
  Crosshair,
  Megaphone,
  MessagesSquare,
  Bot,
  CheckSquare,
  FileText,
  BarChart3,
  ScrollText,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campanhas", label: "Prospecção & Campanhas", icon: Megaphone },
  { href: "/leads", label: "Leads & CRM", icon: Users },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/produtos", label: "Produtos & Serviços", icon: Package },
  { href: "/conhecimento", label: "Base LumiLife", icon: BookOpen },
  { href: "/templates", label: "Templates de mensagem", icon: FileText },
  { href: "/icp", label: "Cliente ideal (ICP)", icon: Crosshair },
  { href: "/agentes", label: "Agentes de IA", icon: Bot },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/auditoria", label: "Auditoria", icon: ScrollText },
  { href: "/ajuda", label: "Central de Ajuda", icon: HelpCircle },
  { href: "/config", label: "Configurações", icon: Settings },
];
