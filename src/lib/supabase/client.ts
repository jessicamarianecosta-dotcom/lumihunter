"use client";

import { createBrowserClient } from "@supabase/ssr";

// NOTA: rode `npm run db:types` e troque para createBrowserClient<Database>()
// para ativar a tipagem end-to-end das queries.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
