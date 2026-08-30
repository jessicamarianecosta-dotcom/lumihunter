"use client";

import { useTransition } from "react";
import { switchCompany } from "@/app/(app)/actions";

export function CompanySwitcher({
  companies,
  activeId,
}: {
  companies: { id: string; name: string }[];
  activeId: string;
}) {
  const [pending, start] = useTransition();

  if (companies.length < 2) {
    const c = companies[0];
    return <p className="truncate text-sm font-medium">{c?.name}</p>;
  }

  return (
    <select
      value={activeId}
      disabled={pending}
      onChange={(e) =>
        start(() => {
          void switchCompany(e.target.value);
        })
      }
      className="max-w-[45vw] truncate rounded-md border border-input bg-background px-2 py-1 text-sm font-medium sm:max-w-none"
      aria-label="Trocar de empresa"
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
