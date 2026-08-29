"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Insight } from "@/lib/anthropic/agents/analyst";

export function AnalystPanel({ metrics }: { metrics: Record<string, unknown> }) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/agents/analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics }),
    });
    const data = await res.json();
    if (res.ok) setInsights(data.insights ?? []);
    else setErr(data.error ?? "Falha");
    setLoading(false);
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-accent" />
            Insights do Analyst
          </p>
          <Button size="sm" onClick={run} disabled={loading}>
            {loading ? "Analisando…" : "Gerar insights"}
          </Button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        <ul className="mt-4 space-y-3">
          {(insights ?? []).map((ins, i) => (
            <li key={i} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {ins.title}{" "}
                <Badge
                  variant={
                    ins.priority === "alta"
                      ? "danger"
                      : ins.priority === "média"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {ins.priority}
                </Badge>
              </p>
              <p className="mt-1 text-muted-foreground">{ins.observation}</p>
              <p className="mt-1">
                <strong>Recomendação:</strong> {ins.recommendation}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
