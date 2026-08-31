"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseCsvObjects } from "@/lib/csv";

export function CsvExportButton({
  href,
  label = "Exportar CSV",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={href}>
        <Download className="size-3.5" />
        {label}
      </a>
    </Button>
  );
}

export function CsvImportButton({
  endpoint,
  hint,
  label = "Importar CSV",
}: {
  endpoint: string;
  hint?: string;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setNote(null);
    try {
      const text = await file.text();
      const rows = parseCsvObjects(text);
      if (rows.length === 0) {
        setNote("CSV vazio ou sem cabeçalho.");
        setBusy(false);
        return;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (res.ok) {
        setNote(
          `${data.inserted} importado(s), ${data.skipped} ignorado(s) (duplicados ou inválidos).`,
        );
        router.refresh();
      } else {
        setNote(data.error ?? "Falha na importação.");
      }
    } catch {
      setNote("Não foi possível ler o arquivo.");
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          {busy ? "Importando…" : label}
        </Button>
      </div>
      {hint && !note && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
