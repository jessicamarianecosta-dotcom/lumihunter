import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { CommandPalette } from "@/components/app/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();

  const supabase = await createClient();
  const { count: attention } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.company.id)
    .eq("needs_attention", true);

  return (
    <div className="flex h-screen overflow-hidden">
      <CommandPalette />
      <Sidebar badges={{ "/conversas": attention ?? 0 }} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          companies={ctx.memberships.map((m) => ({
            id: m.company_id,
            name: m.companies.name,
          }))}
          activeCompanyId={ctx.company.id}
          email={ctx.email}
          role={ctx.role}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
